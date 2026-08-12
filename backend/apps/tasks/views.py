from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.viewsets import ModelViewSet

from apps.common.responses import success
from apps.organizations.models import Membership
from apps.organizations.permissions import IsOrganizationMember
from apps.tasks.filters import TaskFilter
from apps.tasks.models import Task
from apps.tasks.serializers import TaskSerializer


class TaskViewSet(ModelViewSet):
    """
    Tasks are scoped through project__organization, never trusting a bare
    task id — a task can only be reached if its project belongs to the
    caller's verified organization membership.
    """

    serializer_class = TaskSerializer
    permission_classes = [IsOrganizationMember]
    filter_backends = [SearchFilter, OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "due_date", "priority", "status"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Task.objects.filter(project__organization=self.request.membership.organization)
            .select_related("project", "assigned_to", "created_by")
        )

    def perform_create(self, serializer):
        # OWNER/ADMIN/MEMBER may all create tasks; membership is already
        # verified by IsOrganizationMember, and the serializer independently
        # re-validates that project_id/assigned_to_id belong to this org.
        serializer.save()

    def perform_update(self, serializer):
        membership = self.request.membership
        instance = serializer.instance
        if membership.can_manage_projects:
            serializer.save()
            return

        # MEMBER role: may only update the status of a task assigned to them.
        if instance.assigned_to_id != self.request.user.id:
            raise PermissionDenied("You can only update tasks assigned to you.")
        allowed_fields = {"status"}
        submitted_fields = set(self.request.data.keys())
        if not submitted_fields.issubset(allowed_fields):
            raise PermissionDenied("Members may only update the status of their own tasks.")
        serializer.save()

    def perform_destroy(self, instance):
        if not self.request.membership.can_manage_projects:
            raise PermissionDenied("Only owners and admins can delete tasks.")
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
