/**
 * api.ts - tiny HTTP client for the CardSplit backend microservice.
 *
 * In Docker the browser talks to the Nginx frontend container, which forwards
 * every /api/* request to the backend container - so the default base URL is
 * simply "/api" (same origin, no CORS needed).
 * Set VITE_API_URL at build time only if your API lives on another domain.
 */
const API_ORIGIN = (((import.meta as any).env?.VITE_API_URL as string) || '').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;

export const getApiBaseUrl = (): string =>
  API_ORIGIN ? API_BASE : `${window.location.origin}${API_BASE}`;

/* The admin password lives in memory only (never in localStorage) and is
   attached to every write request once the user has unlocked the app. */
let adminPassword: string | null = null;
export const setAdminPassword = (pw: string | null): void => {
  adminPassword = pw;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (adminPassword && method !== 'GET') headers['x-admin-password'] = adminPassword;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the CardSplit backend. Make sure the backend service is running.');
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON response (e.g. a proxy error page) */
  }

  if (!res.ok) {
    const fallback =
      res.status === 502 || res.status === 503 || res.status === 504
        ? 'The backend service is unavailable right now.'
        : `Request failed (HTTP ${res.status}).`;
    throw new ApiError(res.status, data?.error || fallback);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

/** Is the backend up AND able to reach its database? */
export async function checkBackendHealth(): Promise<{ ok: boolean; message: string }> {
  try {
    await api.get('/health');
    return { ok: true, message: 'Backend and database are healthy.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Backend is unreachable.' };
  }
}
