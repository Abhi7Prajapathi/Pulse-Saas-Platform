"""
Central tenant-resolution helper.

Every organization-scoped request must supply the target organization via the
`X-Organization-Id` header (the frontend sets this from the active org in its
switcher). This value is NEVER trusted on its own — we always verify the
authenticated user has a Membership row for that organization before using it
anywhere in a queryset or permission check. This is the single choke point
where that verification happens, so tenant isolation cannot be bypassed by
skipping a check in an individual view.
"""

from rest_framework.exceptions import NotFound, PermissionDenied

from apps.organizations.models import Membership


def get_active_membership(request):
    """
    Resolve and return the caller's Membership for the organization specified
    in the X-Organization-Id header. Raises PermissionDenied if the user is
    not a member of that organization (or the header is missing/invalid).
    """
    org_id = request.headers.get("X-Organization-Id") or request.query_params.get("organization")

    if not org_id:
        raise PermissionDenied("An X-Organization-Id header is required to access this resource.")

    try:
        org_id = int(org_id)
    except (TypeError, ValueError):
        raise NotFound("Invalid organization id.")

    membership = (
        Membership.objects.select_related("organization")
        .filter(user=request.user, organization_id=org_id)
        .first()
    )

    if membership is None:
        # Deliberately identical error whether the org doesn't exist or the
        # user just isn't a member of it — don't leak which organizations exist.
        raise PermissionDenied("You are not a member of this organization.")

    return membership
