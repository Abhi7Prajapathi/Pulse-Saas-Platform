export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  date_joined: string;
}

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface Organization {
  id: number;
  name: string;
  slug: string;
  my_role: Role;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: number;
  user: User;
  role: Role;
  created_at: string;
}

export interface Project {
  id: number;
  organization: number;
  name: string;
  slug: string;
  description: string;
  created_by: User | null;
  task_count: number;
  created_at: string;
  updated_at: string;
}

export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: number;
  project: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: User | null;
  created_by: User | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResult<T> {
  results: T[];
  count: number;
  num_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, unknown>;
  };
}
