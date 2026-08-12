from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.viewsets import ModelViewSet

from apps.common.responses import success
from apps.organizations.permissions import CanManageProjectsAndTasks, IsOrganizationMember
from apps.projects.filters import ProjectFilter
from apps.projects.models import Project
from apps.projects.serializers import ProjectSerializer


class ProjectViewSet(ModelViewSet):
    """
    Every queryset here is filtered to request.membership.organization —
    the org verified by IsOrganizationMember from the X-Organization-Id
    header — so a project belonging to another tenant can never be returned,
    regardless of what id is requested in the URL.
    """

    serializer_class = ProjectSerializer
    permission_classes = [IsOrganizationMember, CanManageProjectsAndTasks]
    filter_backends = [SearchFilter, OrderingFilter]
    filterset_class = ProjectFilter
    search_fields = ["name", "description"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Project.objects.filter(organization=self.request.membership.organization).select_related(
            "created_by", "organization"
        )

    def perform_create(self, serializer):
        if not self.request.membership.can_manage_projects:
            raise PermissionDenied("Only owners and admins can create projects.")
        serializer.save()

    def perform_update(self, serializer):
        if not self.request.membership.can_manage_projects:
            raise PermissionDenied("Only owners and admins can edit projects.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.membership.can_manage_projects:
            raise PermissionDenied("Only owners and admins can delete projects.")
        instance.delete()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        return success(self.get_serializer(self.get_object()).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return success(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success(serializer.data)

    def destroy(self, request, *args, **kwargs):
        self.perform_destroy(self.get_object())
        return success(status=status.HTTP_204_NO_CONTENT)
