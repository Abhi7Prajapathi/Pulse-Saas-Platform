import { apiClient } from "./client";
import type { ApiSuccess, PaginatedResult, Project } from "../types";

export interface ProjectListParams {
  search?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
}

export async function listProjects(params: ProjectListParams = {}) {
  const { data } = await apiClient.get<ApiSuccess<PaginatedResult<Project>>>("/projects/", { params });
  return data.data;
}

export async function getProject(id: number) {
  const { data } = await apiClient.get<ApiSuccess<Project>>(`/projects/${id}/`);
  return data.data;
}

export interface ProjectInput {
  name: string;
  description?: string;
}

export async function createProject(input: ProjectInput) {
  const { data } = await apiClient.post<ApiSuccess<Project>>("/projects/", input);
  return data.data;
}

export async function updateProject(id: number, input: Partial<ProjectInput>) {
  const { data } = await apiClient.patch<ApiSuccess<Project>>(`/projects/${id}/`, input);
  return data.data;
}

export async function deleteProject(id: number) {
  await apiClient.delete(`/projects/${id}/`);
}
