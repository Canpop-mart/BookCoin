// Book lookup, powered by the Hardcover API (https://hardcover.app).
//
// The token lives here rather than in the app: this repo is public and the APK
// ships to phones, so anything bundled client-side is effectively published.
// The app asks BookCoin, BookCoin asks Hardcover.
//
// Set HARDCOVER_TOKEN to switch it on. Without it every lookup route reports
// itself disabled and the app hides the search and scan buttons.

const ENDPOINT = 'https://api.hardcover.app/v1/graphql';

// The site hands you the token with "Bearer " already on the front about half
// the time, so accept it either way.
const TOKEN = (process.env.HARDCOVER_TOKEN || '').trim().replace(/^Bearer\s+/i, '');

export const lookupEnabled = () => !!TOKEN;

// One token covers the whole household and Hardcover allows 60 calls a minute,
// so spend them carefully: remember answers, and stop well short of the ceiling
// so one person mashing the search box cannot lock everyone else out.
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 500;
const CALLS_PER_MIN = 30;

const cache = new Map();
let recentCalls = [];

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) { cache.delete(key); return null; }
  cache.delete(key); cache.set(key, hit); // keep the freshest keys at the tail
  return hit.value;
}

function cacheSet(key, value) {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function withinBudget() {
  const cutoff = Date.now() - 60_000;
  recentCalls = recentCalls.filter((t) => t > cutoff);
  return recentCalls.length < CALLS_PER_MIN;
}

class LookupError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

async function gql(query, variables) {
  if (!TOKEN) throw new LookupError('Book lookup is not set up on this server', 503);
  if (!withinBudget()) throw new LookupError('Too many lookups right now. Try again in a minute.', 429);
  recentCalls.push(Date.now());

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new LookupError("Couldn't reach the book database", 502);
  }
  if (res.status === 401 || res.status === 403) throw new LookupError('The Hardcover token was rejected', 502);
  if (res.status === 429) throw new LookupError('Too many lookups right now. Try again in a minute.', 429);
  if (!res.ok) throw new LookupError("The book database didn't answer", 502);

  const body = await res.json().catch(() => null);
  if (!body || body.errors?.length) throw new LookupError(body?.errors?.[0]?.message || 'Book lookup failed', 502);
  return body.data;
}

// --- shaping ---------------------------------------------------------------
// Hardcover's search comes back as a raw Typesense payload, so read it
// defensively: field names there are not part of the GraphQL contract.

const digitsOnly = (s) => String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();

// Book barcodes are EAN-13 and often carry a 5-digit price add-on.
export function cleanIsbn(raw) {
  const d = digitsOnly(raw);
  if (d.length > 13 && /^97[89]/.test(d)) return d.slice(0, 13);
  return d;
}

// A 13-digit ISBN starting 978 is a 10-digit ISBN wearing a hat. Older stock is
// only indexed under the short form, so we keep it as a second thing to try.
export function isbn10From13(isbn13) {
  const d = digitsOnly(isbn13);
  if (d.length !== 13 || !d.startsWith('978')) return '';
  const core = d.slice(3, 12);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(core[i]);
  const check = (11 - (sum % 11)) % 11;
  return core + (check === 10 ? 'X' : String(check));
}

function coverUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  return image.url || '';
}

// The publisher/community blurb. Rendered as plain text in the app, so flatten
// any stray markup and cap it: these run long, and a few paragraphs is plenty.
export function cleanBlurb(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1500);
}

// Authors come back under `author_names` on the Hardcover search index, but be
// defensive about the exact shape (it's a raw Typesense payload, not a typed
// GraphQL field): accept an array, a single string, or a `contributions` list.
function pickAuthor(doc) {
  const names = doc.author_names;
  if (Array.isArray(names)) { const n = names.find(Boolean); if (n) return String(n).trim(); }
  else if (typeof names === 'string' && names.trim()) return names.trim();
  for (const c of (Array.isArray(doc.contributions) ? doc.contributions : [])) {
    if (!c) continue;
    if (typeof c === 'string' && c.trim()) return c.trim();
    const n = c.author?.name || c.author_name || c.name;
    if (n && String(n).trim()) return String(n).trim();
  }
  return '';
}

function fromSearchHit(doc) {
  if (!doc || !doc.title) return null;
  const isbns = (Array.isArray(doc.isbns) ? doc.isbns : []).map(digitsOnly).filter(Boolean);
  return {
    title: String(doc.title),
    author: pickAuthor(doc),
    cover: coverUrl(doc.image || doc.cached_image),
    blurb: cleanBlurb(doc.description),
    isbn: isbns.find((x) => x.length === 13) || isbns[0] || '',
    year: doc.release_year ? Number(doc.release_year) : null,
    pages: doc.pages ? Number(doc.pages) : null,
    series: (Array.isArray(doc.series_names) ? doc.series_names : [])[0] || '',
    isbns,
  };
}

const SEARCH = `
  query BookCoinSearch($q: String!, $n: Int!) {
    search(query: $q, query_type: "Book", per_page: $n, page: 1) { results }
  }`;

// Depth stays shallow here on purpose: the API caps query depth, and the
// contributions -> author hop is one level too far to be worth the risk.
const BY_ISBN = `
  query BookCoinIsbn($isbn: String!) {
    editions(where: {_or: [{isbn_13: {_eq: $isbn}}, {isbn_10: {_eq: $isbn}}]}, limit: 3) {
      title
      pages
      isbn_13
      isbn_10
      book { title slug description image { url } }
    }
  }`;

export async function searchBooks(query, limit = 12) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const n = Math.max(1, Math.min(25, Number(limit) || 12));
  const key = `s:${n}:${q.toLowerCase()}`;
  const hit = cacheGet(key);
  if (hit) return hit;

  const data = await gql(SEARCH, { q, n });
  const hits = data?.search?.results?.hits || [];
  const out = hits.map((h) => fromSearchHit(h?.document)).filter(Boolean);
  cacheSet(key, out);
  return out;
}

// Barcode path. The search index covers ISBNs (with typo tolerance off), so try
// that first because it carries the author and cover; fall back to the editions
// table, which is exact but thinner.
export async function lookupIsbn(raw) {
  const isbn = cleanIsbn(raw);
  if (isbn.length !== 10 && isbn.length !== 13) return null;
  const key = `i:${isbn}`;
  const hit = cacheGet(key);
  if (hit !== null && hit !== undefined) return hit;

  const alt = isbn.length === 13 ? isbn10From13(isbn) : '';
  const wanted = [isbn, alt].filter(Boolean);

  let found = null;
  for (const candidate of wanted) {
    const results = await searchBooks(candidate, 5).catch(() => []);
    found = results.find((b) => b.isbns?.some((x) => wanted.includes(x)))
         || (results.length === 1 ? results[0] : null);
    if (found) break;
  }

  if (!found) {
    for (const candidate of wanted) {
      const data = await gql(BY_ISBN, { isbn: candidate }).catch(() => null);
      const ed = data?.editions?.[0];
      if (!ed) continue;
      found = {
        title: ed.book?.title || ed.title || '',
        author: '', // the author hop exceeds the API's depth cap; the picker lets you type it
        cover: coverUrl(ed.book?.image),
        blurb: cleanBlurb(ed.book?.description),
        isbn: digitsOnly(ed.isbn_13 || ed.isbn_10 || candidate),
        year: null,
        pages: ed.pages ? Number(ed.pages) : null,
        series: '',
      };
      if (found.title) break;
      found = null;
    }
  }

  const value = found ? { ...found, isbn: found.isbn || isbn } : null;
  cacheSet(key, value);
  return value;
}

export { LookupError };
