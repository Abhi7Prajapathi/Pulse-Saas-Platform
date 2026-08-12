from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.organizations.models import Membership
from apps.organizations.tests.helpers import authed_client, make_org_with_member, with_org_header
from apps.projects.models import Project
from apps.tasks.models import Task


class TenantIsolationTests(APITestCase):
    """
    User A → Organization A → Project A
    User A → attempt to access Project B  →  DENIED
    """

    def setUp(self):
        self.org_a, self.user_a, _ = make_org_with_member("Org A", "a-owner@example.com")
        self.org_b, self.user_b, _ = make_org_with_member("Org B", "b-owner@example.com")

        self.project_a = Project.objects.create_with_unique_slug(
            organization=self.org_a, name="Project A", created_by=self.user_a
        )
        self.project_b = Project.objects.create_with_unique_slug(
            organization=self.org_b, name="Project B", created_by=self.user_b
        )

        self.task_a = Task.objects.create(project=self.project_a, title="Task A", created_by=self.user_a)
        self.task_b = Task.objects.create(project=self.project_b, title="Task B", created_by=self.user_b)

    def test_user_a_cannot_fetch_project_b_directly(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.get(reverse("project-detail", args=[self.project_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_user_a_cannot_fetch_task_b_directly(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.get(reverse("task-detail", args=[self.task_b.id]))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_project_list_never_includes_other_orgs_projects(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [p["id"] for p in response.json()["data"]["results"]]
        self.assertIn(self.project_a.id, ids)
        self.assertNotIn(self.project_b.id, ids)

    def test_task_list_never_includes_other_orgs_tasks(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.get(reverse("task-list"))
        ids = [t["id"] for t in response.json()["data"]["results"]]
        self.assertIn(self.task_a.id, ids)
        self.assertNotIn(self.task_b.id, ids)

    def test_cannot_use_org_header_for_organization_not_a_member_of(self):
        client = with_org_header(authed_client(self.user_a), self.org_b.id)
        response = client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.json()["error"]["code"], "PERMISSION_DENIED")

    def test_missing_org_header_is_rejected(self):
        client = authed_client(self.user_a)
        response = client.get(reverse("project-list"))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_cannot_create_task_against_another_orgs_project_id(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.post(
            reverse("task-list"),
            {"title": "Sneaky task", "project_id": self.project_b.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_assign_task_to_user_outside_organization(self):
        client = with_org_header(authed_client(self.user_a), self.org_a.id)
        response = client.post(
            reverse("task-list"),
            {"title": "Task", "project_id": self.project_a.id, "assigned_to_id": self.user_b.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_organizations_list_only_shows_own_memberships(self):
        client = authed_client(self.user_a)
        response = client.get(reverse("organization-list"))
        names = [o["name"] for o in response.json()["data"]]
        self.assertIn("Org A", names)
        self.assertNotIn("Org B", names)

    def test_members_endpoint_rejects_non_member(self):
        outsider_client = authed_client(self.user_b)
        response = outsider_client.get(reverse("org-members", args=[self.org_a.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class RolePermissionTests(APITestCase):
    def setUp(self):
        self.org, self.owner, _ = make_org_with_member("Acme", "owner@example.com", role=Membership.Role.OWNER)

    def _add_member(self, email, role):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User.objects.create_user(username=email.split("@")[0], email=email, password="SuperSecret123")
        membership = Membership.objects.create(user=user, organization=self.org, role=role)
        return user, membership

    def test_member_cannot_create_project(self):
        member, _ = self._add_member("member@example.com", Membership.Role.MEMBER)
        client = with_org_header(authed_client(member), self.org.id)
        response = client.post(reverse("project-list"), {"name": "New Project"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_project(self):
        admin, _ = self._add_member("admin@example.com", Membership.Role.ADMIN)
        client = with_org_header(authed_client(admin), self.org.id)
        response = client.post(reverse("project-list"), {"name": "New Project"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_admin_cannot_delete_organization(self):
        admin, _ = self._add_member("admin2@example.com", Membership.Role.ADMIN)
        client = authed_client(admin)
        response = client.delete(reverse("organization-detail", args=[self.org.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_delete_organization(self):
        client = authed_client(self.owner)
        response = client.delete(reverse("organization-detail", args=[self.org.id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_member_can_update_status_of_own_assigned_task(self):
        member, _ = self._add_member("member2@example.com", Membership.Role.MEMBER)
        project = Project.objects.create_with_unique_slug(
            organization=self.org, name="P", created_by=self.owner
        )
        task = Task.objects.create(
            project=project, title="T", created_by=self.owner, assigned_to=member
        )
        client = with_org_header(authed_client(member), self.org.id)
        response = client.patch(reverse("task-detail", args=[task.id]), {"status": "DONE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_member_cannot_update_task_not_assigned_to_them(self):
        member, _ = self._add_member("member3@example.com", Membership.Role.MEMBER)
        other_member, _ = self._add_member("other@example.com", Membership.Role.MEMBER)
        project = Project.objects.create_with_unique_slug(
            organization=self.org, name="P2", created_by=self.owner
        )
        task = Task.objects.create(
            project=project, title="T2", created_by=self.owner, assigned_to=other_member
        )
        client = with_org_header(authed_client(member), self.org.id)
        response = client.patch(reverse("task-detail", args=[task.id]), {"status": "DONE"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_member_cannot_delete_task(self):
        member, _ = self._add_member("member4@example.com", Membership.Role.MEMBER)
        project = Project.objects.create_with_unique_slug(
            organization=self.org, name="P3", created_by=self.owner
        )
        task = Task.objects.create(project=project, title="T3", created_by=self.owner, assigned_to=member)
        client = with_org_header(authed_client(member), self.org.id)
        response = client.delete(reverse("task-detail", args=[task.id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
