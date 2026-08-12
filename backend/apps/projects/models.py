from django.conf import settings
from django.db import models
from django.utils.text import slugify

from apps.organizations.models import Organization


class ProjectManager(models.Manager):
    def create_with_unique_slug(self, organization, name, **kwargs):
        base_slug = slugify(name) or "project"
        slug = base_slug
        suffix = 1
        while self.filter(organization=organization, slug=slug).exists():
            suffix += 1
            slug = f"{base_slug}-{suffix}"
        return self.create(organization=organization, name=name, slug=slug, **kwargs)


class Project(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="created_projects"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProjectManager()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["organization", "slug"], name="unique_project_slug_per_org")
        ]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["organization", "slug"]),
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.organization.slug})"
