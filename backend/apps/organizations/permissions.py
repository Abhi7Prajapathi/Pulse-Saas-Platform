from rest_framework.permissions import BasePermission

from apps.organizations.tenant import get_active_membership


class IsOrganizationMember(BasePermission):
    """
    Resolves and attaches request.membership. Fails closed: any request that
    can't be tied to a verified membership is rejected before it reaches the
    view's queryset logic.
    """

    message = "You are not a member of this organization."

    def has_permission(self, request, view):
        request.membership = get_active_membership(request)
        return True


class IsOrgAdminOrOwner(BasePermission):
    message = "Only organization owners and admins can perform this action."

    def has_permission(self, request, view):
        membership = getattr(request, "membership", None) or get_active_membership(request)
        request.membership = membership
        return membership.can_manage_members


class IsOrgOwner(BasePermission):
    message = "Only the organization owner can perform this action."

    def has_permission(self, request, view):
        membership = getattr(request, "membership", None) or get_active_membership(request)
        request.membership = membership
        return membership.can_manage_organization


class CanManageProjectsAndTasks(BasePermission):
    """
    OWNER/ADMIN can create/edit/delete. MEMBER can only act on unsafe methods
    when explicitly permitted by the view (e.g. updating a task's own status).
    """

    message = "You do not have permission to manage projects or tasks in this organization."

    SAFE_METHODS = ("GET", "HEAD", "OPTIONS")

    def has_permission(self, request, view):
        membership = getattr(request, "membership", None) or get_active_membership(request)
        request.membership = membership
        if request.method in self.SAFE_METHODS:
            return True
        if membership.can_manage_projects:
            return True
        # Members are allowed to hit the endpoint; object-level checks in the
        # view (e.g. "only update tasks assigned to me") decide the rest.
        return True
