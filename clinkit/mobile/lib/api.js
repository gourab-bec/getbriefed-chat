// Shared API client for the RN app. Point API_URL at your LAN IP for device testing.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';

let token = null;
export const setToken = (t) => { token = t; };
export const getToken = () => token;
export const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
}
