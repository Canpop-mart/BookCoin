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
  ceremony: () => req('/ceremony'),
  markCeremonySeen: (month) => req('/ceremony/seen', { method: 'POST', body: { month } }),

  quests: () => req('/quests'),
  claimQuest: (id) => req(`/quests/${id}/claim`, { method: 'POST' }),

  rewards: () => req('/rewards'),
  createReward: (b) => req('/rewards', { method: 'POST', body: b }),
  archiveReward: (id) => req(`/rewards/${id}/archive`, { method: 'POST' }),
  redeemReward: (id) => req(`/rewards/${id}/redeem`, { method: 'POST' }),
  myRedemptions: () => req('/me/redemptions'),
  myOffers: () => req('/me/offers'),
  fulfillRedemption: (id) => req(`/redemptions/${id}/fulfill`, { method: 'POST' }),
  cancelRedemption: (id) => req(`/redemptions/${id}/cancel`, { method: 'POST' }),
  lists: () => req('/lists'),

  admin: {
    members: () => req('/admin/members'),
    createMember: (b) => req('/admin/members', { method: 'POST', body: b }),
    updateMember: (id, b) => req(`/admin/members/${id}`, { method: 'PATCH', body: b }),
    deleteMember: (id) => req(`/admin/members/${id}`, { method: 'DELETE' }),
    quests: () => req('/admin/quests'),
    createQuest: (b) => req('/admin/quests', { method: 'POST', body: b }),
    deleteQuest: (id) => req(`/admin/quests/${id}`, { method: 'DELETE' }),
    rewards: () => req('/admin/rewards'),
    approveReward: (id, b) => req(`/admin/rewards/${id}/approve`, { method: 'POST', body: b || {} }),
    denyReward: (id) => req(`/admin/rewards/${id}/deny`, { method: 'POST' }),
    deleteReward: (id) => req(`/admin/rewards/${id}`, { method: 'DELETE' }),
    redemptions: () => req('/admin/redemptions'),
    claims: () => req('/admin/quest-claims'),
    approveClaim: (id) => req(`/admin/quest-claims/${id}/approve`, { method: 'POST' }),
    rejectClaim: (id) => req(`/admin/quest-claims/${id}/reject`, { method: 'POST' }),
    createList: (b) => req('/admin/lists', { method: 'POST', body: b }),
    deleteList: (id) => req(`/admin/lists/${id}`, { method: 'DELETE' }),
    addBook: (listId, b) => req(`/admin/lists/${listId}/books`, { method: 'POST', body: b }),
    deleteBook: (bookId) => req(`/admin/lists/books/${bookId}`, { method: 'DELETE' }),
  },
};
