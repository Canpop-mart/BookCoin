import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { db } from './db.js';
import { baseCoins, COMFORT_ZONE_MULTIPLIER } from './coins.js';
import { startBackups } from './backup.js';

const PORT = Number(process.env.PORT ?? 8787);
const STATIC_ROOT = process.env.BOOKCOIN_STATIC ?? join(import.meta.dirname, '../../app/dist');

// --- helpers ---
const balance = (memberId) =>
  db.prepare('SELECT COALESCE(SUM(amount),0) AS bal FROM coin_txns WHERE member_id = ?').get(memberId).bal;

const publicMember = (m) => ({
  id: m.id, name: m.name, initials: m.initials, color: m.color,
  monthlyGoalMinutes: m.monthly_goal_minutes, role: m.role,
  theme: m.theme || 'classic', emblem: m.emblem || '', mascot: m.mascot || 'wizard',
  onboarded: !!m.onboarded,
});

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM (UTC)
const nowStr = () => new Date().toISOString().slice(0, 19).replace('T', ' '); // matches SQLite datetime('now')
const safeParse = (s) => { try { return JSON.parse(s); } catch { return []; } };

const MEMBER_COLORS = ['#E0785A', '#8FA97C', '#D99A2B', '#C58BA6', '#7BA6C4', '#B07CC6', '#6FB0A0', '#D98C6A'];
const initialsFrom = (name) => {
  const parts = name.trim().split(/\s+/);
  return (parts.length >= 2 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)).toUpperCase();
};
const clampGoal = (v) => Math.max(30, Math.min(6000, Math.round(Number(v) || 900)));
const nextColor = () => MEMBER_COLORS[db.prepare('SELECT COUNT(*) AS n FROM members').get().n % MEMBER_COLORS.length];

// Fulfill/cancel a redemption — allowed for the reward's owner or any admin.
function doFulfill(rdId, by) {
  const rd = db.prepare("SELECT * FROM redemptions WHERE id = ? AND status = 'requested'").get(rdId);
  if (!rd) return { code: 400, error: 'Not fulfillable' };
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rd.reward_id);
  if (by.role !== 'admin' && r.owner_id !== by.id) return { code: 403, error: 'Not allowed' };
  db.prepare("UPDATE redemptions SET status = 'fulfilled' WHERE id = ?").run(rd.id);
  const cut = Math.round((rd.cost_coins * (r.owner_cut || 0)) / 100); // rest is sunk
  if (cut > 0 && r.owner_id) {
    db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
      .run(r.owner_id, cut, 'reward-earnings', rd.id);
  }
  return { code: 200, ok: true, cut };
}
function doCancel(rdId, by) {
  const rd = db.prepare("SELECT * FROM redemptions WHERE id = ? AND status = 'requested'").get(rdId);
  if (!rd) return { code: 400, error: 'Not cancellable' };
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(rd.reward_id);
  if (by.role !== 'admin' && r.owner_id !== by.id) return { code: 403, error: 'Not allowed' };
  db.prepare("UPDATE redemptions SET status = 'cancelled' WHERE id = ?").run(rd.id);
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(rd.member_id, rd.cost_coins, 'refund', rd.id);
  db.prepare('UPDATE rewards SET stock = stock + 1 WHERE id = ? AND stock IS NOT NULL').run(rd.reward_id);
  return { code: 200, ok: true };
}

// --- month-end finalization: rank bonuses + secret bonus stars ---
const RANK_BONUS = [300, 200, 100];
const STAR_COINS = 100;
const STAR_DEFS = [
  { key: 'genres', label: 'Explorer', icon: 'ti-compass', desc: 'Most genres' },
  { key: 'sessions', label: 'Bookworm', icon: 'ti-book', desc: 'Most sessions' },
  { key: 'pages', label: 'Page-Turner', icon: 'ti-files', desc: 'Most pages' },
  { key: 'days', label: 'Most consistent', icon: 'ti-flame', desc: 'Most days read' },
  { key: 'formats', label: 'Omnivore', icon: 'ti-books', desc: 'Most formats' },
];

