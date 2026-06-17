<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { bookSpine } from '../data';

const router = useRouter();
const books = ref([]);
const loading = ref(true);
const busy = ref(null);
const showAdd = ref(false);
const selectedId = ref(null);
const form = reactive({ title: '', author: '', status: 'reading' });

async function load() { try { books.value = await api.books(); } finally { loading.value = false; } }
onMounted(load);

const reading = computed(() => books.value.filter((b) => b.status === 'reading'));
const want = computed(() => books.value.filter((b) => b.status === 'want'));
const finished = computed(() => books.value.filter((b) => b.status === 'finished'));
const thisYear = String(new Date().getFullYear());
const finishedThisYear = computed(() => finished.value.filter((b) => (b.finishedAt || b.createdAt || '').slice(0, 4) === thisYear).length);
const selected = computed(() => books.value.find((b) => b.id === selectedId.value) || null);

// stable per-book spine look (shared with the profile mini-shelf)
function spine(b) {
  const s = bookSpine(b);
  return { bg: s.bg, height: 116 + s.tall * 8, width: 30 + s.wide * 4 };
}

async function add() {
  if (!form.title.trim()) return;
  busy.value = 'add';
  try {
    await api.addBook({ title: form.title.trim(), author: form.author.trim(), status: form.status });
    form.title = ''; form.author = ''; showAdd.value = false;
    await load();
  } finally { busy.value = null; }
}
async function setStatus(b, status) {
  busy.value = b.id;
  try { await api.updateBook(b.id, { status }); await load(); } finally { busy.value = null; }
}
async function rate(b, n) { await api.updateBook(b.id, { rating: b.rating === n ? 0 : n, status: 'finished' }); await load(); }
async function remove(b) {
  if (!confirm(`Remove “${b.title}” from your shelf?`)) return;
  if (selectedId.value === b.id) selectedId.value = null;
  await api.removeBook(b.id);
  await load();
}
const fmtDate = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');
</script>

<template>
  <div class="screen">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-books" style="color:var(--terra);" aria-hidden="true"></i> My shelf</div>
      <button class="chip" @click="router.push('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div class="card row" style="justify-content:space-between;background:var(--gold-bg);border-color:#EBD49B;">
      <div>
        <div style="font-weight:600;"><i class="ti ti-confetti" style="color:var(--gold-d);" aria-hidden="true"></i> {{ finished.length }} book{{ finished.length === 1 ? '' : 's' }} on the shelf</div>
        <div class="sub" style="color:var(--gold-d);opacity:.85;">{{ finishedThisYear }} finished in {{ thisYear }} · {{ reading.length }} reading · {{ want.length }} up next</div>
      </div>
      <button class="chip" style="background:var(--card);" @click="showAdd = !showAdd"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
    </div>

    <div v-if="showAdd" class="card pop-in" style="display:flex;flex-direction:column;gap:9px;">
      <input v-model="form.title" placeholder="Book title" />
      <input v-model="form.author" placeholder="Author (optional)" />
      <div class="row" style="gap:7px;">
        <button class="chip" :class="{ on: form.status === 'reading' }" style="flex:1;justify-content:center;" @click="form.status = 'reading'"><i class="ti ti-book" aria-hidden="true"></i> Reading</button>
        <button class="chip" :class="{ on: form.status === 'want' }" style="flex:1;justify-content:center;" @click="form.status = 'want'"><i class="ti ti-bookmark" aria-hidden="true"></i> Want to read</button>
      </div>
      <button class="btn" :disabled="busy === 'add' || !form.title.trim()" @click="add"><i class="ti ti-check" aria-hidden="true"></i> Add to shelf</button>
    </div>

    <div v-if="loading" class="card sub">Loading your shelf…</div>

    <!-- READING NOW -->
    <template v-if="!loading && reading.length">
      <div class="sub" style="margin-top:2px;"><i class="ti ti-book" aria-hidden="true"></i> Reading now</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
        <div v-for="b in reading" :key="b.id" class="card row" style="gap:12px;">
          <span class="av" style="width:38px;height:50px;border-radius:4px 7px 7px 4px;flex-shrink:0;" :style="{ background: spine(b).bg }"><i class="ti ti-book" style="font-size:18px;color:#fff;opacity:.9;" aria-hidden="true"></i></span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.title }}</div>
            <div class="sub" v-if="b.author">{{ b.author }}</div>
          </div>
          <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);white-space:nowrap;" :disabled="busy === b.id" @click="setStatus(b, 'finished')"><i class="ti ti-check" aria-hidden="true"></i> Finish</button>
          <button class="chip" aria-label="remove" @click="remove(b)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>
    </template>

    <!-- THE BOOKSHELF -->
    <div v-if="!loading" class="sub" style="margin-top:4px;"><i class="ti ti-books" aria-hidden="true"></i> Finished — your collection</div>
    <div v-if="!loading" class="bookcase">
      <div v-if="!finished.length" class="shelf-empty">Finish a book and its spine appears here. Your collection grows as you read.</div>
      <div v-else class="shelf">
        <div v-for="b in finished" :key="b.id" class="slot">
          <button class="spine" :class="{ sel: selectedId === b.id }" :style="{ height: spine(b).height + 'px', width: spine(b).width + 'px', background: spine(b).bg }"
            @click="selectedId = selectedId === b.id ? null : b.id" :title="b.title">
            <span class="spine-title">{{ b.title }}</span>
            <span class="spine-stars" v-if="b.rating">{{ '★'.repeat(b.rating) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- selected spine detail -->
    <div v-if="selected" class="card pop-in" style="display:flex;gap:12px;align-items:center;">
      <span class="av" style="width:34px;height:46px;border-radius:4px 7px 7px 4px;flex-shrink:0;" :style="{ background: spine(selected).bg }"></span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;">{{ selected.title }}</div>
        <div class="sub" v-if="selected.author">{{ selected.author }}</div>
        <div class="row" style="gap:3px;margin-top:3px;">
          <span v-for="n in 5" :key="n" @click="rate(selected, n)" style="cursor:pointer;font-size:16px;line-height:1;color:var(--gold);" :style="{ opacity: n <= (selected.rating || 0) ? 1 : 0.28 }">★</span>
          <span class="sub" style="margin-left:6px;">{{ fmtDate(selected.finishedAt) }}</span>
        </div>
      </div>
      <button class="chip" aria-label="remove" @click="remove(selected)"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>

    <!-- WANT TO READ -->
    <template v-if="!loading && want.length">
      <div class="sub" style="margin-top:4px;"><i class="ti ti-bookmark" aria-hidden="true"></i> Up next</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="b in want" :key="b.id" class="card row" style="gap:11px;padding:10px 14px;">
          <i class="ti ti-bookmark" style="color:var(--ink2);font-size:16px;flex-shrink:0;" aria-hidden="true"></i>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.title }}</div>
            <div class="sub" v-if="b.author">{{ b.author }}</div>
          </div>
          <button class="chip" style="white-space:nowrap;" :disabled="busy === b.id" @click="setStatus(b, 'reading')"><i class="ti ti-player-play" aria-hidden="true"></i> Start</button>
          <button class="chip" aria-label="remove" @click="remove(b)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>
    </template>

    <div v-if="!loading && !books.length" class="card sub" style="text-align:center;padding:24px 16px;">
      <i class="ti ti-book-2" style="font-size:30px;color:var(--ink2);display:block;margin-bottom:6px;" aria-hidden="true"></i>
      Your shelf is empty. Add the book you're reading now to get started.
    </div>
  </div>
