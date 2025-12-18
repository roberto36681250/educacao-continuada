import { Page, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    instituteId: string;
  };
}

/**
 * Login via API and return token
 */
export async function apiLogin(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Create invite via API
 */
export async function apiCreateInvite(
  token: string,
  data: {
    instituteId: string;
    hospitalId?: string;
    unitId?: string;
    systemRole: string;
    profession: string;
    invitedEmail?: string;
  },
): Promise<{ id: string; token: string; inviteUrl: string }> {
  const response = await fetch(`${API_URL}/invites`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Create invite failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Accept invite via API
 */
export async function apiAcceptInvite(
  inviteToken: string,
  data: {
    email: string;
    password: string;
    name: string;
    cpf: string;
    phone: string;
    professionalRegister?: string;
  },
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/invites/${inviteToken}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Accept invite failed: ${error.message}`);
  }

  return response.json();
}

/**
 * Set auth token in localStorage (for authenticated page navigation)
 */
export async function setAuthToken(page: Page, token: string): Promise<void> {
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);
}

/**
 * Clear auth token
 */
export async function clearAuthToken(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('token');
  });
}

/**
 * Wait for API to be ready
 */
export async function waitForApi(): Promise<void> {
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return;
    } catch {
      // API not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('API not ready after 30 seconds');
}

/**
 * Generate unique email for tests
 */
export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e-test.local`;
}

/**
 * Generate unique CPF for tests
 */
export function uniqueCpf(): string {
  const base = Date.now().toString().slice(-9);
  return `${base}00`;
}
