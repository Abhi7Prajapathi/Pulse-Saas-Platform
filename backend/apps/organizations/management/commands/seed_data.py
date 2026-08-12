import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.organizations.models import Membership, Organization
from apps.projects.models import Project
from apps.tasks.models import Task

User = get_user_model()

PROJECT_NAMES = [
    "Website Redesign",
    "Mobile App Launch",
    "Marketing Platform",
    "Customer Portal",
    "Internal Tooling",
    "API Migration",
]

TASK_TITLES = [
    "Set up project repository",
    "Design homepage wireframes",
    "Implement authentication flow",
    "Write API documentation",
    "Fix responsive layout bug",
    "Configure CI pipeline",
    "Review pull request",
    "Update dependency versions",
    "Conduct user research interview",
    "Draft release notes",
]


class Command(BaseCommand):
    help = "Seed two organizations with owners, admins, members, projects and tasks to test tenant isolation."

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Clearing previously seeded demo data (emails ending in @demo.test)...")
        User.objects.filter(email__endswith="@demo.test").delete()

        for org_label in ("A", "B"):
            self._seed_organization(org_label)

        self.stdout.write(self.style.SUCCESS("\nSeed data created successfully."))
        self.stdout.write(self.style.SUCCESS("All demo users share the password: DemoPass123!"))
        self.stdout.write("Try: owner-a@demo.test / DemoPass123! and owner-b@demo.test / DemoPass123!")
        self.stdout.write(
            "Log in as owner-a and confirm you can never see Organization B's projects or tasks, and vice versa."
        )

    def _seed_organization(self, label):
        org = Organization.objects.create_with_unique_slug(name=f"Organization {label}")
        self.stdout.write(f"\nCreated {org.name} ({org.slug})")

        owner = User.objects.create_user(
            username=f"owner-{label.lower()}",
            email=f"owner-{label.lower()}@demo.test",
            first_name="Owner",
            last_name=label,
            password="DemoPass123!",
        )
        Membership.objects.create(user=owner, organization=org, role=Membership.Role.OWNER)

        admin = User.objects.create_user(
            username=f"admin-{label.lower()}",
            email=f"admin-{label.lower()}@demo.test",
            first_name="Admin",
            last_name=label,
            password="DemoPass123!",
        )
        Membership.objects.create(user=admin, organization=org, role=Membership.Role.ADMIN)

        members = []
        for i in range(1, 4):
            member = User.objects.create_user(
                username=f"member-{label.lower()}-{i}",
                email=f"member-{label.lower()}-{i}@demo.test",
                first_name=f"Member{i}",
                last_name=label,
                password="DemoPass123!",
            )
            Membership.objects.create(user=member, organization=org, role=Membership.Role.MEMBER)
            members.append(member)

        assignable_users = [owner, admin] + members

        for name in random.sample(PROJECT_NAMES, 3):
            project = Project.objects.create_with_unique_slug(
                organization=org, name=name, description=f"{name} for {org.name}", created_by=owner
            )
            for title in random.sample(TASK_TITLES, k=random.randint(4, 7)):
                Task.objects.create(
                    project=project,
                    title=title,
                    description=f"{title} — {project.name}",
                    status=random.choice(Task.Status.values),
                    priority=random.choice(Task.Priority.values),
                    assigned_to=random.choice(assignable_users),
                    created_by=owner,
                    due_date=timezone.now().date() + timedelta(days=random.randint(-5, 30)),
                )

        self.stdout.write(f"  1 owner, 1 admin, {len(members)} members, 3 projects seeded.")
