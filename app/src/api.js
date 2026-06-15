import { store } from './store';

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (store.token) headers.Authorization = `Bearer ${store.token}`;
  const res = await fetch((store.serverUrl || '') + '/api' + path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 401 && path !== '/login') { store.logout(); }
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  members: () => req('/members'),
  login: (memberId, pin) => req('/login', { method: 'POST', body: { memberId, pin } }),
  logout: () => req('/logout', { method: 'POST' }),
  me: () => req('/me'),
  logSession: (data) => req('/sessions', { method: 'POST', body: data }),
  mySessions: () => req('/me/sessions'),
  leaderboard: (period) => req('/leaderboard?period=' + period),
  profile: (id) => req('/profile/' + id),
};