function finalizeMonth(month) {
  const standings = db.prepare(`
    SELECT m.id, m.name, m.initials, m.color,
           COALESCE(SUM(s.minutes),0) AS minutes, COALESCE(SUM(s.pages),0) AS pages, COUNT(s.id) AS sessions
    FROM members m JOIN sessions s ON s.member_id = m.id AND strftime('%Y-%m', s.created_at) = ?
    GROUP BY m.id ORDER BY minutes DESC, sessions DESC`).all(month);

  const rows = db.prepare("SELECT member_id, genres, medium, pages, substr(created_at,1,10) AS day FROM sessions WHERE strftime('%Y-%m', created_at) = ?").all(month);
  const agg = {};
  for (const r of rows) {
    const a = (agg[r.member_id] ||= { genres: new Set(), formats: new Set(), pages: 0, sessions: 0, days: new Set() });
    for (const g of safeParse(r.genres)) a.genres.add(g);
    a.formats.add(r.medium);
    a.pages += r.pages || 0;
    a.sessions += 1;
    a.days.add(r.day);
  }
  const valueOf = (a, key) => key === 'genres' ? a.genres.size : key === 'formats' ? a.formats.size
    : key === 'days' ? a.days.size : key === 'pages' ? a.pages : a.sessions;
  const info = (id) => db.prepare('SELECT name, initials, color FROM members WHERE id = ?').get(id);

  const stars = STAR_DEFS.map((def) => {
    let best = 0; let winners = [];
    for (const [id, a] of Object.entries(agg)) {
      const v = valueOf(a, def.key);
      if (v > best) { best = v; winners = [Number(id)]; }
      else if (v === best && v > 0) winners.push(Number(id));
    }
    return { ...def, value: best, winners: best > 0 ? winners.map((id) => ({ id, ...info(id) })) : [] };
  });

  const out = standings.map((s, i) => ({ ...s, rank: i + 1, bonus: i < 3 ? RANK_BONUS[i] : 0 }));
  for (const s of out) if (s.bonus > 0) {
    db.prepare("INSERT INTO coin_txns (member_id, amount, reason) VALUES (?, ?, 'rank-bonus')").run(s.id, s.bonus);
  }
  for (const st of stars) for (const w of st.winners) {
    db.prepare("INSERT INTO coin_txns (member_id, amount, reason) VALUES (?, ?, 'star')").run(w.id, STAR_COINS);
  }
  const allGenres = new Set();
  for (const a of Object.values(agg)) for (const g of a.genres) allGenres.add(g);
  const longest = db.prepare("SELECT s.minutes AS minutes, m.name AS name FROM sessions s JOIN members m ON m.id = s.member_id WHERE strftime('%Y-%m', s.created_at) = ? ORDER BY s.minutes DESC LIMIT 1").get(month);
  const stats = {
    totalMinutes: out.reduce((a, s) => a + s.minutes, 0),
    totalPages: out.reduce((a, s) => a + s.pages, 0),
    totalSessions: out.reduce((a, s) => a + s.sessions, 0),
    genres: allGenres.size,
    longest: longest ? { minutes: longest.minutes, name: longest.name } : null,
  };
  const [yy, mm] = month.split('-').map(Number);
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const dayRows = db.prepare("SELECT member_id AS id, CAST(substr(created_at, 9, 2) AS INTEGER) AS d, SUM(minutes) AS m FROM sessions WHERE strftime('%Y-%m', created_at) = ? GROUP BY member_id, d").all(month);
  const series = out.slice(0, 5).map((s) => {
    const perDay = new Array(daysInMonth).fill(0);
    for (const r of dayRows) if (r.id === s.id) perDay[r.d - 1] = r.m;
    let cum = 0;
    return { id: s.id, name: s.name, color: s.color, points: perDay.map((v) => (cum += v)) };
  });

  db.prepare('INSERT INTO month_summaries (month, data) VALUES (?, ?)')
    .run(month, JSON.stringify({ month, standings: out, stars, starCoins: STAR_COINS, stats, series }));
  console.log(`[bookcoin] finalized ${month}: ${out.length} readers, ${stars.filter((s) => s.winners.length).length} stars`);
}

