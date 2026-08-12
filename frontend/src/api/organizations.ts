import { apiClient } from "./client";
import type { ApiSuccess, Membership, Organization, Role } from "../types";

export async function listOrganizations() {
  const { data } = await apiClient.get<ApiSuccess<Organization[]>>("/organizations/");
  return data.data;
}

export async function createOrganization(name: string) {
  const { data } = await apiClient.post<ApiSuccess<Organization>>("/organizations/", { name });
  return data.data;
}

export async function updateOrganization(id: number, name: string) {
  const { data } = await apiClient.patch<ApiSuccess<Organization>>(`/organizations/${id}/`, { name });
  return data.data;
}

export async function deleteOrganization(id: number) {
  await apiClient.delete(`/organizations/${id}/`);
}

export async function listMembers(orgId: number) {
  const { data } = await apiClient.get<ApiSuccess<Membership[]>>(`/organizations/${orgId}/members/`);
  return data.data;
}

export async function addMember(orgId: number, email: string, role: Role) {
  const { data } = await apiClient.post<ApiSuccess<Membership>>(`/organizations/${orgId}/members/`, {
    email,
    role,
  });
  return data.data;
}

export async function updateMemberRole(orgId: number, memberId: number, role: Role) {
  const { data } = await apiClient.patch<ApiSuccess<Membership>>(
    `/organizations/${orgId}/members/${memberId}/`,
    { role }
  );
  return data.data;
}

export async function removeMember(orgId: number, memberId: number) {
  await apiClient.delete(`/organizations/${orgId}/members/${memberId}/`);
}
