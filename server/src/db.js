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

db.exec(`
  CREATE TABLE IF NOT EXISTS month_summaries (
    month TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS ceremony_seen (
    member_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    PRIMARY KEY (member_id, month)
  );

  -- personal bookshelf
  CREATE TABLE IF NOT EXISTS member_books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id INTEGER NOT NULL REFERENCES members(id),
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'reading',   -- want | reading | finished
    rating INTEGER,                           -- 1-5, finished only
    started_at TEXT,
    finished_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- admin-managed genre list (offered when logging a session)
  CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// --- migration: add members.role to pre-existing databases ---
const memberCols = db.prepare('PRAGMA table_info(members)').all().map((c) => c.name);
if (!memberCols.includes('role')) {
  db.exec("ALTER TABLE members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'");
}

// --- migration: personalization (free) — app theme + avatar emblem + mascot ---
if (!memberCols.includes('theme')) db.exec("ALTER TABLE members ADD COLUMN theme TEXT NOT NULL DEFAULT 'classic'");
if (!memberCols.includes('emblem')) db.exec("ALTER TABLE members ADD COLUMN emblem TEXT NOT NULL DEFAULT ''");
if (!memberCols.includes('mascot')) db.exec("ALTER TABLE members ADD COLUMN mascot TEXT NOT NULL DEFAULT 'wizard'");
if (!memberCols.includes('onboarded')) db.exec('ALTER TABLE members ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0');

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
  // prices anchored at 100 coins = $1 (a ~15 hr reading month ≈ 1,000 coins ≈ a boba)
  const r = db.prepare('INSERT INTO rewards (name, description, cost_coins, tier, stock) VALUES (?, ?, ?, ?, ?)');
  r.run('Pick movie night', 'Choose what the family watches this weekend', 500, 'low', null);
  r.run('Skip a chore', 'Get out of one chore, no questions asked', 600, 'low', null);
  r.run('Choose dinner', 'Pick what’s for dinner one night', 400, 'low', null);
  r.run('Boba run', 'A boba of your choice', 1000, 'mid', null);
  r.run('New book', 'Pick a book to buy', 1500, 'high', null);
  r.run('$10 game credit', 'Steam / eShop / PSN credit of your choice', 1000, 'high', null);
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

// --- extra challenges + reading lists (runs once, even on existing DBs; skips names that already exist) ---
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'seed_extra_1'").get()) {
  const haveQuest = (t) => db.prepare('SELECT 1 FROM quests WHERE title = ?').get(t);
  const addChallenge = db.prepare("INSERT INTO quests (title, description, type, target, reward_coins, period, requires_approval) VALUES (?, ?, 'manual', 1, ?, 'month', ?)");
  for (const [title, desc, coins, appr] of [
    ["Read someone else's favorite", 'Read a book another member loves', 250, 1],
    ['Buddy read', 'Read the same book as someone else this month', 200, 1],
    ['Pass it on', 'Recommend a book that someone else then reads', 150, 1],
    ['Book to screen', 'Read a book that became a movie or show, then watch it', 200, 0],
    ['Around the world', 'Read a book set in another country', 150, 0],
    ['Older than you', 'Read a book published before you were born', 150, 0],
    ['Finish a series', 'Read every book in a series', 300, 1],
    ['Reread a favorite', 'Revisit a book you already love', 100, 0],
  ]) if (!haveQuest(title)) addChallenge.run(title, desc, coins, appr);

  const addList = (name, description, books) => {
    if (db.prepare('SELECT 1 FROM lists WHERE name = ?').get(name)) return;
    const lid = Number(db.prepare('INSERT INTO lists (name, description) VALUES (?, ?)').run(name, description).lastInsertRowid);
    const ab = db.prepare('INSERT INTO list_books (list_id, title, author) VALUES (?, ?, ?)');
    for (const [t, a] of books) ab.run(lid, t, a);
  };
  addList('Middle-grade magic', 'Big adventures for younger readers', [
    ['The Lightning Thief', 'Rick Riordan'], ['Wonder', 'R.J. Palacio'], ['Holes', 'Louis Sachar'],
    ['A Wrinkle in Time', 'Madeleine L’Engle'], ['The Tale of Despereaux', 'Kate DiCamillo'], ['Coraline', 'Neil Gaiman'],
  ]);
  addList('Books that became movies', 'Read it first, then watch', [
    ['Harry Potter and the Sorcerer’s Stone', 'J.K. Rowling'], ['Matilda', 'Roald Dahl'], ['The Hunger Games', 'Suzanne Collins'],
    ['Jurassic Park', 'Michael Crichton'], ['The Princess Bride', 'William Goldman'], ['Life of Pi', 'Yann Martel'],
  ]);
  addList('Sci-fi starters', 'Gateways into science fiction', [
    ['Ender’s Game', 'Orson Scott Card'], ['Dune', 'Frank Herbert'], ['The Martian', 'Andy Weir'],
    ['Ready Player One', 'Ernest Cline'], ['The Hitchhiker’s Guide to the Galaxy', 'Douglas Adams'], ['The War of the Worlds', 'H.G. Wells'],
  ]);
  addList('Graphic novels & manga', 'Stories told in pictures', [
    ['Dog Man', 'Dav Pilkey'], ['Smile', 'Raina Telgemeier'], ['Bone', 'Jeff Smith'],
    ['Amulet', 'Kazu Kibuishi'], ['One Piece, Vol. 1', 'Eiichiro Oda'], ['Persepolis', 'Marjane Satrapi'],
  ]);
  addList('True stories', 'Real lives and real events', [
    ['I Am Malala', 'Malala Yousafzai'], ['Hidden Figures', 'Margot Lee Shetterly'], ['The Boy Who Harnessed the Wind', 'William Kamkwamba'],
    ['Bomb', 'Steve Sheinkin'], ['Born a Crime', 'Trevor Noah'], ['Sapiens', 'Yuval Noah Harari'],
  ]);
  addList('Cozy & funny', 'Warm, light, laugh-out-loud reads', [
    ['Diary of a Wimpy Kid', 'Jeff Kinney'], ['Good Omens', 'Pratchett & Gaiman'], ['A Man Called Ove', 'Fredrik Backman'],
    ['Anne of Green Gables', 'L.M. Montgomery'], ['The Princess Diaries', 'Meg Cabot'], ['The No. 1 Ladies’ Detective Agency', 'Alexander McCall Smith'],
  ]);

  db.prepare("INSERT INTO meta (key, value) VALUES ('seed_extra_1', '1')").run();
  console.log('[bookcoin] seeded 8 challenges + 6 reading lists');
}

// --- seed the admin-managed genre list (once; admins edit it afterwards) ---
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'genres_seeded'").get()) {
  const ins = db.prepare('INSERT OR IGNORE INTO genres (name, sort) VALUES (?, ?)');
  [
    'Fantasy', 'Sci-fi', 'Dystopian', 'Adventure', 'Action',
    'Mystery', 'Thriller', 'Crime', 'Horror', 'Paranormal',
    'Romance', 'Drama', 'Slice of life', 'Comedy', 'Coming of age',
    'Literary', 'Contemporary', 'Historical', 'Classic', 'Fairy tale',
    'Western', 'Sports', 'Short stories', 'Poetry',
    'Young adult', "Children's", 'Middle grade',
    'Nonfiction', 'Biography', 'Memoir', 'History', 'Science',
    'True crime', 'Self-help', 'Philosophy', 'Travel',
  ].forEach((name, i) => ins.run(name, i));
  db.prepare("INSERT INTO meta (key, value) VALUES ('genres_seeded', '1')").run();
  console.log('[bookcoin] seeded the genre list');
}

// --- economy v2: conscious money anchor (100 coins = $1) — re-price the default
//     rewards on existing DBs. Matches name + original price, so anything an admin
//     has already re-priced is left untouched. ---
if (!db.prepare("SELECT 1 FROM meta WHERE key = 'econ_v2'").get()) {
  const reprice = db.prepare('UPDATE rewards SET cost_coins = ? WHERE name = ? AND cost_coins = ?');
  for (const [name, oldP, newP] of [
    ['Pick movie night', 150, 500],
    ['Skip a chore', 200, 600],
    ['Choose dinner', 250, 400],
    ['Boba run', 400, 1000],
    ['New book', 700, 1500],
    ['$10 game credit', 1200, 1000],
  ]) reprice.run(newP, name, oldP);
  db.prepare("INSERT INTO meta (key, value) VALUES ('econ_v2', '1')").run();
  console.log('[bookcoin] economy v2 — anchored default reward prices to 100 coins = $1');
}
