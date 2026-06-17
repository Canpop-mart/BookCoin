import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DB_PATH = process.env.BOOKCOIN_DB ?? './data/bookcoin.db';
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    pin TEXT NOT NULL,
    monthly_goal_minutes INTEGER NOT NULL DEFAULT 900,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    title TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    medium TEXT NOT NULL,
    genres TEXT NOT NULL DEFAULT '[]',
    minutes INTEGER NOT NULL,
    pages INTEGER,
    summary TEXT NOT NULL DEFAULT '',
    quote TEXT,
    coins INTEGER NOT NULL DEFAULT 0,
    multiplier REAL NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS coin_txns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    ref_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tokens (
    token TEXT PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL,                     -- minutes | sessions | genres | mediums | streak | manual
    target INTEGER NOT NULL DEFAULT 1,
    reward_coins INTEGER NOT NULL DEFAULT 0,
    period TEXT NOT NULL DEFAULT 'month',   -- month | once
    requires_approval INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS quest_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quest_id INTEGER NOT NULL REFERENCES quests(id),
    member_id INTEGER NOT NULL REFERENCES members(id),
    period_key TEXT NOT NULL,
    status TEXT NOT NULL,                   -- claimed | pending | approved | rejected
    coins_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (quest_id, member_id, period_key)
  );

  CREATE TABLE IF NOT EXISTS rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    cost_coins INTEGER NOT NULL,
    tier TEXT NOT NULL DEFAULT 'low',       -- low | mid | high
    stock INTEGER,                          -- null = unlimited
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reward_id INTEGER NOT NULL REFERENCES rewards(id),
    member_id INTEGER NOT NULL REFERENCES members(id),
    cost_coins INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested', -- requested | fulfilled | cancelled
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS list_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL REFERENCES lists(id),
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- migration: add members.role to pre-existing databases ---
const memberCols = db.prepare('PRAGMA table_info(members)').all().map((c) => c.name);
if (!memberCols.includes('role')) {
  db.exec("ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
}

// --- migration: member-owned rewards (owner, status, cut %) ---
const rewardCols = db.prepare('PRAGMA table_info(rewards)').all().map((c) => c.name);
if (!rewardCols.includes('owner_id')) db.exec('ALTER TABLE rewards ADD COLUMN owner_id INTEGER');
if (!rewardCols.includes('owner_cut')) db.exec('ALTER TABLE rewards ADD COLUMN owner_cut INTEGER NOT NULL DEFAULT 0');
if (!rewardCols.includes('status')) {
  db.exec("ALTER TABLE rewards ADD COLUMN status TEXT NOT NULL DEFAULT 'approved'");
  db.exec("UPDATE rewards SET status = CASE WHEN active = 0 THEN 'archived' ELSE 'approved' END");
}

// --- one-time bootstrap: seed a single admin on a brand-new database ---
// (real members are created from the admin portal; the `seeded` flag means
//  clearing all members later never re-creates a placeholder)
db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);');
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'seeded'").get()) {
  if (db.prepare('SELECT COUNT(*) AS n FROM members').get().n === 0) {
    db.prepare('INSERT INTO members (name, initials, color, pin, monthly_goal_minutes, role) VALUES (?, ?, ?, ?, ?, ?)')
      .run('Admin', 'AD', '#E0785A', '1234', 900, 'admin');
    console.log('[bookcoin] fresh database — seeded one Admin account (PIN 1234). Create real members in the admin portal.');
  }
  db.prepare("INSERT INTO meta (key, value) VALUES ('seeded', '1')").run();
}

// safety net: never end up with zero admins while members exist
if (db.prepare('SELECT COUNT(*) AS n FROM members').get().n > 0
    && db.prepare("SELECT COUNT(*) AS n FROM members WHERE role='admin'").get().n === 0) {
  db.exec("UPDATE members SET role='admin' WHERE id=(SELECT MIN(id) FROM members)");
}

// --- seed starter quests ---
if (db.prepare('SELECT COUNT(*) AS n FROM quests').get().n === 0) {
  const q = db.prepare(
    'INSERT INTO quests (title, description, type, target, reward_coins, period, requires_approval) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  q.run('Genre explorer', 'Read 5 different genres this month', 'genres', 5, 200, 'month', 0);
  q.run('Marathon reader', 'Read 10 hours this month', 'minutes', 600, 150, 'month', 0);
  q.run('Format hopper', 'Read 3 different formats this month', 'mediums', 3, 100, 'month', 0);
  q.run('Seven-day streak', 'Read 7 days in a row', 'streak', 7, 120, 'once', 0);
  q.run('Bookworm', 'Log 12 reading sessions this month', 'sessions', 12, 80, 'month', 0);
  q.run('Finish a classic', 'Read a book from the classics list, then claim it', 'manual', 1, 250, 'month', 1);
  console.log('[bookcoin] seeded starter quests');
}

// --- seed starter rewards ---
if (db.prepare('SELECT COUNT(*) AS n FROM rewards').get().n === 0) {
  const r = db.prepare('INSERT INTO rewards (name, description, cost_coins, tier, stock) VALUES (?, ?, ?, ?, ?)');
  r.run('Pick movie night', 'Choose what the family watches this weekend', 150, 'low', null);
  r.run('Skip a chore', 'Get out of one chore, no questions asked', 200, 'low', null);
  r.run('Choose dinner', 'Pick what’s for dinner one night', 250, 'low', null);
  r.run('Boba run', 'A boba of your choice', 400, 'mid', null);
  r.run('New book', 'Pick a book to buy', 700, 'mid', null);
  r.run('$10 game credit', 'Steam / eShop / PSN credit of your choice', 1200, 'high', null);
  console.log('[bookcoin] seeded starter rewards');
}

// --- seed a starter reading list (separate flag so it appears for existing DBs too) ---
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'lists_seeded'").get()) {
  if (db.prepare('SELECT COUNT(*) AS n FROM lists').get().n === 0) {
    const lid = Number(db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)')
      .run('Classics', 'Timeless books worth reading at least once').lastInsertRowid);
    const addBook = db.prepare('INSERT INTO list_books (list_id, title, author) VALUES (?, ?, ?)');
    for (const [t, a] of [
      ['Pride and Prejudice', 'Jane Austen'], ['1984', 'George Orwell'],
      ['To Kill a Mockingbird', 'Harper Lee'], ['The Great Gatsby', 'F. Scott Fitzgerald'],
      ['Jane Eyre', 'Charlotte Brontë'], ['Frankenstein', 'Mary Shelley'],
      ['The Hobbit', 'J.R.R. Tolkien'], ['Fahrenheit 451', 'Ray Bradbury'],
    ]) addBook.run(lid, t, a);
    console.log('[bookcoin] seeded a Classics reading list');
  }
  db.prepare("INSERT INTO meta (key, value) VALUES ('lists_seeded', '1')").run();
}

// any reward without an owner belongs to the first admin (legacy / house rewards)
{
  const houseAdmin = db.prepare("SELECT id FROM members WHERE role = 'admin' ORDER BY id LIMIT 1").get();
  if (houseAdmin) db.prepare('UPDATE rewards SET owner_id = ? WHERE owner_id IS NULL').run(houseAdmin.id);
}
