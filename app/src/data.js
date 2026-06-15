export const MEDIUMS = [
  { id: 'prose', label: 'Prose' },
  { id: 'manga', label: 'Manga' },
  { id: 'comic', label: 'Comic' },
  { id: 'webtoon', label: 'Webtoon' },
  { id: 'audiobook', label: 'Audio' },
];

export const GENRES = [
  'Fantasy', 'Sci-fi', 'Romance', 'Mystery', 'Thriller', 'Horror',
  'Nonfiction', 'History', 'Biography', 'Poetry', 'Self-help',
  'Classic', 'Young adult', 'Adventure', 'Comedy',
];

export function fmtDuration(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function fmtClock(totalSeconds) {
  const pad = (n) => String(n).padStart(2, '0');
  const s = totalSeconds % 60;
  const m = Math.floor(totalSeconds / 60) % 60;
  const h = Math.floor(totalSeconds / 3600);
  return h ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
