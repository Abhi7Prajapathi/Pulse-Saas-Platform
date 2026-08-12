from rest_framework import serializers

from apps.accounts.serializers import UserSerializer
from apps.projects.models import Project


class ProjectSerializer(serializers.ModelSerializer):
    created_by = UserSerializer(read_only=True)
    task_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            "id",
            "organization",
            "name",
            "slug",
            "description",
            "created_by",
            "task_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organization", "slug", "created_by", "created_at", "updated_at"]

    def get_task_count(self, obj):
        return obj.tasks.count()

    def create(self, validated_data):
        request = self.context["request"]
        return Project.objects.create_with_unique_slug(
            organization=request.membership.organization,
            created_by=request.user,
            **validated_data,
        )