function runFinalization() {
  const current = monthKey();
  const months = db.prepare("SELECT DISTINCT strftime('%Y-%m', created_at) AS m FROM sessions WHERE strftime('%Y-%m', created_at) < ? ORDER BY m").all(current).map((r) => r.m);
  for (const m of months) {
    if (!db.prepare('SELECT 1 FROM month_summaries WHERE month = ?').get(m)) {
      try { finalizeMonth(m); } catch (e) { console.error('[bookcoin] finalize failed for', m, e); }
    }
  }
}

const rowToSession = (r) => ({
  id: r.id, memberId: r.member_id, title: r.title, author: r.author, medium: r.medium,
  genres: safeParse(r.genres), minutes: r.minutes, pages: r.pages, summary: r.summary,
  quote: r.quote, coins: r.coins, multiplier: r.multiplier, createdAt: r.created_at,
});

const rowToBook = (b) => ({
  id: b.id, memberId: b.member_id, title: b.title, author: b.author, status: b.status,
  rating: b.rating, startedAt: b.started_at, finishedAt: b.finished_at, createdAt: b.created_at,
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
    { id: 'rich', name: 'Coin hoard', icon: 'ti-coins', desc: 'Earn 1,000 coins', earned: earned >= 1000 },
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

// ---- personal bookshelf ----
const BOOK_STATUSES = ['want', 'reading', 'finished'];

api.get('/me/books', (c) => {
  const m = c.get('member');
  const rows = db.prepare('SELECT * FROM member_books WHERE member_id = ? ORDER BY COALESCE(finished_at, started_at, created_at) DESC, id DESC').all(m.id);
  return c.json(rows.map(rowToBook));
});

api.post('/me/books', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  const title = (b.title || '').trim();
  if (!title) return c.json({ error: 'Title required' }, 400);
  const status = BOOK_STATUSES.includes(b.status) ? b.status : 'reading';
  const now = nowStr();
  const info = db.prepare('INSERT INTO member_books (member_id, title, author, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(m.id, title, (b.author || '').trim(), status,
         status === 'want' ? null : now, status === 'finished' ? now : null);
  return c.json(rowToBook(db.prepare('SELECT * FROM member_books WHERE id = ?').get(Number(info.lastInsertRowid))));
});

api.patch('/me/books/:id', async (c) => {
  const m = c.get('member');
  const id = Number(c.req.param('id'));
  const bk = db.prepare('SELECT * FROM member_books WHERE id = ? AND member_id = ?').get(id, m.id);
  if (!bk) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const title = b.title != null && String(b.title).trim() ? String(b.title).trim() : bk.title;
  const author = b.author != null ? String(b.author).trim() : bk.author;
  const status = BOOK_STATUSES.includes(b.status) ? b.status : bk.status;
  const rating = b.rating != null ? (b.rating ? Math.max(1, Math.min(5, Math.round(Number(b.rating)))) : null) : bk.rating;
  // stamp transitions: first time it starts / finishes
  const startedAt = bk.started_at || (status !== 'want' ? nowStr() : null);
  const finishedAt = status === 'finished' ? (bk.finished_at || nowStr()) : null;
  db.prepare('UPDATE member_books SET title = ?, author = ?, status = ?, rating = ?, started_at = ?, finished_at = ? WHERE id = ?')
    .run(title, author, status, status === 'finished' ? rating : (status === 'want' ? null : rating), startedAt, finishedAt, id);
  return c.json(rowToBook(db.prepare('SELECT * FROM member_books WHERE id = ?').get(id)));
});

api.delete('/me/books/:id', (c) => {
  const m = c.get('member');
  db.prepare('DELETE FROM member_books WHERE id = ? AND member_id = ?').run(Number(c.req.param('id')), m.id);
  return c.body(null, 204);
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
  const shelf = {
    reading: db.prepare("SELECT * FROM member_books WHERE member_id = ? AND status = 'reading' ORDER BY COALESCE(started_at, created_at) DESC, id DESC").all(id).map(rowToBook),
    finishedRecent: db.prepare("SELECT * FROM member_books WHERE member_id = ? AND status = 'finished' ORDER BY COALESCE(finished_at, created_at) DESC, id DESC LIMIT 18").all(id).map(rowToBook),
    finishedTotal: db.prepare("SELECT COUNT(*) AS n FROM member_books WHERE member_id = ? AND status = 'finished'").get(id).n,
    finishedThisYear: db.prepare("SELECT COUNT(*) AS n FROM member_books WHERE member_id = ? AND status = 'finished' AND strftime('%Y', COALESCE(finished_at, created_at)) = strftime('%Y','now')").get(id).n,
    wantTotal: db.prepare("SELECT COUNT(*) AS n FROM member_books WHERE member_id = ? AND status = 'want'").get(id).n,
  };
  return c.json({ member: publicMember(m), balance: balance(id), totals, byMedium, monthMinutes, recent, shelf, badges: computeBadges(id, totals) });
});

api.post('/me/goal', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  const minutes = Math.max(30, Math.min(6000, Math.round(Number(b.minutes) || 0)));
  db.prepare('UPDATE members SET monthly_goal_minutes = ? WHERE id = ?').run(minutes, m.id);
  return c.json({ monthlyGoalMinutes: minutes });
});

// mark the first-run tutorial as seen (once per member)
api.post('/me/onboarded', (c) => {
  const m = c.get('member');
  db.prepare('UPDATE members SET onboarded = 1 WHERE id = ?').run(m.id);
  return c.json(publicMember(db.prepare('SELECT * FROM members WHERE id = ?').get(m.id)));
});

// free personalization — members style their own profile/app (not a coin sink)
const THEMES = ['classic', 'rose', 'plum', 'ocean', 'forest', 'evening'];
const MASCOTS = ['wizard', 'owl', 'fox', 'cat'];
api.post('/me/appearance', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  const theme = THEMES.includes(b.theme) ? b.theme : m.theme;
  const mascot = MASCOTS.includes(b.mascot) ? b.mascot : m.mascot;
  const emblem = b.emblem != null ? String(b.emblem).slice(0, 8) : m.emblem;
  const color = b.color != null && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : m.color;
  db.prepare('UPDATE members SET theme = ?, mascot = ?, emblem = ?, color = ? WHERE id = ?').run(theme, mascot, emblem, color, m.id);
  return c.json(publicMember(db.prepare('SELECT * FROM members WHERE id = ?').get(m.id)));
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
  const rewards = db.prepare(`
    SELECT r.id, r.name, r.description, r.cost_coins AS costCoins, r.tier, r.stock, r.owner_cut AS ownerCut,
           r.owner_id AS ownerId, o.name AS ownerName, o.initials AS ownerInitials, o.color AS ownerColor
    FROM rewards r LEFT JOIN members o ON o.id = r.owner_id
    WHERE r.status = 'approved' ORDER BY r.cost_coins`).all();
  return c.json({ balance: balance(m.id), rewards });
});

// any member can offer a reward (members' offers await admin approval; admins' go live)
api.post('/rewards', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  if (!(b.name || '').trim()) return c.json({ error: 'Name required' }, 400);
  const tier = ['low', 'mid', 'high'].includes(b.tier) ? b.tier : 'mid';
  const stock = b.stock === '' || b.stock == null ? null : Math.max(0, Math.round(Number(b.stock)));
  const cut = Math.max(0, Math.min(100, Math.round(Number(b.ownerCut ?? 50))));
  const status = m.role === 'admin' ? 'approved' : 'pending';
  const info = db.prepare(
    'INSERT INTO rewards (name, description, cost_coins, tier, stock, owner_id, owner_cut, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(b.name.trim(), b.description || '', Math.max(0, Math.round(Number(b.costCoins) || 0)), tier, stock, m.id, cut, status);
  return c.json({ id: Number(info.lastInsertRowid), status });
});

