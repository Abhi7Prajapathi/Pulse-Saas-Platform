from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.organizations.views import MemberDetailView, MembersView, OrganizationViewSet

router = DefaultRouter()
router.register("", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("<int:org_id>/members/", MembersView.as_view(), name="org-members"),
    path("<int:org_id>/members/<int:member_id>/", MemberDetailView.as_view(), name="org-member-detail"),
] + router.urls