</template>

<style scoped>
.bookcase {
  background: #4A3526;
  border: 1px solid #3A2A1E;
  border-radius: 16px;
  padding: 12px 10px 0;
  box-shadow: inset 0 2px 10px rgba(0, 0, 0, .28);
}
.shelf {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  /* a wooden board every 158px so spines stand on a shelf */
  background:
    repeating-linear-gradient(to bottom,
      transparent 0, transparent 147px,
      #C9A06E 147px, #C9A06E 150px,
      #A97E4F 150px, #8A6238 158px);
}
.slot {
  height: 158px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 0 2px 11px;
}
.spine {
  border: none;
  cursor: pointer;
  border-radius: 3px 3px 1px 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0;
  box-shadow: inset -3px 0 5px rgba(0, 0, 0, .22), inset 3px 0 4px rgba(255, 255, 255, .14), 0 3px 4px rgba(0, 0, 0, .3);
  transition: transform .16s ease;
  overflow: hidden;
}
.spine::before, .spine::after {
  content: '';
  position: absolute;
  left: 4px; right: 4px;
  height: 2px;
  background: rgba(255, 255, 255, .35);
}
.spine::before { top: 9px; }
.spine::after { bottom: 9px; }
.spine:hover { transform: translateY(-4px); }
.spine.sel { transform: translateY(-9px); box-shadow: inset -3px 0 5px rgba(0,0,0,.22), 0 6px 10px rgba(0,0,0,.4); }
.spine-title {
  writing-mode: vertical-rl;
  font-size: 11px;
  font-weight: 600;
  font-family: 'Quicksand', sans-serif;
  color: rgba(255, 255, 255, .94);
  white-space: nowrap;
  overflow: hidden;
  max-height: calc(100% - 26px);
  text-shadow: 0 1px 2px rgba(0, 0, 0, .35);
  letter-spacing: .2px;
}
.spine-stars {
  position: absolute;
  bottom: 12px;
  font-size: 7px;
  color: rgba(255, 255, 255, .8);
  letter-spacing: -1px;
}
.shelf-empty {
  color: #E7D6BF;
  font-size: 13px;
  text-align: center;
  padding: 30px 18px;
  border-bottom: 11px solid;
  border-image: linear-gradient(#C9A06E, #8A6238) 1;
}
</style>
