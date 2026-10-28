const API = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

export function apiBaseUrl(isProduction = process.env.NODE_ENV === 'production'): string {
  if (!API && isProduction) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL must be configured for production.');
  }
  return (API || 'http://localhost:4000').replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const base = apiBaseUrl();
  return `${base}${path.startsWith('/') ? path : '/' + path}`;
}

function orgHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const orgId = window.localStorage.getItem('sentinel:orgId');
  return orgId ? { 'X-Org-Id': orgId } : {};
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...orgHeaders(), ...(init.headers as any) },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message.join(', ') : j.message || msg;
    } catch { /* keep default */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function setOrgId(id: string) {
  window.localStorage.setItem('sentinel:orgId', id);
}
export function getOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('sentinel:orgId');
}
