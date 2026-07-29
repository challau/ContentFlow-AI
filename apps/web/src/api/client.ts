// ── Base API client with auto-refresh ─────────────────────────────

const BASE = import.meta.env.VITE_API_URL || '/api/v1';
function getTokens() {
  return {
    access:  localStorage.getItem('cf_access'),
    refresh: localStorage.getItem('cf_refresh'),
  };
}

export function setTokens(access: string, refresh: string) {
  localStorage.setItem('cf_access',  access);
  localStorage.setItem('cf_refresh', refresh);
}

export function clearTokens() {
  localStorage.removeItem('cf_access');
  localStorage.removeItem('cf_refresh');
}

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  const { refresh } = getTokens();
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) { clearTokens(); return null; }
    const data = await res.json();
    setTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { access } = getTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (access) headers['Authorization'] = `Bearer ${access}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/register') && !path.startsWith('/auth/refresh')) {
    if (!refreshing) refreshing = doRefresh().finally(() => { refreshing = null; });
    const newToken = await refreshing;
    if (newToken) {
      return apiFetch<T>(path, options, false);
    }
    clearTokens();
    window.location.href = '/login';
    throw new Error('Session expired');
  }

  if (!res.ok) {
    let err;
    try { err = await res.json(); } catch { err = { message: res.statusText }; }
    const msg = Array.isArray(err.message) ? err.message.join(', ') : (err.message ?? 'Request failed');
    throw new Error(msg);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}
