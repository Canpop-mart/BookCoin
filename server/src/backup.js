// Automated SQLite snapshots. VACUUM INTO writes a single, internally-consistent
// copy of the DB even while it's in WAL mode and being written to — so these are
// safe point-in-time backups. They live next to the DB in the mounted ./data
// volume; layer a NAS/off-disk backup (e.g. Synology Hyper Backup) on top for
// disaster recovery, since these share the same disk.
import { mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { db } from './db.js';

const DB_PATH = process.env.BOOKCOIN_DB ?? './data/bookcoin.db';
const BACKUP_DIR = join(dirname(DB_PATH), 'backups');
const KEEP = 14; // daily snapshots retained

export function runBackup() {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    const file = join(BACKUP_DIR, `bookcoin-${day}.db`);
    if (existsSync(file)) rmSync(file); // VACUUM INTO requires the target not to exist
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

    const old = readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('bookcoin-') && f.endsWith('.db'))
      .sort();
    while (old.length > KEEP) rmSync(join(BACKUP_DIR, old.shift()));

    console.log('[bookcoin] db backup written:', file);
  } catch (e) {
    console.error('[bookcoin] db backup failed:', e.message);
  }
}

export function startBackups() {
  runBackup(); // one on boot
  setInterval(runBackup, 24 * 60 * 60 * 1000); // and daily
}
