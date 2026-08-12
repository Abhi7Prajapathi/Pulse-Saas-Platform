from django.conf import settings
from django.db import models
from django.utils.text import slugify


class OrganizationManager(models.Manager):
    def create_with_unique_slug(self, name, **kwargs):
        base_slug = slugify(name) or "organization"
        slug = base_slug
        suffix = 1
        while self.filter(slug=slug).exists():
            suffix += 1
            slug = f"{base_slug}-{suffix}"
        return self.create(name=name, slug=slug, **kwargs)


class Organization(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OrganizationManager()

    class Meta:
        indexes = [models.Index(fields=["slug"])]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = "OWNER", "Owner"
        ADMIN = "ADMIN", "Admin"
        MEMBER = "MEMBER", "Member"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="memberships")
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "organization"], name="unique_user_per_organization")
        ]
        indexes = [
            models.Index(fields=["organization", "role"]),
            models.Index(fields=["user", "organization"]),
        ]

    def __str__(self):
        return f"{self.user_id} @ {self.organization_id} ({self.role})"

    @property
    def can_manage_members(self):
        return self.role in (self.Role.OWNER, self.Role.ADMIN)

    @property
    def can_manage_projects(self):
        return self.role in (self.Role.OWNER, self.Role.ADMIN)

    @property
    def can_manage_organization(self):
        return self.role == self.Role.OWNER
