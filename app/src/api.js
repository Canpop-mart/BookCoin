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
  setGoal: (minutes) => req('/me/goal', { method: 'POST', body: { minutes } }),
  activity: () => req('/activity'),
  leaderboard: (period) => req('/leaderboard?period=' + period),
  profile: (id) => req('/profile/' + id),

  quests: () => req('/quests'),
  claimQuest: (id) => req(`/quests/${id}/claim`, { method: 'POST' }),

  rewards: () => req('/rewards'),
  redeemReward: (id) => req(`/rewards/${id}/redeem`, { method: 'POST' }),
  myRedemptions: () => req('/me/redemptions'),

  admin: {
    members: () => req('/admin/members'),
    createMember: (b) => req('/admin/members', { method: 'POST', body: b }),
    updateMember: (id, b) => req(`/admin/members/${id}`, { method: 'PATCH', body: b }),
    deleteMember: (id) => req(`/admin/members/${id}`, { method: 'DELETE' }),
    quests: () => req('/admin/quests'),
    createQuest: (b) => req('/admin/quests', { method: 'POST', body: b }),
    deleteQuest: (id) => req(`/admin/quests/${id}`, { method: 'DELETE' }),
    rewards: () => req('/admin/rewards'),
    createReward: (b) => req('/admin/rewards', { method: 'POST', body: b }),
    deleteReward: (id) => req(`/admin/rewards/${id}`, { method: 'DELETE' }),
    redemptions: () => req('/admin/redemptions'),
    fulfill: (id) => req(`/admin/redemptions/${id}/fulfill`, { method: 'POST' }),
    cancel: (id) => req(`/admin/redemptions/${id}/cancel`, { method: 'POST' }),
    claims: () => req('/admin/quest-claims'),
    approveClaim: (id) => req(`/admin/quest-claims/${id}/approve`, { method: 'POST' }),
    rejectClaim: (id) => req(`/admin/quest-claims/${id}/reject`, { method: 'POST' }),
  },
};
