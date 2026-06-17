import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { baseCoins, COMFORT_ZONE_MULTIPLIER } from './coins.js';

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_ROOT = process.env.BOOKCOIN_STATIC ?? join(import.meta.dirname, '../../app/dist');

// --- helpers ---
const balance = (memberId) =>
  db.prepare('SELECT COALESCE(SUM(amount),0) AS bal FROM coin_txns WHERE member_id = ?').get(memberId).bal;

const publicMember = (m) => ({
  id: m.id, name: m.name, initials: m.initials, color: m.color,
  monthlyGoalMinutes: m.monthly_goal_minutes, role: m.role,
});

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM (UTC)
const safeParse = (s) => { try { return JSON.parse(s); } catch { return []; } };

const MEMBER_COLORS = ['#E0785A', '#8FA97C', '#D99A2B', '#C58BA6', '#7BA6C4', '#B07CC6', '#6FB0A0', '#D98C6A'];
const initialsFrom = (name) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)).toUpperCase();
};
const clampGoal = (v) => Math.max(30, Math.min(6000, Math.round(Number(v) || 900)));
const nextColor = () => MEMBER_COLORS[db.prepare('SELECT COUNT(*) AS n FROM members').get().n % MEMBER_COLORS.length];

const rowToSession = (r) => ({
  id: r.id, memberId: r.member_id, title: r.title, author: r.author, medium: r.medium,
  genres: safeParse(r.genres), minutes: r.minutes, pages: r.pages, summary: r.summary,
  quote: r.quote, coins: r.coins, multiplier: r.multiplier, createdAt: r.created_at,
});

const periodKeyFor = (quest) => (quest.period === 'month' ? monthKey() : 'once');

function questProgress(quest, memberId) {
  const monthly = quest.period === 'month';
  const filter = monthly ? "AND strftime('%Y-%m', created_at) = ?" : '';
  const args = monthly ? [memberId, monthKey()] : [memberId];
  switch (quest.type) {
    case 'minutes':
      return db.prepare(`SELECT COALESCE(SUM(minutes),0) AS v FROM sessions WHERE member_id = ? ${filter}`).get(...args).v;
    case 'sessions':
      return db.prepare(`SELECT COUNT(*) AS v FROM sessions WHERE member_id = ? ${filter}`).get(...args).v;
    case 'mediums':
      return db.prepare(`SELECT COUNT(DISTINCT medium) AS v FROM sessions WHERE member_id = ? ${filter}`).get(...args).v;
    case 'genres': {
      const rows = db.prepare(`SELECT genres FROM sessions WHERE member_id = ? ${filter}`).all(...args);
      const set = new Set();
      for (const r of rows) for (const g of safeParse(r.genres)) set.add(g);
      return set.size;
    }
    case 'streak': {
      const rows = db.prepare('SELECT DISTINCT substr(created_at,1,10) AS d FROM sessions WHERE member_id = ?').all(memberId);
      const days = new Set(rows.map((r) => r.d));
      let n = 0;
      const d = new Date();
      while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
      return n;
    }
    default:
      return 0; // manual: not auto-tracked
  }
}

function questView(q, memberId) {
  const pk = periodKeyFor(q);
  const claim = db.prepare('SELECT * FROM quest_claims WHERE quest_id = ? AND member_id = ? AND period_key = ?').get(q.id, memberId, pk);
  const progress = q.type === 'manual' ? (claim && claim.status !== 'rejected' ? q.target : 0) : questProgress(q, memberId);
  return {
    id: q.id, title: q.title, description: q.description, type: q.type, target: q.target,
    rewardCoins: q.reward_coins, period: q.period, requiresApproval: !!q.requires_approval,
    progress: Math.min(progress, q.target), rawProgress: progress,
    complete: progress >= q.target,
    claimStatus: claim ? claim.status : null,
  };
}

function longestStreak(daysAsc) {
  let best = 0, cur = 0, prev = null;
  for (const d of daysAsc) {
    cur = (prev && Date.parse(d) - Date.parse(prev) === 86400000) ? cur + 1 : 1;
    if (cur > best) best = cur;
    prev = d;
  }
  return best;
}

