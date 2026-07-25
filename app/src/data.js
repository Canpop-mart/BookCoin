export const MEDIUMS = [
  { id: 'prose', label: 'Book' },
  { id: 'manga', label: 'Manga' },
  { id: 'comic', label: 'Comic' },
  { id: 'webtoon', label: 'Webtoon' },
  { id: 'audiobook', label: 'Audio' },
];

export const GENRES = [
  'Fantasy', 'Sci-fi', 'Dystopian', 'Adventure', 'Action',
  'Mystery', 'Thriller', 'Crime', 'Horror', 'Paranormal',
  'Romance', 'Drama', 'Slice of life', 'Comedy', 'Coming of age',
  'Literary', 'Contemporary', 'Historical', 'Classic', 'Fairy tale',
  'Western', 'Sports', 'Short stories', 'Poetry',
  'Young adult', "Children's", 'Middle grade',
  'Nonfiction', 'Biography', 'Memoir', 'History', 'Science',
  'True crime', 'Self-help', 'Philosophy', 'Travel',
];

// Reader titles. You climb on books finished OR hours read, whichever is further along,
// so heavy webtoon/manga readers who rarely "finish a book" still level up.
export const READER_TITLES = [
  { books: 100, hours: 300, title: 'Living library' },
  { books: 50, hours: 150, title: 'Loremaster' },
  { books: 25, hours: 80, title: 'Book dragon' },
  { books: 12, hours: 40, title: 'Bibliophile' },
  { books: 5, hours: 15, title: 'Bookworm' },
  { books: 1, hours: 3, title: 'Page-turner' },
  { books: 0, hours: 0, title: 'New reader' },
];
export function readerTitleFor(books = 0, minutes = 0) {
  const hours = (minutes || 0) / 60;
  return (READER_TITLES.find((t) => books >= t.books || hours >= t.hours) || READER_TITLES[READER_TITLES.length - 1]).title;
}

// covers a reader can pick for a book (shared by the book page and the finish screen)
export const COVER_EMOJIS = ['', '📕', '📗', '📘', '📙', '📚', '🐉', '🚀', '🔮', '🗺️', '🏰', '💀', '❤️', '🌙', '⭐', '🦄', '🐈', '☕', '🌸', '🔪', '🧪', '⚔️', '👑', '🌊'];

// conscious money anchor: 100 coins = $1 (keep in sync with server/src/coins.js)
export const COINS_PER_DOLLAR = 100;

// stable per-book spine look (colour + size variation), seeded from the title so a
// book always renders the same on the shelf and in mini previews.
const SPINE_COLORS = ['#A4553C', '#6E5E94', '#42562F', '#7A5410', '#8A4555', '#356084', '#3C6B40', '#9C7248', '#B07CC6', '#4E7A6B', '#C77B3E', '#566BA0'];
export function bookSpine(b) {
  const s = (b?.title || '') + '|' + (b?.author || '');
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  h = Math.abs(h);
  return { bg: SPINE_COLORS[h % SPINE_COLORS.length], tall: h % 5, wide: h % 4 };
}
export function usd(coins) {
  const v = (Number(coins) || 0) / COINS_PER_DOLLAR;
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
}

export function fmtDuration(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// count of quests/challenges a member can claim right now (excludes member bounties)
export const claimableQuests = (quests) => (quests || []).filter(
  (q) => q.kind !== 'bounty' && q.type !== 'manual' && q.complete && !['claimed', 'approved', 'pending'].includes(q.claimStatus)
).length;

export function daysLeftInMonth() {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, lastDay - d.getDate());
}

// final-day countdown: on the last day of the month, the days-left chip turns into a live timer
export function isFinalDayOfMonth(now = Date.now()) {
  const d = new Date(now);
  return d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}
export function msUntilMonthEnd(now = Date.now()) {
  const d = new Date(now);
  return Math.max(0, new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime() - now);
}
export function fmtCountdown(ms) {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
// ms until a server timestamp ('YYYY-MM-DD HH:MM:SS' UTC, e.g. the period end)
export function msUntilTs(ts, now = Date.now()) {
  if (!ts) return null;
  return Math.max(0, Date.parse(ts.replace(' ', 'T') + 'Z') - now);
}

export function monthName(ym) {
  const [y, m] = (ym || '').split('-').map(Number);
  if (!y) return '';
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long' });
}

// exact length of a timer lap, so a 20-second split never reads the same as a 2-minute one
export function fmtLap(sec) {
  const s = Math.max(0, Math.round(sec || 0));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

export function fmtClock(totalSeconds) {
  const pad = (n) => String(n).padStart(2, '0');
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