api.post('/rewards/:id/redeem', (c) => {
  const m = c.get('member');
  const r = db.prepare("SELECT * FROM rewards WHERE id = ? AND status = 'approved'").get(Number(c.req.param('id')));
  if (!r) return c.json({ error: 'Reward not found' }, 404);
  if (r.owner_id === m.id) return c.json({ error: "That's your own reward" }, 400);
  if (balance(m.id) < r.cost_coins) return c.json({ error: 'Not enough coins yet' }, 400);
  if (r.stock != null && r.stock <= 0) return c.json({ error: 'Out of stock' }, 400);

  const info = db.prepare('INSERT INTO redemptions (reward_id, member_id, cost_coins, status) VALUES (?, ?, ?, ?)')
    .run(r.id, m.id, r.cost_coins, 'requested');
  db.prepare('INSERT INTO coin_txns (member_id, amount, reason, ref_id) VALUES (?, ?, ?, ?)')
    .run(m.id, -r.cost_coins, 'spend', Number(info.lastInsertRowid));
  if (r.stock != null) db.prepare('UPDATE rewards SET stock = stock - 1 WHERE id = ?').run(r.id);
  return c.json({ status: 'requested', balance: balance(m.id) });
});

api.post('/rewards/:id/archive', (c) => {
  const m = c.get('member');
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(Number(c.req.param('id')));
  if (!r) return c.json({ error: 'Not found' }, 404);
  if (m.role !== 'admin' && r.owner_id !== m.id) return c.json({ error: 'Not allowed' }, 403);
  db.prepare("UPDATE rewards SET status = 'archived' WHERE id = ?").run(r.id);
  return c.body(null, 204);
});

api.get('/me/redemptions', (c) => {
  const m = c.get('member');
  const rows = db.prepare(`
    SELECT rd.id, rd.cost_coins AS costCoins, rd.status, rd.created_at AS createdAt, r.name
    FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id
    WHERE rd.member_id = ? ORDER BY rd.id DESC LIMIT 30`).all(m.id);
  return c.json(rows);
});

// rewards I offer + redemptions of mine waiting for me to deliver
api.get('/me/offers', (c) => {
  const m = c.get('member');
  const mine = db.prepare(
    "SELECT id, name, cost_coins AS costCoins, status, owner_cut AS ownerCut FROM rewards WHERE owner_id = ? AND status != 'archived' ORDER BY id DESC"
  ).all(m.id);
  const toFulfill = db.prepare(`
    SELECT rd.id, rd.cost_coins AS costCoins, rd.created_at AS createdAt, r.name, r.owner_cut AS ownerCut,
           mem.name AS member, mem.initials, mem.color
    FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id JOIN members mem ON mem.id = rd.member_id
    WHERE r.owner_id = ? AND rd.status = 'requested' ORDER BY rd.id DESC`).all(m.id);
  return c.json({ mine, toFulfill });
});

