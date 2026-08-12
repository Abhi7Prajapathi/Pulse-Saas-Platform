from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.organizations.models import Membership
from apps.projects.models import Project
from apps.tasks.models import Task


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = UserSerializer(read_only=True)
    created_by = UserSerializer(read_only=True)
    assigned_to_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    project_id = serializers.IntegerField(write_only=True, required=False)

    class Meta:
        model = Task
        fields = [
            "id",
            "project",
            "project_id",
            "title",
            "description",
            "status",
            "priority",
            "assigned_to",
            "assigned_to_id",
            "created_by",
            "due_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "created_by", "created_at", "updated_at"]

    def _organization(self):
        return self.context["request"].membership.organization

    def validate_project_id(self, value):
        organization = self._organization()
        if not Project.objects.filter(id=value, organization=organization).exists():
            raise serializers.ValidationError("Project not found in this organization.")
        return value

    def validate_assigned_to_id(self, value):
        if value is None:
            return value
        organization = self._organization()
        if not Membership.objects.filter(user_id=value, organization=organization).exists():
            raise serializers.ValidationError("Assigned user must be a member of this organization.")
        return value

    def create(self, validated_data):
        request = self.context["request"]
        project_id = validated_data.pop("project_id", None)
        if project_id is None:
            raise serializers.ValidationError({"project_id": "This field is required."})
        assigned_to_id = validated_data.pop("assigned_to_id", None)
        return Task.objects.create(
            project_id=project_id,
            assigned_to_id=assigned_to_id,
            created_by=request.user,
            **validated_data,
        )

    def update(self, instance, validated_data):
        if "project_id" in validated_data:
            instance.project_id = validated_data.pop("project_id")
        if "assigned_to_id" in validated_data:
            instance.assigned_to_id = validated_data.pop("assigned_to_id")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance
