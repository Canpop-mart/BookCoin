<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { hapticWin } from '../haptics';
import { MEDIUMS, GENRES, fmtDuration } from '../data';

const router = useRouter();
const draftSec = store.draft?.seconds ?? (store.draft?.minutes != null ? store.draft.minutes * 60 : 1200);
const hours = ref(Math.floor(draftSec / 3600));
const mins = ref(Math.floor((draftSec % 3600) / 60));
const secs = ref(draftSec % 60);
const title = ref(store.draft?.title ?? '');
const author = ref('');
const medium = ref('prose');
const genres = ref([]);
const summary = ref('');
const pages = ref('');
const quote = ref('');
const finished = ref(!!store.draft?.finishBook); // "I finished this book" → shelve it on save
const saving = ref(false);
const error = ref('');
const result = ref(null);
const genreList = ref(GENRES); // fallback; replaced by the admin-managed list below
const allBooks = ref([]); // the reader's shelf, for the title picker
const selectedBook = ref(null);

// laps banked from the timer. More than one means this sitting covered several books.
// the timer seeds each lap's minutes, but they stay editable: a split is a guess, not gospel.
// each lap also carries its own format/genre/note, used only when "Each book" is on.
const laps = ref((store.draft?.segments || []).map((s) => ({
  minutes: Math.max(1, Math.round(s.seconds / 60)),
  title: s.title || '',
  medium: 'prose',
  genres: [],
  summary: '',
})));
const multi = computed(() => laps.value.length > 1);
// when on, each book gets its own format, genre and note instead of one shared set
const perBook = ref(false);
const perBookActive = computed(() => multi.value && perBook.value);
const lapMins = (l) => Math.max(1, Math.round(Number(l.minutes) || 1));
const lapTotal = computed(() => laps.value.reduce((a, l) => a + lapMins(l), 0));
function toggleLapGenre(lap, g) {
  const i = lap.genres.indexOf(g);
  if (i >= 0) lap.genres.splice(i, 1);
  else lap.genres.push(g);
}
// drop an accidental split; falling back to one lap becomes a normal single session,
// carrying that book's details into the single-session form
function removeLap(i) {
  laps.value.splice(i, 1);
  if (laps.value.length === 1) {
    const only = laps.value[0];
    const m = lapMins(only);
    hours.value = Math.floor(m / 60);
    mins.value = m % 60;
    secs.value = 0;
    title.value = only.title || '';
    medium.value = only.medium || 'prose';
    genres.value = [...(only.genres || [])];
    if (only.summary && !summary.value.trim()) summary.value = only.summary;
    perBook.value = false;
  }
}

onMounted(async () => {
  try { const g = await api.genres(); if (Array.isArray(g) && g.length) genreList.value = g; } catch { /* keep the fallback list */ }
  try { allBooks.value = await api.books(); } catch { /* picker just won't suggest */ }
});

const rawSeconds = computed(() => (hours.value || 0) * 3600 + (mins.value || 0) * 60 + (secs.value || 0));
const totalMinutes = computed(() => (multi.value ? lapTotal.value : Math.max(1, Math.round(rawSeconds.value / 60))));
const noteMissing = computed(() => !summary.value.trim());

// little milestones to celebrate on the result screen
const milestones = computed(() => {
  const r = result.value; if (!r) return [];
  const out = [];
  if (r.goalJustMet) out.push({ icon: 'ti-target', text: 'Monthly goal reached!' });
  if (r.streakHit) out.push({ icon: 'ti-flame', text: `${r.streakHit}-day streak!` });
  return out;
});

// books on the shelf whose title contains what's typed (so logging links to a real book, not a new dupe)
const titleMatches = computed(() => {
  const s = title.value.trim().toLowerCase();
  if (!s) return [];
  return allBooks.value.filter((b) => (b.title || '').toLowerCase().includes(s) && (b.title || '').toLowerCase() !== s).slice(0, 5);
});
const linked = computed(() => selectedBook.value && (selectedBook.value.title || '').trim().toLowerCase() === title.value.trim().toLowerCase());
const STATUS_LABEL = { reading: 'Reading now', want: 'Up next', finished: 'Finished' };

function pickBook(b) { title.value = b.title; author.value = b.author || ''; selectedBook.value = b; picked.cover = ''; picked.isbn = ''; picked.blurb = ''; }

// chosen from the book search or a scanned barcode: fill the fields now, and
// keep the cover/blurb so they come along if this turns into a shelf book below
const picked = reactive({ cover: '', isbn: '', blurb: '' });
function fillFromLookup(b) {
  title.value = b.title;
  author.value = b.author || '';
  picked.cover = b.cover || '';
  picked.isbn = b.isbn || '';
  picked.blurb = b.blurb || '';
  selectedBook.value = null;
}

// add a book to the shelf without leaving the log screen
const exactMatch = computed(() => allBooks.value.find((b) => (b.title || '').trim().toLowerCase() === title.value.trim().toLowerCase()));
const canCreate = computed(() => title.value.trim().length > 1 && !exactMatch.value);
const creating = ref(false);
async function createBook() {
  const t = title.value.trim();
  if (!t || creating.value) return;
  creating.value = true;
  try {
    const b = await api.addBook({ title: t, author: author.value.trim(), status: 'reading', cover: picked.cover, isbn: picked.isbn, blurb: picked.blurb });
    allBooks.value = await api.books();
    selectedBook.value = b;
  } catch { /* the session still logs fine without the shelf link */ }
  finally { creating.value = false; }
}

function toggleGenre(g) {
  const i = genres.value.indexOf(g);
  if (i >= 0) genres.value.splice(i, 1);
  else genres.value.push(g);
}

// find the shelf book this session belongs to (or create it), mark it finished, return its id
async function resolveFinishedBook() {
  const t = title.value.trim();
  if (!t) return null;
  if (linked.value) {
    if (selectedBook.value.status !== 'finished') await api.updateBook(selectedBook.value.id, { status: 'finished' });
    return selectedBook.value.id;
  }
  const books = allBooks.value.length ? allBooks.value : await api.books();
  const match = books.find((b) => (b.title || '').trim().toLowerCase() === t.toLowerCase());
  if (match) { if (match.status !== 'finished') await api.updateBook(match.id, { status: 'finished' }); return match.id; }
  const created = await api.addBook({ title: t, author: author.value.trim(), status: 'finished', cover: picked.cover, isbn: picked.isbn, blurb: picked.blurb });
  return created.id;
}

async function save() {
  error.value = '';

  // several laps: one session per book. Details are shared, or set per book.
  if (multi.value) {
    if (perBook.value) {
      const missing = laps.value.findIndex((l) => !l.summary.trim());
      if (missing >= 0) { error.value = `Add a note for book ${missing + 1}. A short note is how reading gets checked.`; return; }
    } else if (!summary.value.trim()) {
      error.value = "Add a note about what you read. It's the one thing we need."; return;
    }
    saving.value = true;
    try {
      let coins = 0, base = 0, last = null;
      for (const [i, lap] of laps.value.entries()) {
        last = await api.logSession({
          title: lap.title, author: '',
          medium: perBook.value ? lap.medium : medium.value,
          genres: perBook.value ? lap.genres : genres.value,
          minutes: lapMins(lap), pages: null,
          summary: perBook.value ? lap.summary : summary.value,
          quote: i === 0 ? (quote.value || null) : null,
        });
        coins += last.coins; base += last.base;
      }
      store.setDraft(null);
      result.value = { ...last, coins, base, minutes: totalMinutes.value, isNewGenre: false, sessionCount: laps.value.length };
      hapticWin();
    } catch (e) {
      error.value = 'Could not save. ' + e.message;
    } finally { saving.value = false; }
    return;
  }

  // single session
  if (!summary.value.trim()) { error.value = "Add a note about what you read. It's the one thing we need."; return; }
  if (rawSeconds.value < 1) { error.value = 'How long did you read?'; return; }

  saving.value = true;
  try {
    const res = await api.logSession({
      title: title.value, author: author.value, medium: medium.value, genres: genres.value,
      minutes: totalMinutes.value, pages: pages.value ? Number(pages.value) : null,
      summary: summary.value, quote: quote.value || null,
    });
    store.setDraft(null);
    if (finished.value && title.value.trim()) {
      const bookId = await resolveFinishedBook();
      store.setFinishResult(res);          // the finish screen shows the coins
      router.replace('/finished/' + bookId);
      return;
    }
    result.value = res;
    hapticWin();
  } catch (e) {
    error.value = 'Could not save. ' + e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="screen full" v-if="!result">
    <div class="row" style="justify-content:space-between;">
      <span class="h">Log your reading</span>
      <button class="chip" @click="router.replace('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div v-if="multi" class="card" style="background:var(--sage-bg);border-color:transparent;">
      <div class="row" style="gap:9px;">
        <i class="ti ti-arrows-split-2" style="font-size:20px;color:var(--sage-d);" aria-hidden="true"></i>
        <span class="sub" style="color:var(--sage-d);font-weight:600;">{{ laps.length }} books this sitting<InfoBubble text="Each book is logged as its own session. Keep one set of details for the whole sitting, or set the format, genre and note for each book on its own." /></span>
        <span class="sub" style="color:var(--sage-d);margin-left:auto;">{{ fmtDuration(totalMinutes) }}</span>
      </div>

      <div class="row" style="gap:7px;margin-top:11px;">
        <button class="chip" :class="{ on: !perBook }" style="flex:1;justify-content:center;" @click="perBook = false">Same for all</button>
        <button class="chip" :class="{ on: perBook }" style="flex:1;justify-content:center;" @click="perBook = true">Each book</button>
      </div>

      <div v-if="!perBook" style="display:flex;flex-direction:column;gap:8px;margin-top:11px;">
        <div v-for="(l, i) in laps" :key="i" class="row" style="gap:8px;">
          <input v-model="l.title" :placeholder="`Book ${i + 1} title`" style="flex:1;min-width:0;" />
          <input v-model.number="l.minutes" type="number" min="1" max="1440" :aria-label="`Book ${i + 1} minutes`" style="width:62px;text-align:center;flex-shrink:0;" />
          <span class="sub" style="color:var(--sage-d);flex-shrink:0;">m</span>
          <button class="chip" aria-label="remove this split" style="padding:4px 8px;flex-shrink:0;" @click="removeLap(i)"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
      </div>
    </div>

    <!-- per-book detail cards, when the sitting is logged as separate books -->
    <template v-if="perBookActive">
      <div v-for="(l, i) in laps" :key="'pb' + i" class="card" style="display:flex;flex-direction:column;gap:12px;">
        <div class="row" style="gap:8px;">
          <span class="sub" style="font-weight:700;color:var(--sage-d);flex-shrink:0;">Book {{ i + 1 }}</span>
          <input v-model="l.title" :placeholder="`Book ${i + 1} title`" style="flex:1;min-width:0;" />
          <input v-model.number="l.minutes" type="number" min="1" max="1440" :aria-label="`Book ${i + 1} minutes`" style="width:52px;text-align:center;flex-shrink:0;" />
          <span class="sub" style="flex-shrink:0;">m</span>
          <button class="chip" aria-label="remove this book" style="padding:4px 8px;flex-shrink:0;" @click="removeLap(i)"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
        <div>
          <div class="sub" style="margin-bottom:6px;">Format</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button v-for="md in MEDIUMS" :key="md.id" class="chip" :class="{ on: l.medium === md.id }" @click="l.medium = md.id">{{ md.label }}</button>
          </div>
        </div>
        <div>
          <div class="sub" style="margin-bottom:6px;">Genre</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            <button v-for="g in genreList" :key="g" class="chip" :class="{ on: l.genres.includes(g) }" @click="toggleLapGenre(l, g)">{{ g }}</button>
          </div>
        </div>
        <div>
          <div class="row" style="justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:600;font-size:13.5px;"><i class="ti ti-pencil" style="color:var(--terra);" aria-hidden="true"></i> Note</span>
            <span class="chip" style="background:var(--blush-bg);color:var(--blush-d);padding:2px 10px;font-size:11px;font-weight:700;">Required</span>
          </div>
          <textarea v-model="l.summary" rows="2" placeholder="A sentence about this one: what happened, or what you thought."
            :style="{ borderColor: error && !l.summary.trim() ? 'var(--terra)' : 'var(--line)' }"></textarea>
        </div>
      </div>
    </template>

    <template v-else>
    <div class="card" style="background:var(--sage-bg);border-color:transparent;">
      <div class="row" style="gap:9px;">
        <i class="ti ti-clock" style="font-size:20px;color:var(--sage-d);" aria-hidden="true"></i>
        <span class="sub" style="color:var(--sage-d);font-weight:600;">Time read</span>
        <span class="sub" style="color:var(--sage-d);margin-left:auto;">{{ fmtDuration(totalMinutes) }}</span>
      </div>
      <div class="row" style="gap:8px;margin-top:10px;">
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="hours" type="number" min="0" max="24" aria-label="hours" style="text-align:center;" />
          <div style="margin-top:4px;">hours</div>
        </label>
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="mins" type="number" min="0" max="59" aria-label="minutes" style="text-align:center;" />
          <div style="margin-top:4px;">minutes</div>
        </label>
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="secs" type="number" min="0" max="59" aria-label="seconds" style="text-align:center;" />
          <div style="margin-top:4px;">seconds</div>
        </label>
      </div>
    </div>

    <BookFinder v-if="!multi" @pick="fillFromLookup" />

    <div style="position:relative;">
      <div class="row" style="gap:10px;">
        <img v-if="picked.cover" :src="picked.cover" alt="" style="width:32px;height:45px;object-fit:cover;border-radius:3px 5px 5px 3px;box-shadow:0 1px 3px rgba(0,0,0,.22);flex-shrink:0;" @error="picked.cover = ''" />
        <input v-model="title" placeholder="Title (optional)" autocomplete="off" style="flex:1;min-width:0;" />
      </div>
      <div v-if="linked" class="sub" style="margin-top:5px;color:var(--sage-d);"><i class="ti ti-link" aria-hidden="true"></i> Linked to {{ STATUS_LABEL[selectedBook.status] || 'your shelf' }} on your shelf</div>
      <div v-if="titleMatches.length || (canCreate && !linked)" class="picker">
        <button v-for="b in titleMatches" :key="b.id" type="button" class="picker-row" @click="pickBook(b)">
          <span class="picker-cover" :style="{ background: 'var(--chip)' }">
            <img v-if="b.cover" :src="b.cover" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" @error="b.cover = ''" />
            <span v-else-if="b.emoji">{{ b.emoji }}</span><i v-else class="ti ti-book" aria-hidden="true"></i>
          </span>
          <span style="flex:1;min-width:0;text-align:left;">
            <span style="font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.title }}</span>
            <span class="sub" v-if="b.author">{{ b.author }}</span>
          </span>
          <span class="sub" style="white-space:nowrap;">{{ STATUS_LABEL[b.status] }}</span>
        </button>
        <button v-if="canCreate && !linked" type="button" class="picker-row" :disabled="creating" @click="createBook">
          <span class="picker-cover" style="background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-plus" aria-hidden="true"></i></span>
          <span style="flex:1;min-width:0;text-align:left;">
            <span style="font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ creating ? 'Adding…' : `Add “${title.trim()}” to your shelf` }}</span>
            <span class="sub">Starts it as Reading now</span>
          </span>
        </button>
      </div>
    </div>
    <input v-model="author" placeholder="Author (optional)" />

    <div class="row" style="gap:8px;">
      <button type="button" class="card row" @click="finished = !finished"
        :style="{ flex: '1', gap: '11px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', background: finished ? 'var(--gold-bg)' : 'var(--card)', borderColor: finished ? '#EBD49B' : 'var(--line)' }">
        <span class="av" :style="{ width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0, background: finished ? 'var(--gold)' : 'var(--chip)', color: finished ? '#fff' : 'transparent' }">
          <i class="ti ti-check" style="font-size:15px;" aria-hidden="true"></i>
        </span>
        <span style="font-weight:600;font-size:14px;"><i class="ti ti-confetti" style="color:var(--gold-d);" aria-hidden="true"></i> I finished this book</span>
      </button>
      <InfoBubble text="Adds this book to your shelf as finished. Give it a title above so it can be shelved." />
    </div>
    </template>

    <div v-if="!perBookActive">
      <div class="row" style="justify-content:space-between;margin-bottom:7px;">
        <span style="font-weight:600;"><i class="ti ti-pencil" style="color:var(--terra);" aria-hidden="true"></i> {{ multi ? 'Note for the sitting' : 'Your reading note' }}<InfoBubble text="A short note is how reading gets checked, so it's the one part we ask everyone for." /></span>
        <span class="chip" style="background:var(--blush-bg);color:var(--blush-d);padding:2px 10px;font-size:11px;font-weight:700;">Required</span>
      </div>
      <textarea v-model="summary" placeholder="A sentence or two: what you read, what happened, or what you thought."
        :style="{ borderColor: error && noteMissing ? 'var(--terra)' : 'var(--line)' }"></textarea>
    </div>

    <div v-if="!perBookActive">
      <div class="sub" style="margin-bottom:7px;">Format</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="md in MEDIUMS" :key="md.id" class="chip" :class="{ on: medium === md.id }" @click="medium = md.id">{{ md.label }}</button>
      </div>
    </div>

    <div v-if="!perBookActive">
      <div class="sub" style="margin-bottom:7px;">Genre <span v-if="genres.length" style="color:var(--gold-d);">· new genres earn a bonus</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="g in genreList" :key="g" class="chip" :class="{ on: genres.includes(g) }" @click="toggleGenre(g)">{{ g }}</button>
      </div>
    </div>

    <div>
      <div class="sub" style="margin-bottom:7px;">Optional extras</div>
      <div class="row" style="gap:8px;align-items:stretch;">
        <input v-if="!multi" v-model="pages" type="number" min="0" placeholder="Pages" />
        <input v-model="quote" placeholder="A quote you loved" />
      </div>
    </div>

    <p v-if="error" class="sub" style="color:var(--terra-d);">{{ error }}</p>
    <button class="btn" :disabled="saving" @click="save"><i class="ti ti-check" aria-hidden="true"></i> {{ saving ? 'Saving…' : 'Save session' }}</button>
  </div>

  <div v-else class="screen full" style="text-align:center;justify-content:center;align-items:center;gap:15px;">
    <CoinBurst />
    <Mascot :size="104" eyes="happy" mood="cheer" :variant="store.member?.mascot || 'wizard'" />
    <div class="h" style="font-size:22px;">{{ result.sessionCount > 1 ? `${result.sessionCount} sessions logged!` : 'Session logged!' }}</div>
    <div v-if="milestones.length" class="row pop-in" style="gap:7px;flex-wrap:wrap;justify-content:center;">
      <span v-for="m in milestones" :key="m.text" class="chip" style="background:var(--gold-bg);color:var(--gold-d);font-weight:700;">
        <i :class="['ti', m.icon, m.icon === 'ti-flame' ? 'flame' : '']" aria-hidden="true"></i> {{ m.text }}
      </span>
    </div>
    <div class="card" style="width:100%;display:flex;flex-direction:column;gap:9px;text-align:left;">
      <div class="row" style="justify-content:space-between;">
        <span class="sub"><i class="ti ti-clock" aria-hidden="true"></i> Read {{ fmtDuration(result.minutes) }}</span>
        <span style="font-weight:600;color:var(--gold-d);">+{{ result.base }}</span>
      </div>
      <div v-if="result.isNewGenre" class="row" style="justify-content:space-between;">
        <span class="sub"><i class="ti ti-sparkles" style="color:var(--gold);" aria-hidden="true"></i> New-genre bonus ×{{ result.multiplier }}</span>
        <span style="font-weight:600;color:var(--gold-d);">+{{ result.coins - result.base }}</span>
      </div>
      <div style="height:1px;background:var(--line);margin:1px 0;"></div>
      <div class="row" style="justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">Total earned</span>
        <span style="font-size:24px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ result.coins }}</span>
      </div>
    </div>
    <div class="sub">New balance · {{ result.balance }} coins</div>
    <button class="btn" style="margin-top:2px;" @click="router.replace('/')"><i class="ti ti-check" aria-hidden="true"></i> Done</button>
  </div>
</template>

<style scoped>
.picker {
  position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 30;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 10px 26px rgba(74, 63, 53, .18); overflow: hidden;
}
.picker-row {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 9px 12px; border: none; background: none; cursor: pointer; font-family: inherit; color: var(--ink);
}
.picker-row + .picker-row { border-top: 1px solid var(--line); }
.picker-row:hover { background: var(--paper); }
.picker-cover {
  width: 24px; height: 32px; border-radius: 3px 5px 5px 3px; flex-shrink: 0; overflow: hidden;
  display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--ink2);
}
</style>
