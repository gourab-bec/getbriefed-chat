// Thin API client; token kept in localStorage (MVP — move to httpOnly cookie for prod web).

export const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('clinkit_token') : null;
}
export function setToken(t) { localStorage.setItem('clinkit_token', t); }

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
