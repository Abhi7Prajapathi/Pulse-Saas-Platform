import { apiClient } from "./client";
import type { ApiSuccess, PaginatedResult, Task, TaskPriority, TaskStatus } from "../types";

export interface TaskListParams {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: number;
  assigned_to?: number;
  ordering?: string;
  page?: number;
  page_size?: number;
}

export async function listTasks(params: TaskListParams = {}) {
  const { data } = await apiClient.get<ApiSuccess<PaginatedResult<Task>>>("/tasks/", { params });
  return data.data;
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project_id?: number;
  assigned_to_id?: number | null;
  due_date?: string | null;
}

export async function createTask(input: TaskInput) {
  const { data } = await apiClient.post<ApiSuccess<Task>>("/tasks/", input);
  return data.data;
}

export async function updateTask(id: number, input: Partial<TaskInput>) {
  const { data } = await apiClient.patch<ApiSuccess<Task>>(`/tasks/${id}/`, input);
  return data.data;
}

export async function deleteTask(id: number) {
  await apiClient.delete(`/tasks/${id}/`);
}
