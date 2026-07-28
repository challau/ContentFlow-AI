import { apiFetch, setTokens, clearTokens } from './client';
import type { AuthTokens, User } from './types';

export async function login(email: string, password: string): Promise<AuthTokens> {
  const data = await apiFetch<AuthTokens & { organization?: { credits: number } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  if (data.organization && data.user) {
    data.user.credits = data.organization.credits;
  }
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthTokens> {
  const data = await apiFetch<AuthTokens & { organization?: { credits: number } }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  if (data.organization && data.user) {
    data.user.credits = data.organization.credits;
  }
  return data;
}

export async function logout(): Promise<void> {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearTokens();
}

export async function getMe(): Promise<User> {
  const res = await apiFetch<{ user: User; organization?: { credits: number } }>('/auth/me');
  const user = res.user || (res as unknown as User);
  if (res.organization && user) {
    user.credits = res.organization.credits;
  }
  return user;
}