function computeBadges(memberId, totals) {
  const genreRows = db.prepare('SELECT genres FROM sessions WHERE member_id = ?').all(memberId);
  const genres = new Set();
  for (const r of genreRows) for (const g of safeParse(r.genres)) genres.add(g);
  const mediums = db.prepare('SELECT COUNT(DISTINCT medium) AS n FROM sessions WHERE member_id = ?').get(memberId).n;
  const days = db.prepare('SELECT DISTINCT substr(created_at,1,10) AS d FROM sessions WHERE member_id = ? ORDER BY d').all(memberId).map((r) => r.d);
  const streak = longestStreak(days);
  const questsDone = db.prepare("SELECT COUNT(*) AS n FROM quest_claims WHERE member_id = ? AND status IN ('claimed','approved')").get(memberId).n;
  const redeemed = db.prepare("SELECT COUNT(*) AS n FROM redemptions WHERE member_id = ? AND status != 'cancelled'").get(memberId).n;
  const earned = db.prepare('SELECT COALESCE(SUM(amount),0) AS n FROM coin_txns WHERE member_id = ? AND amount > 0').get(memberId).n;
  return [
    { id: 'first', name: 'First steps', icon: 'ti-seedling', desc: 'Log your first reading', earned: totals.sessions >= 1 },
    { id: 'bookworm', name: 'Bookworm', icon: 'ti-book', desc: 'Log 10 sessions', earned: totals.sessions >= 10 },
    { id: 'marathon', name: 'Marathoner', icon: 'ti-run', desc: 'Read 10 hours total', earned: totals.minutes >= 600 },
    { id: 'century', name: 'Century', icon: 'ti-stack', desc: 'Read 100 pages', earned: totals.pages >= 100 },
    { id: 'explorer', name: 'Explorer', icon: 'ti-compass', desc: 'Read 5 genres', earned: genres.size >= 5 },
    { id: 'omnivore', name: 'Omnivore', icon: 'ti-books', desc: 'Read 4 formats', earned: mediums >= 4 },
    { id: 'streak', name: 'On fire', icon: 'ti-flame', desc: 'A 7-day streak', earned: streak >= 7 },
    { id: 'quests', name: 'Quest hunter', icon: 'ti-wand', desc: 'Finish 5 quests', earned: questsDone >= 5 },
    { id: 'spender', name: 'Treat yourself', icon: 'ti-gift', desc: 'Redeem a reward', earned: redeemed >= 1 },
    { id: 'rich', name: 'Coin hoard', icon: 'ti-coins', desc: 'Earn 500 coins', earned: earned >= 500 },
  ];
}

// ===================== api =====================
const api = new Hono();

api.get('/health', (c) => c.json({ ok: true }));

api.get('/members', (c) =>
  c.json(db.prepare('SELECT id, name, initials, color FROM members ORDER BY id').all()));

api.post('/login', async (c) => {
  const { memberId, pin } = await c.req.json().catch(() => ({}));
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(memberId);
  if (!m || String(m.pin) !== String(pin)) return c.json({ error: 'Wrong PIN' }, 401);
  const token = randomUUID();
  db.prepare('INSERT INTO tokens (token, member_id) VALUES (?, ?)').run(token, m.id);
  return c.json({ token, member: publicMember(m) });
});

