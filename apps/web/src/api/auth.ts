import { apiFetch, setTokens, clearTokens } from './client';
import type { AuthTokens, User } from './types';

export async function login(email: string, password: string): Promise<AuthTokens> {
  const data = await apiFetch<AuthTokens>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function register(name: string, email: string, password: string): Promise<AuthTokens> {
  const data = await apiFetch<AuthTokens>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  });
  setTokens(data.accessToken, data.refreshToken);
  return data;
}

export async function logout(): Promise<void> {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
  clearTokens();
}

export async function getMe(): Promise<User> {
  return apiFetch<User>('/auth/me');
}
