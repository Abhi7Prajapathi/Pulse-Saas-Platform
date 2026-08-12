import { apiClient } from "./client";
import type { ApiSuccess, User } from "../types";

export interface AuthPayload {
  access: string;
  refresh: string;
  user: User;
}

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiSuccess<AuthPayload>>("/auth/login/", { email, password });
  return data.data;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  organization_name: string;
}

export async function register(input: RegisterInput) {
  const { data } = await apiClient.post<ApiSuccess<AuthPayload>>("/auth/register/", input);
  return data.data;
}

export async function logout(refresh: string) {
  await apiClient.post("/auth/logout/", { refresh });
}

export async function fetchMe() {
  const { data } = await apiClient.get<ApiSuccess<User>>("/auth/me/");
  return data.data;
}
