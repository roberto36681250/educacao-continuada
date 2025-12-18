import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

async function apiBase<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const token = Cookies.get('token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Legacy callable function for backward compatibility
export async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  return apiBase<T>(endpoint, options);
}

// Object-based API (preferred)
export const apiClient = {
  get: <T>(endpoint: string) => apiBase<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) => apiBase<T>(endpoint, { method: 'POST', body }),
  patch: <T>(endpoint: string, body?: unknown) => apiBase<T>(endpoint, { method: 'PATCH', body }),
  put: <T>(endpoint: string, body?: unknown) => apiBase<T>(endpoint, { method: 'PUT', body }),
  delete: <T>(endpoint: string) => apiBase<T>(endpoint, { method: 'DELETE' }),
};

export function setToken(token: string) {
  Cookies.set('token', token, { expires: 7 });
}

export function removeToken() {
  Cookies.remove('token');
}

export function getToken() {
  return Cookies.get('token');
}

export function getAuthToken() {
  return Cookies.get('token');
}

export function getApiUrl() {
  return API_URL;
}
