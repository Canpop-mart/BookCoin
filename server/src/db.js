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
`);

// Seed the family on first run (default PIN 1234 — change in profile later).
const count = db.prepare('SELECT COUNT(*) AS n FROM members').get().n;
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO members (name, initials, color, pin, monthly_goal_minutes) VALUES (?, ?, ?, ?, ?)'
  );
  const seed = [
    ['Mara', 'MA', '#E0785A', '1234', 900],
    ['Dad', 'DA', '#8FA97C', '1234', 900],
    ['Mom', 'MO', '#D99A2B', '1234', 600],
    ['Sofia', 'SO', '#C58BA6', '1234', 600],
    ['Leo', 'LE', '#7BA6C4', '1234', 450],
  ];
  for (const m of seed) insert.run(...m);
  console.log(`[bookcoin] seeded ${seed.length} family members (default PIN 1234)`);
}
