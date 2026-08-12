from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class RegistrationTests(APITestCase):
    def test_register_creates_user_organization_and_owner_membership(self):
        url = reverse("auth-register")
        payload = {
            "name": "Alice Owner",
            "email": "alice@example.com",
            "password": "SuperSecret123",
            "confirm_password": "SuperSecret123",
            "organization_name": "Acme Inc",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertTrue(body["success"])
        self.assertIn("access", body["data"])
        self.assertIn("refresh", body["data"])

        user = User.objects.get(email="alice@example.com")
        membership = user.memberships.first()
        self.assertEqual(membership.role, "OWNER")
        self.assertEqual(membership.organization.name, "Acme Inc")

    def test_register_rejects_mismatched_passwords(self):
        url = reverse("auth-register")
        payload = {
            "name": "Alice",
            "email": "alice2@example.com",
            "password": "SuperSecret123",
            "confirm_password": "DoesNotMatch1",
            "organization_name": "Acme Inc",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.json()["success"])

    def test_register_rejects_duplicate_email(self):
        User.objects.create_user(username="existing", email="dup@example.com", password="SuperSecret123")
        url = reverse("auth-register")
        payload = {
            "name": "Alice",
            "email": "dup@example.com",
            "password": "SuperSecret123",
            "confirm_password": "SuperSecret123",
            "organization_name": "Acme Inc",
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class LoginRefreshLogoutTests(APITestCase):
    def setUp(self):
        self.password = "SuperSecret123"
        self.user = User.objects.create_user(
            username="bob", email="bob@example.com", password=self.password, first_name="Bob"
        )

    def test_login_success(self):
        response = self.client.post(
            reverse("auth-login"), {"email": "bob@example.com", "password": self.password}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()["data"]
        self.assertIn("access", body)
        self.assertIn("refresh", body)
        self.assertEqual(body["user"]["email"], "bob@example.com")

    def test_login_wrong_password(self):
        response = self.client.post(
            reverse("auth-login"), {"email": "bob@example.com", "password": "wrong"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_and_logout(self):
        login = self.client.post(
            reverse("auth-login"), {"email": "bob@example.com", "password": self.password}, format="json"
        ).json()["data"]

        refresh_response = self.client.post(reverse("auth-refresh"), {"refresh": login["refresh"]}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.json()["data"])

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access']}")
        logout_response = self.client.post(reverse("auth-logout"), {"refresh": login["refresh"]}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_me_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_current_user(self):
        login = self.client.post(
            reverse("auth-login"), {"email": "bob@example.com", "password": self.password}, format="json"
        ).json()["data"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login['access']}")
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["data"]["email"], "bob@example.com")
