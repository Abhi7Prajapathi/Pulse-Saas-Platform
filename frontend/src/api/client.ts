import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const API_URL = import.meta.env.VITE_API_URL || "/api";

const ACCESS_KEY = "pulse_access_token";
const REFRESH_KEY = "pulse_refresh_token";
const ORG_KEY = "pulse_active_org_id";

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ORG_KEY);
  },
};

export const orgStore = {
  get: () => localStorage.getItem(ORG_KEY),
  set: (id: number) => localStorage.setItem(ORG_KEY, String(id)),
  clear: () => localStorage.removeItem(ORG_KEY),
};

export const apiClient = axios.create({ baseURL: API_URL });

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = tokenStore.getAccess();
  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }
  const orgId = orgStore.get();
  // Auth and organization-list endpoints don't need (or shouldn't send) an org header.
  const exempt = ["/auth/", "/organizations/"];
  const isExempt = exempt.some((p) => config.url?.startsWith(p)) && !config.url?.includes("/members");
  if (orgId && !isExempt) {
    config.headers["X-Organization-Id"] = orgId;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) return null;
  try {
    const response = await axios.post(`${API_URL}/auth/refresh/`, { refresh });
    const access = response.data.data.access as string;
    tokenStore.setAccess(access);
    return access;
  } catch {
    tokenStore.clear();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }
      const newAccess = await refreshPromise;
      if (newAccess) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      }
      // Refresh failed — force sign-out.
      tokenStore.clear();
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);
