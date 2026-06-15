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
  id: m.id, name: m.name, initials: m.initials, color: m.color, monthlyGoalMinutes: m.monthly_goal_minutes,
});

const monthKey = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM (UTC)

const safeParse = (s) => { try { return JSON.parse(s); } catch { return []; } };

const rowToSession = (r) => ({
  id: r.id, memberId: r.member_id, title: r.title, author: r.author, medium: r.medium,
  genres: safeParse(r.genres), minutes: r.minutes, pages: r.pages, summary: r.summary,
  quote: r.quote, coins: r.coins, multiplier: r.multiplier, createdAt: r.created_at,
});

// --- api ---
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

// everything below requires a valid token
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

  // comfort-zone bonus: brand-new genre for this member (none of these genres seen before)
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
  const rows = db.prepare('SELECT * FROM sessions WHERE member_id = ? ORDER BY id DESC LIMIT 50').all(m.id);
  return c.json(rows.map(rowToSession));
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
  const totals = db.prepare(
    'SELECT COALESCE(SUM(minutes),0) AS minutes, COUNT(*) AS sessions, COALESCE(SUM(pages),0) AS pages FROM sessions WHERE member_id = ?'
  ).get(id);
  const byMedium = db.prepare(
    'SELECT medium, SUM(minutes) AS minutes FROM sessions WHERE member_id = ? GROUP BY medium ORDER BY minutes DESC'
  ).all(id);
  const monthMinutes = db.prepare(
    "SELECT COALESCE(SUM(minutes),0) AS minutes FROM sessions WHERE member_id = ? AND strftime('%Y-%m', created_at) = ?"
  ).get(id, monthKey()).minutes;
  const recent = db.prepare('SELECT * FROM sessions WHERE member_id = ? ORDER BY id DESC LIMIT 20').all(id).map(rowToSession);
  return c.json({ member: publicMember(m), balance: balance(id), totals, byMedium, monthMinutes, recent });
});

// --- app wiring ---
const app = new Hono();
app.use('*', cors());
app.route('/api', api);

// Serve the built web UI (production). In dev, use the Vite dev server instead.
if (existsSync(STATIC_ROOT)) {
  app.use('/*', serveStatic({ root: STATIC_ROOT }));
  const indexHtml = existsSync(join(STATIC_ROOT, 'index.html'))
    ? readFileSync(join(STATIC_ROOT, 'index.html'), 'utf8')
    : null;
  app.get('*', (c) => (indexHtml ? c.html(indexHtml) : c.text('Not found', 404)));
}

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[bookcoin] server on http://localhost:${info.port}`);
  console.log(`[bookcoin] web UI: ${existsSync(STATIC_ROOT) ? 'serving ' + STATIC_ROOT : 'not built — run the Vite dev server (pnpm dev:app)'}`);
});
