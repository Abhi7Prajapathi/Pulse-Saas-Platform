from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.organizations.models import Membership, Organization

User = get_user_model()


def make_org_with_member(org_name, email, role=Membership.Role.OWNER, password="SuperSecret123"):
    org = Organization.objects.create_with_unique_slug(name=org_name)
    user = User.objects.create_user(
        username=email.split("@")[0], email=email, password=password, first_name="Test"
    )
    membership = Membership.objects.create(user=user, organization=org, role=role)
    return org, user, membership


def authed_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def with_org_header(client, org_id):
    client.credentials(HTTP_X_ORGANIZATION_ID=str(org_id))
    return client
