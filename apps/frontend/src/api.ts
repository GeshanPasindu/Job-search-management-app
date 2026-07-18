import type {
  Application,
  ApplicationPackage,
  AuthResponse,
  AuthUser,
  DashboardStats,
  Job,
  Keyword,
  ProfileResponse,
  SourceConfig,
  TemplateList
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

type PublicImportResult = {
  importedCount: number;
  skippedCount: number;
  filteredCount?: number;
  jobs: Job[];
  skipped: Job[];
  sources?: Array<{
    sourceId: string;
    sourceName: string;
    importedCount: number;
    skippedCount: number;
    filteredCount?: number;
  }>;
  errors?: Array<{
    sourceId: string;
    sourceName: string;
    error: string;
  }>;
};

let currentAccessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const setAccessToken = (token: string | null) => {
  currentAccessToken = token;
};

export const setUnauthorizedCallback = (callback: () => void) => {
  onUnauthorized = callback;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
  }

  if (currentAccessToken) {
    headers.set("Authorization", `Bearer ${currentAccessToken}`);
  }

  options.credentials = "include";

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && onUnauthorized) {
    onUnauthorized();
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { error?: string };
    throw new Error(errorBody?.error ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

let refreshPromise: Promise<AuthResponse> | null = null;

export const api = {
  auth: {
    register: (payload: Record<string, string>) =>
      request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    login: (payload: Record<string, string>) =>
      request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    refresh: () => {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) return Promise.reject(new Error("No refresh token"));
      
      if (!refreshPromise) {
        refreshPromise = request<AuthResponse>("/auth/refresh", { 
          method: "POST", 
          body: JSON.stringify({ refreshToken }) 
        }).finally(() => {
          refreshPromise = null;
        });
      }
      return refreshPromise;
    },
    logout: () => {
      const refreshToken = localStorage.getItem("refreshToken");
      return request<{ message: string }>("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken }) });
    },
    me: () => request<{ user: AuthUser }>("/auth/me")
  },

  dashboard: () => request<DashboardStats>("/dashboard/stats"),

  keywords: {
    list: () => request<Keyword[]>("/keywords"),
    create: (payload: Partial<Keyword>) =>
      request<Keyword>("/keywords", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Partial<Keyword>) =>
      request<Keyword>(`/keywords/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) => request<{ id: string }>(`/keywords/${id}`, { method: "DELETE" })
  },

  sources: {
    list: () => request<SourceConfig[]>("/sources"),
    update: (id: string, payload: Partial<SourceConfig>) =>
      request<SourceConfig>(`/sources/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    testUrl: (payload: { sourceId: string; filters: Record<string, unknown> }) =>
      request<{ source: SourceConfig; urls: string[]; notes: string[]; safetyNote: string }>(
        "/sources/test-url",
        { method: "POST", body: JSON.stringify(payload) }
      )
  },

  jobs: {
    list: (query = "") => request<Job[]>(`/jobs${query}`),
    get: (id: string) => request<Job>(`/jobs/${id}`),
    create: (payload: Partial<Job>) =>
      request<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
    importManual: (payload: Record<string, unknown>) =>
      request<Job>("/jobs/import-manual", { method: "POST", body: JSON.stringify(payload) }),
    importPublic: (payload: Record<string, unknown>) =>
      request<PublicImportResult>("/jobs/import-public", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    importPublicAll: (payload: Record<string, unknown> = {}) =>
      request<PublicImportResult>("/jobs/import-public/all", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    update: (id: string, payload: Partial<Job>) =>
      request<Job>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) => request<{ id: string }>(`/jobs/${id}`, { method: "DELETE" }),
    score: (id: string) => request<Job>(`/jobs/${id}/score`, { method: "POST" }),
    rescoreAll: () => request<Job[]>("/jobs/rescore-all", { method: "POST" })
  },

  email: {
    gmailStatus: () =>
      request<{
        configured: boolean;
        connected: boolean;
        redirectUri: string;
        scopes: string[];
      }>("/email/gmail/status"),
    gmailAuthUrl: () => request<{ url: string }>("/email/gmail/auth-url"),
    importJobAlerts: (payload: Record<string, unknown>) =>
      request<{
        messagesScanned: number;
        candidateJobsFound: number;
        importedCount: number;
        skippedCount: number;
        filteredCount: number;
        jobs: Job[];
        skipped: Job[];
      }>("/email/job-alerts/import", { method: "POST", body: JSON.stringify(payload) })
  },

  templates: {
    list: () => request<TemplateList>("/templates"),
    upload: (formData: FormData) =>
      request("/templates/upload", { method: "POST", body: formData }) as Promise<unknown>,
    update: (id: string, payload: Record<string, unknown>) =>
      request(`/templates/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) => request<{ id: string }>(`/templates/${id}`, { method: "DELETE" })
  },

  applicationPackages: {
    generate: (payload: {
      jobId: string;
      cvTemplateId?: string;
      coverLetterTemplateId?: string;
      roleCategory?: string;
    }) =>
      request<ApplicationPackage>("/application-packages/generate", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    update: (id: string, payload: Partial<ApplicationPackage>) =>
      request<ApplicationPackage>(`/application-packages/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      })
  },

  applications: {
    list: () => request<Application[]>("/applications"),
    create: (payload: Record<string, unknown>) =>
      request<Application>("/applications", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<Application>(`/applications/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    delete: (id: string) => request<{ id: string }>(`/applications/${id}`, { method: "DELETE" })
  },

  profile: {
    get: () => request<ProfileResponse>("/profile"),
    update: (payload: Record<string, unknown>) =>
      request<ProfileResponse>("/profile", { method: "PUT", body: JSON.stringify(payload) })
  }
};

export function buildQuery(params: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}