// ---- auth gate ----
api.use('*', async (c, next) => {
  const auth = c.req.header('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const row = token ? db.prepare('SELECT member_id FROM tokens WHERE token = ?').get(token) : null;
  const m = row ? db.prepare('SELECT * FROM members WHERE id = ?').get(row.member_id) : null;
  if (!m) return c.json({ error: 'Unauthorized' }, 401);
  c.set('member', m);
  c.set('token', token);
  await next();
});

// ---- admin gate (only /admin/*) ----
api.use('/admin/*', async (c, next) => {
  if (c.get('member').role !== 'admin') return c.json({ error: 'Admins only' }, 403);
  await next();
});

api.get('/me', (c) => {
  const m = c.get('member');
  return c.json({ member: publicMember(m), balance: balance(m.id) });
});

api.post('/logout', (c) => {
  db.prepare('DELETE FROM tokens WHERE token = ?').run(c.get('token'));
  return c.body(null, 204);
});

api.post('/sessions', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  const minutes = Math.max(0, Math.round(Number(b.minutes) || 0));
  if (minutes <= 0) return c.json({ error: 'Session needs some minutes' }, 400);
  const summary = (b.summary || '').trim();
  if (!summary) return c.json({ error: 'A few words about your reading are required' }, 400);

  const medium = b.medium || 'prose';
  const genres = Array.isArray(b.genres) ? b.genres.filter(Boolean) : [];

  const prior = db.prepare('SELECT genres FROM sessions WHERE member_id = ?').all(m.id);
  const seen = new Set();
  for (const r of prior) for (const g of safeParse(r.genres)) seen.add(g);
  const isNewGenre = genres.length > 0 && genres.every((g) => !seen.has(g));
  const multiplier = isNewGenre ? COMFORT_ZONE_MULTIPLIER : 1;
  const coins = Math.round(baseCoins(minutes) * multiplier);

  const info = db.prepare(
    `INSERT INTO sessions (member_id, title, author, medium, genres, minutes, pages, summary, quote, coins, multiplier)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    m.id, b.title || '', b.author || '', medium, JSON.stringify(genres), minutes,
    b.pages != null && b.pages !== '' ? Math.round(Number(b.pages)) : null,
    summary, b.quote || null, coins, multiplier
  );
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(m.id, coins, 'base-earn', info.lastInsertRowid);

  return c.json({ sessionId: Number(info.lastInsertRowid), coins, multiplier, isNewGenre, balance: balance(m.id) });
});

api.get('/me/sessions', (c) => {
  const m = c.get('member');
  return c.json(db.prepare('SELECT * FROM sessions WHERE member_id = ? ORDER BY id DESC LIMIT 50').all(m.id).map(rowToSession));
});

api.get('/leaderboard', (c) => {
  const period = c.req.query('period') === 'all' ? 'all' : 'month';
  const monthFilter = period === 'month' ? "AND strftime('%Y-%m', s.created_at) = ?" : '';
  const sql = `
    SELECT m.id AS memberId, m.name, m.initials, m.color, m.monthly_goal_minutes AS goal,
           COALESCE(SUM(s.minutes),0) AS minutes,
           COALESCE(SUM(s.pages),0) AS pages,
           COALESCE(SUM(s.coins),0) AS coins
    FROM members m
    LEFT JOIN sessions s ON s.member_id = m.id ${monthFilter}
    GROUP BY m.id
    ORDER BY minutes DESC, coins DESC`;
  const rows = period === 'month' ? db.prepare(sql).all(monthKey()) : db.prepare(sql).all();
  return c.json({ period, month: monthKey(), rows: rows.map((r, i) => ({ ...r, rank: i + 1 })) });
});

api.get('/profile/:id', (c) => {
  const id = Number(c.req.param('id'));
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) return c.json({ error: 'Not found' }, 404);
  const totals = db.prepare('SELECT COALESCE(SUM(minutes),0) AS minutes, COUNT(*) AS sessions, COALESCE(SUM(pages),0) AS pages FROM sessions WHERE member_id = ?').get(id);
  const byMedium = db.prepare('SELECT medium, SUM(minutes) AS minutes FROM sessions WHERE member_id = ? GROUP BY medium ORDER BY minutes DESC').all(id);
  const monthMinutes = db.prepare("SELECT COALESCE(SUM(minutes),0) AS minutes FROM sessions WHERE member_id = ? AND strftime('%Y-%m', created_at) = ?").get(id, monthKey()).minutes;
  const recent = db.prepare('SELECT * FROM sessions WHERE member_id = ? ORDER BY id DESC LIMIT 20').all(id).map(rowToSession);
  return c.json({ member: publicMember(m), balance: balance(id), totals, byMedium, monthMinutes, recent, badges: computeBadges(id, totals) });
});

api.post('/me/goal', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  const minutes = Math.max(30, Math.min(6000, Math.round(Number(b.minutes) || 0)));
  db.prepare('UPDATE members SET monthly_goal_minutes = ? WHERE id = ?').run(minutes, m.id);
  return c.json({ monthlyGoalMinutes: minutes });
});

api.get('/activity', (c) => {
  const rows = db.prepare(`
    SELECT s.id, s.title, s.minutes, s.medium, s.created_at AS createdAt, s.genres,
           m.name, m.initials, m.color
    FROM sessions s JOIN members m ON m.id = s.member_id
    ORDER BY s.id DESC LIMIT 10`).all();
  return c.json(rows.map((r) => ({ ...r, genres: safeParse(r.genres) })));
});

// ---- quests ----
api.get('/quests', (c) => {
  const m = c.get('member');
  const quests = db.prepare('SELECT * FROM quests WHERE active = 1 ORDER BY id').all();
  return c.json(quests.map((q) => questView(q, m.id)));
});

api.post('/quests/:id/claim', (c) => {
  const m = c.get('member');
  const q = db.prepare('SELECT * FROM quests WHERE id = ? AND active = 1').get(Number(c.req.param('id')));
  if (!q) return c.json({ error: 'Quest not found' }, 404);
  const pk = periodKeyFor(q);
  const existing = db.prepare('SELECT * FROM quest_claims WHERE quest_id = ? AND member_id = ? AND period_key = ?').get(q.id, m.id, pk);
  if (existing && existing.status !== 'rejected') return c.json({ error: 'Already claimed this period' }, 400);
  if (existing) db.prepare('DELETE FROM quest_claims WHERE id = ?').run(existing.id);

  const manualPending = q.type === 'manual' && q.requires_approval;
  if (!manualPending && q.type !== 'manual') {
    const prog = questProgress(q, m.id);
    if (prog < q.target) return c.json({ error: 'Not finished yet' }, 400);
  }

  if (manualPending) {
    db.prepare('INSERT INTO quest_claims (quest_id, member_id, period_key, status, coins_awarded) VALUES (?, ?, ?, ?, 0)')
      .run(q.id, m.id, pk, 'pending');
    return c.json({ status: 'pending' });
  }
  db.prepare('INSERT INTO quest_claims (quest_id, member_id, period_key, status, coins_awarded) VALUES (?, ?, ?, ?, ?)')
    .run(q.id, m.id, pk, 'claimed', q.reward_coins);
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(m.id, q.reward_coins, 'quest', q.id);
  return c.json({ status: 'claimed', coins: q.reward_coins, balance: balance(m.id) });
});

// ---- rewards / shop ----
api.get('/rewards', (c) => {
  const m = c.get('member');
  const rewards = db.prepare('SELECT * FROM rewards WHERE active = 1 ORDER BY cost_coins').all().map((r) => ({
    id: r.id, name: r.name, description: r.description, costCoins: r.cost_coins, tier: r.tier, stock: r.stock,
  }));
  return c.json({ balance: balance(m.id), rewards });
});

api.post('/rewards/:id/redeem', (c) => {
  const m = c.get('member');
  const r = db.prepare('SELECT * FROM rewards WHERE id = ? AND active = 1').get(Number(c.req.param('id')));
  if (!r) return c.json({ error: 'Reward not found' }, 404);
  if (balance(m.id) < r.cost_coins) return c.json({ error: 'Not enough coins yet' }, 400);
  if (r.stock != null && r.stock <= 0) return c.json({ error: 'Out of stock' }, 400);

  const info = db.prepare('INSERT INTO redemptions (reward_id, member_id, cost_coins, status) VALUES (?, ?, ?, ?)')
    .run(r.id, m.id, r.cost_coins, 'requested');
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(m.id, -r.cost_coins, 'spend', Number(info.lastInsertRowid));
  if (r.stock != null) db.prepare('UPDATE rewards SET stock = stock - 1 WHERE id = ?').run(r.id);
  return c.json({ status: 'requested', balance: balance(m.id) });
});

api.get('/me/redemptions', (c) => {
  const m = c.get('member');
  const rows = db.prepare(`
    SELECT rd.id, rd.cost_coins AS costCoins, rd.status, rd.created_at AS createdAt, r.name
    FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id
    WHERE rd.member_id = ? ORDER BY rd.id DESC LIMIT 30`).all(m.id);
  return c.json(rows);
});

// ===================== admin =====================
api.get('/admin/quests', (c) =>
  c.json(db.prepare('SELECT * FROM quests ORDER BY active DESC, id DESC').all()));

api.post('/admin/quests', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  if (!b.title) return c.json({ error: 'Title required' }, 400);
  const type = ['minutes', 'sessions', 'genres', 'mediums', 'streak', 'manual'].includes(b.type) ? b.type : 'manual';
  const period = b.period === 'once' ? 'once' : 'month';
  const info = db.prepare(
    'INSERT INTO quests (title, description, type, target, reward_coins, period, requires_approval, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(b.title, b.description || '', type, Math.max(1, Math.round(Number(b.target) || 1)),
        Math.max(0, Math.round(Number(b.rewardCoins) || 0)), period, b.requiresApproval ? 1 : 0, m.id);
  return c.json({ id: Number(info.lastInsertRowid) });
});

api.delete('/admin/quests/:id', (c) => {
  db.prepare('UPDATE quests SET active = 0 WHERE id = ?').run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.get('/admin/rewards', (c) =>
  c.json(db.prepare('SELECT * FROM rewards ORDER BY active DESC, cost_coins').all()));

api.post('/admin/rewards', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!b.name) return c.json({ error: 'Name required' }, 400);
  const tier = ['low', 'mid', 'high'].includes(b.tier) ? b.tier : 'low';
  const stock = b.stock === '' || b.stock == null ? null : Math.max(0, Math.round(Number(b.stock)));
  const info = db.prepare('INSERT INTO rewards (name, description, cost_coins, tier, stock) VALUES (?, ?, ?, ?, ?)')
    .run(b.name, b.description || '', Math.max(0, Math.round(Number(b.costCoins) || 0)), tier, stock);
  return c.json({ id: Number(info.lastInsertRowid) });
});

api.delete('/admin/rewards/:id', (c) => {
  db.prepare('UPDATE rewards SET active = 0 WHERE id = ?').run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.get('/admin/redemptions', (c) => {
  const rows = db.prepare(`
    SELECT rd.id, rd.cost_coins AS costCoins, rd.status, rd.created_at AS createdAt,
           r.name, m.name AS member, m.initials, m.color
    FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id JOIN members m ON m.id = rd.member_id
    ORDER BY (rd.status = 'requested') DESC, rd.id DESC LIMIT 60`).all();
  return c.json(rows);
});

api.post('/admin/redemptions/:id/fulfill', (c) => {
  db.prepare("UPDATE redemptions SET status = 'fulfilled' WHERE id = ? AND status = 'requested'").run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.post('/admin/redemptions/:id/cancel', (c) => {
  const rd = db.prepare("SELECT * FROM redemptions WHERE id = ? AND status = 'requested'").get(Number(c.req.param('id')));
  if (!rd) return c.json({ error: 'Not cancellable' }, 400);
  db.prepare("UPDATE redemptions SET status = 'cancelled' WHERE id = ?").run(rd.id);
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(rd.member_id, rd.cost_coins, 'refund', rd.id);
  db.prepare('UPDATE rewards SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL').run(rd.reward_id);
  return c.body(null, 204);
});

api.get('/admin/quest-claims', (c) => {
  const rows = db.prepare(`
    SELECT qc.id, qc.status, qc.created_at AS createdAt, q.title, q.reward_coins AS rewardCoins,
           m.name AS member, m.initials, m.color
    FROM quest_claims qc JOIN quests q ON q.id = qc.quest_id JOIN members m ON m.id = qc.member_id
    WHERE qc.status = 'pending' ORDER BY qc.id DESC`).all();
  return c.json(rows);
});

api.post('/admin/quest-claims/:id/approve', (c) => {
  const qc = db.prepare("SELECT * FROM quest_claims WHERE id = ? AND status = 'pending'").get(Number(c.req.param('id')));
  if (!qc) return c.json({ error: 'Not pending' }, 400);
  const q = db.prepare('SELECT * FROM quests WHERE id = ?').get(qc.quest_id);
  db.prepare("UPDATE quest_claims SET status = 'approved', coins_awarded = ? WHERE id = ?").run(q.reward_coins, qc.id);
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(qc.member_id, q.reward_coins, 'quest', q.id);
  return c.body(null, 204);
});

api.post('/admin/quest-claims/:id/reject', (c) => {
  db.prepare("UPDATE quest_claims SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(Number(c.req.param('id')));
  return c.body(null, 204);
});

// ---- admin: members ----
api.get('/admin/members', (c) =>
  c.json(db.prepare('SELECT id, name, initials, color, role, monthly_goal_minutes AS monthlyGoalMinutes FROM members ORDER BY id').all()));

api.post('/admin/members', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  const name = (b.name || '').trim();
  if (!name) return c.json({ error: 'Name required' }, 400);
  if (!b.pin) return c.json({ error: 'PIN required' }, 400);
  const initials = (b.initials || initialsFrom(name)).slice(0, 2).toUpperCase();
  const role = b.role === 'admin' ? 'admin' : 'member';
  try {
    const info = db.prepare('INSERT INTO members (name, initials, color, pin, role, monthly_goal_minutes) VALUES (?, ?, ?, ?, ?, ?)')
      .run(name, initials, b.color || nextColor(), String(b.pin), role, clampGoal(b.monthlyGoalMinutes));
    return c.json({ id: Number(info.lastInsertRowid) });
  } catch {
    return c.json({ error: 'That name is taken' }, 400);
  }
});

api.patch('/admin/members/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const name = b.name != null && String(b.name).trim() ? String(b.name).trim() : m.name;
  const role = b.role ? (b.role === 'admin' ? 'admin' : 'member') : m.role;
  if (m.role === 'admin' && role !== 'admin'
      && db.prepare("SELECT COUNT(*) AS n FROM members WHERE role='admin'").get().n <= 1) {
    return c.json({ error: 'Keep at least one admin' }, 400);
  }
  const goal = b.monthlyGoalMinutes != null ? clampGoal(b.monthlyGoalMinutes) : m.monthly_goal_minutes;
  try {
    db.prepare('UPDATE members SET name = ?, initials = ?, color = ?, role = ?, monthly_goal_minutes = ? WHERE id = ?')
      .run(name, (b.initials || initialsFrom(name)).slice(0, 2).toUpperCase(), b.color || m.color, role, goal, id);
  } catch {
    return c.json({ error: 'That name is taken' }, 400);
  }
  if (b.pin) db.prepare('UPDATE members SET pin = ? WHERE id = ?').run(String(b.pin), id);
  return c.json({ ok: true });
});

api.delete('/admin/members/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (id === c.get('member').id) return c.json({ error: "You can't delete yourself" }, 400);
  const m = db.prepare('SELECT * FROM members WHERE id = ?').get(id);
  if (!m) return c.json({ error: 'Not found' }, 404);
  if (m.role === 'admin' && db.prepare("SELECT COUNT(*) AS n FROM members WHERE role='admin'").get().n <= 1) {
    return c.json({ error: 'Keep at least one admin' }, 400);
  }
  db.exec('BEGIN');
  try {
    for (const t of ['tokens', 'coin_txns', 'quest_claims', 'redemptions', 'sessions']) {
      db.prepare(`DELETE FROM ${t} WHERE member_id = ?`).run(id);
    }
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
    db.exec('COMMIT');
  } catch {
    db.exec('ROLLBACK');
    return c.json({ error: 'Could not delete member' }, 500);
  }
  return c.body(null, 204);
});

// unknown /api/* routes return JSON 404 (never fall through to the SPA shell,
// so a stale server/app mismatch fails cleanly instead of returning HTML)
api.all('*', (c) => c.json({ error: 'Unknown endpoint' }, 404));

// ===================== app wiring =====================
const app = new Hono();
app.use('*', cors());
app.route('/api', api);

if (existsSync(STATIC_ROOT)) {
  app.use('/*', serveStatic({ root: STATIC_ROOT }));
  const indexHtml = existsSync(join(STATIC_ROOT, 'index.html')) ? readFileSync(join(STATIC_ROOT, 'index.html'), 'utf8') : null;
  app.get('*', (c) => (indexHtml ? c.html(indexHtml) : c.text('Not found', 404)));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[bookcoin] server on http://localhost:${info.port}`);
  console.log(`[bookcoin] web UI: ${existsSync(STATIC_ROOT) ? 'serving ' + STATIC_ROOT : 'not built — run the Vite dev server (pnpm dev:app)'}`);
});
