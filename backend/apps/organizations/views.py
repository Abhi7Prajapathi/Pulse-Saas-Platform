from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet

from apps.common.responses import success
from apps.organizations.models import Membership, Organization
from apps.organizations.permissions import IsOrgAdminOrOwner
from apps.organizations.serializers import (
    AddMemberSerializer,
    MembershipSerializer,
    OrganizationSerializer,
    UpdateMemberRoleSerializer,
)


class OrganizationViewSet(ModelViewSet):
    """
    Organizations a user belongs to. Unlike projects/tasks, this endpoint is
    intentionally NOT gated by the X-Organization-Id header — it's how the
    frontend discovers which organizations exist for the switcher in the
    first place.
    """

    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Organization.objects.filter(memberships__user=self.request.user).distinct()

    def get_object(self):
        obj = get_object_or_404(self.get_queryset(), pk=self.kwargs["pk"])
        return obj

    def get_membership(self, organization):
        return Membership.objects.filter(user=self.request.user, organization=organization).first()

    def perform_update(self, serializer):
        membership = self.get_membership(serializer.instance)
        if not membership or not membership.can_manage_organization:
            raise PermissionDenied("Only the organization owner can update organization settings.")
        serializer.save()

    def perform_destroy(self, instance):
        membership = self.get_membership(instance)
        if not membership or not membership.can_manage_organization:
            raise PermissionDenied("Only the organization owner can delete the organization.")
        instance.delete()

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return success(serializer.data)

    def retrieve(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object())
        return success(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()
        return success(self.get_serializer(organization).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", True)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return success(serializer.data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return success(status=status.HTTP_204_NO_CONTENT)


class MembersView(APIView):
    """GET/POST /api/organizations/{id}/members/"""

    permission_classes = [IsAuthenticated]

    def get_organization(self, org_id, user):
        organization = get_object_or_404(Organization, pk=org_id)
        membership = Membership.objects.filter(user=user, organization=organization).first()
        if membership is None:
            raise PermissionDenied("You are not a member of this organization.")
        return organization, membership

    def get(self, request, org_id):
        organization, _ = self.get_organization(org_id, request.user)
        memberships = Membership.objects.filter(organization=organization).select_related("user")
        serializer = MembershipSerializer(memberships, many=True)
        return success(serializer.data)

    def post(self, request, org_id):
        organization, membership = self.get_organization(org_id, request.user)
        if not membership.can_manage_members:
            raise PermissionDenied("Only owners and admins can add members.")
        serializer = AddMemberSerializer(data=request.data, context={"organization": organization})
        serializer.is_valid(raise_exception=True)
        new_membership = serializer.save()
        return success(MembershipSerializer(new_membership).data, status=status.HTTP_201_CREATED)


class MemberDetailView(APIView):
    """PATCH/DELETE /api/organizations/{id}/members/{member_id}/"""

    permission_classes = [IsAuthenticated]

    def get_target(self, org_id, member_id, user):
        organization = get_object_or_404(Organization, pk=org_id)
        requester_membership = Membership.objects.filter(user=user, organization=organization).first()
        if requester_membership is None:
            raise PermissionDenied("You are not a member of this organization.")
        target = get_object_or_404(Membership, pk=member_id, organization=organization)
        return organization, requester_membership, target

    def patch(self, request, org_id, member_id):
        organization, requester, target = self.get_target(org_id, member_id, request.user)
        if not requester.can_manage_members:
            raise PermissionDenied("Only owners and admins can change member roles.")
        if target.role == Membership.Role.OWNER:
            raise PermissionDenied("The organization owner's role cannot be changed this way.")

        serializer = UpdateMemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_role = serializer.validated_data["role"]

        if new_role == Membership.Role.OWNER:
            raise ValidationError({"role": "Ownership transfer is not supported through this endpoint."})
        if requester.role == Membership.Role.ADMIN and new_role == Membership.Role.OWNER:
            raise PermissionDenied("Admins cannot grant ownership.")

        target.role = new_role
        target.save(update_fields=["role"])
        return success(MembershipSerializer(target).data)

    def delete(self, request, org_id, member_id):
        organization, requester, target = self.get_target(org_id, member_id, request.user)
        if not requester.can_manage_members:
            raise PermissionDenied("Only owners and admins can remove members.")
        if target.role == Membership.Role.OWNER:
            raise PermissionDenied("The organization owner cannot be removed.")
        target.delete()
        return success(status=status.HTTP_204_NO_CONTENT)