api.post('/redemptions/:id/fulfill', (c) => {
  const r = doFulfill(Number(c.req.param('id')), c.get('member'));
  return r.ok ? c.json(r) : c.json({ error: r.error }, r.code);
});
api.post('/redemptions/:id/cancel', (c) => {
  const r = doCancel(Number(c.req.param('id')), c.get('member'));
  return r.ok ? c.json(r) : c.json({ error: r.error }, r.code);
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

api.patch('/admin/quests/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const q = db.prepare('SELECT * FROM quests WHERE id = ?').get(id);
  if (!q) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const title = b.title != null && String(b.title).trim() ? String(b.title).trim() : q.title;
  const type = ['minutes', 'sessions', 'genres', 'mediums', 'streak', 'manual'].includes(b.type) ? b.type : q.type;
  const period = b.period ? (b.period === 'once' ? 'once' : 'month') : q.period;
  const target = b.target != null ? Math.max(1, Math.round(Number(b.target) || 1)) : q.target;
  const coins = b.rewardCoins != null ? Math.max(0, Math.round(Number(b.rewardCoins) || 0)) : q.reward_coins;
  const appr = b.requiresApproval != null ? (b.requiresApproval ? 1 : 0) : q.requires_approval;
  const desc = b.description != null ? String(b.description) : q.description;
  db.prepare('UPDATE quests SET title = ?, description = ?, type = ?, target = ?, reward_coins = ?, period = ?, requires_approval = ? WHERE id = ?')
    .run(title, desc, type, target, coins, period, appr, id);
  return c.json({ ok: true });
});

api.delete('/admin/quests/:id', (c) => {
  db.prepare('UPDATE quests SET active = 0 WHERE id = ?').run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.get('/admin/rewards', (c) =>
  c.json(db.prepare(`
    SELECT r.id, r.name, r.description, r.cost_coins AS costCoins, r.tier, r.stock, r.status, r.owner_cut AS ownerCut, o.name AS ownerName
    FROM rewards r LEFT JOIN members o ON o.id = r.owner_id
    WHERE r.status NOT IN ('archived', 'denied')
    ORDER BY (r.status = 'pending') DESC, r.cost_coins`).all()));

api.post('/admin/rewards/:id/approve', async (c) => {
  const id = Number(c.req.param('id'));
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  if (!r) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const cost = b.costCoins != null ? Math.max(0, Math.round(Number(b.costCoins))) : r.cost_coins;
  const cut = b.ownerCut != null ? Math.max(0, Math.min(100, Math.round(Number(b.ownerCut)))) : r.owner_cut;
  db.prepare("UPDATE rewards SET status = 'approved', cost_coins = ?, owner_cut = ? WHERE id = ?").run(cost, cut, id);
  return c.body(null, 204);
});

api.post('/admin/rewards/:id/deny', (c) => {
  db.prepare("UPDATE rewards SET status = 'denied' WHERE id = ?").run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.patch('/admin/rewards/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const r = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  if (!r) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const name = b.name != null && String(b.name).trim() ? String(b.name).trim() : r.name;
  const desc = b.description != null ? String(b.description) : r.description;
  const cost = b.costCoins != null ? Math.max(0, Math.round(Number(b.costCoins) || 0)) : r.cost_coins;
  const tier = ['low', 'mid', 'high'].includes(b.tier) ? b.tier : r.tier;
  const cut = b.ownerCut != null ? Math.max(0, Math.min(100, Math.round(Number(b.ownerCut) || 0))) : r.owner_cut;
  let stock = r.stock;
  if (b.stock !== undefined) stock = (b.stock === '' || b.stock == null) ? null : Math.max(0, Math.round(Number(b.stock) || 0));
  db.prepare('UPDATE rewards SET name = ?, description = ?, cost_coins = ?, tier = ?, stock = ?, owner_cut = ? WHERE id = ?')
    .run(name, desc, cost, tier, stock, cut, id);
  return c.json({ ok: true });
});

api.delete('/admin/rewards/:id', (c) => {
  db.prepare("UPDATE rewards SET status = 'archived' WHERE id = ?").run(Number(c.req.param('id')));
  return c.body(null, 204);
});

api.get('/admin/redemptions', (c) => {
  const rows = db.prepare(`
    SELECT rd.id, rd.cost_coins AS costCoins, rd.status, rd.created_at AS createdAt,
           r.name, o.name AS owner, m.name AS member, m.initials, m.color
    FROM redemptions rd JOIN rewards r ON r.id = rd.reward_id JOIN members m ON m.id = rd.member_id
    LEFT JOIN members o ON o.id = r.owner_id
    WHERE rd.status = 'requested' ORDER BY rd.id DESC LIMIT 60`).all();
  return c.json(rows);
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

// ---- reading lists ----
api.get('/lists', (c) => {
  const lists = db.prepare('SELECT id, name, description FROM lists ORDER BY id').all();
  const books = db.prepare('SELECT id, list_id AS listId, title, author FROM list_books ORDER BY id').all();
  return c.json(lists.map((l) => ({ ...l, books: books.filter((b) => b.listId === l.id) })));
});

api.post('/admin/lists', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!(b.name || '').trim()) return c.json({ error: 'Name required' }, 400);
  const info = db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)').run(b.name.trim(), b.description || '');
  return c.json({ id: Number(info.lastInsertRowid) });
});

api.patch('/admin/lists/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const l = db.prepare('SELECT * FROM lists WHERE id = ?').get(id);
  if (!l) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const name = b.name != null && String(b.name).trim() ? String(b.name).trim() : l.name;
  const desc = b.description != null ? String(b.description) : l.description;
  db.prepare('UPDATE lists SET name = ?, description = ? WHERE id = ?').run(name, desc, id);
  return c.json({ ok: true });
});

api.delete('/admin/lists/:id', (c) => {
  const id = Number(c.req.param('id'));
  db.prepare('DELETE FROM list_books WHERE list_id = ?').run(id);
  db.prepare('DELETE FROM lists WHERE id = ?').run(id);
  return c.body(null, 204);
});

api.post('/admin/lists/:id/books', async (c) => {
  const b = await c.req.json().catch(() => ({}));
  if (!(b.title || '').trim()) return c.json({ error: 'Title required' }, 400);
  const info = db.prepare('INSERT INTO list_books (list_id, title, author) VALUES (?, ?, ?)')
    .run(Number(c.req.param('id')), b.title.trim(), b.author || '');
  return c.json({ id: Number(info.lastInsertRowid) });
});

api.patch('/admin/lists/books/:bookId', async (c) => {
  const id = Number(c.req.param('bookId'));
  const bk = db.prepare('SELECT * FROM list_books WHERE id = ?').get(id);
  if (!bk) return c.json({ error: 'Not found' }, 404);
  const b = await c.req.json().catch(() => ({}));
  const title = b.title != null && String(b.title).trim() ? String(b.title).trim() : bk.title;
  const author = b.author != null ? String(b.author) : bk.author;
  db.prepare('UPDATE list_books SET title = ?, author = ? WHERE id = ?').run(title, author, id);
  return c.json({ ok: true });
});

api.delete('/admin/lists/books/:bookId', (c) => {
  db.prepare('DELETE FROM list_books WHERE id = ?').run(Number(c.req.param('bookId')));
  return c.body(null, 204);
});

// ---- month-end ceremony ----
api.get('/ceremony', (c) => {
  const m = c.get('member');
  const latest = db.prepare('SELECT month, data FROM month_summaries ORDER BY month DESC LIMIT 1').get();
  if (!latest) return c.json({ summary: null });
  const seen = !!db.prepare('SELECT 1 FROM ceremony_seen WHERE member_id = ? AND month = ?').get(m.id, latest.month);
  return c.json({ summary: JSON.parse(latest.data), seen });
});

api.post('/ceremony/seen', async (c) => {
  const m = c.get('member');
  const b = await c.req.json().catch(() => ({}));
  if (b.month) db.prepare('INSERT OR IGNORE INTO ceremony_seen (member_id, month) VALUES (?, ?)').run(m.id, b.month);
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

runFinalization();
setInterval(runFinalization, 60 * 60 * 1000); // hourly: finalize any month that has rolled over
startBackups(); // snapshot the DB on boot + daily

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[bookcoin] server on http://localhost:${info.port}`);
  console.log(`[bookcoin] web UI: ${existsSync(STATIC_ROOT) ? 'serving ' + STATIC_ROOT : 'not built — run the Vite dev server (pnpm dev:app)'}`);
});
