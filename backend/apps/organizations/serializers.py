from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.organizations.models import Membership, Organization

User = get_user_model()


class OrganizationSerializer(serializers.ModelSerializer):
    my_role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = ["id", "name", "slug", "my_role", "member_count", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_my_role(self, obj):
        user = self.context["request"].user
        membership = obj.memberships.filter(user=user).first()
        return membership.role if membership else None

    def get_member_count(self, obj):
        return obj.memberships.count()

    def create(self, validated_data):
        organization = Organization.objects.create_with_unique_slug(name=validated_data["name"])
        Membership.objects.create(
            user=self.context["request"].user,
            organization=organization,
            role=Membership.Role.OWNER,
        )
        return organization


class MembershipUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "first_name", "last_name", "full_name"]


class MembershipSerializer(serializers.ModelSerializer):
    user = MembershipUserSerializer(read_only=True)

    class Meta:
        model = Membership
        fields = ["id", "user", "role", "created_at"]
        read_only_fields = ["id", "user", "created_at"]


class AddMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()
    role = serializers.ChoiceField(choices=Membership.Role.choices, default=Membership.Role.MEMBER)

    def validate_email(self, value):
        value = value.lower().strip()
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "No user with this email exists yet. They must register an account first."
            )
        return value

    def validate(self, attrs):
        organization = self.context["organization"]
        user = User.objects.get(email=attrs["email"])
        if Membership.objects.filter(user=user, organization=organization).exists():
            raise serializers.ValidationError("This user is already a member of the organization.")
        attrs["user"] = user
        return attrs

    def save(self, **kwargs):
        return Membership.objects.create(
            user=self.validated_data["user"],
            organization=self.context["organization"],
            role=self.validated_data["role"],
        )


class UpdateMemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Membership.Role.choices)
