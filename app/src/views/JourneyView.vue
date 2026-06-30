<script setup>
// Full log of every reading session: search, filter by format, grouped by month,
// and the place to retroactively link an old session to a book on your shelf.
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { fmtDuration, MEDIUMS, monthName } from '../data';

const router = useRouter();
const sessions = ref([]);
const books = ref([]);
const loading = ref(true);
const q = ref('');
const fmt = ref('all');
const openId = ref(null);
const assigningId = ref(null);
const busy = ref(null);

async function load() {
  try { [sessions.value, books.value] = await Promise.all([api.mySessions(), api.books()]); }
  finally { loading.value = false; }
}
onMounted(load);

const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;
const fmtDate = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const monthLabel = (ym) => (ym && ym.length >= 7 ? `${monthName(ym)} ${ym.slice(0, 4)}` : 'Undated');

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase();
  return sessions.value.filter((x) =>
    (fmt.value === 'all' || x.medium === fmt.value)
    && (!s || (x.title || '').toLowerCase().includes(s) || (x.summary || '').toLowerCase().includes(s)));
});

// group the filtered sessions by month, newest month first
const groups = computed(() => {
  const map = new Map();
  for (const x of filtered.value) {
    const k = (x.createdAt || '').slice(0, 7);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(x);
  }
  return [...map.entries()].map(([key, items]) => ({
    key, label: monthLabel(key), minutes: items.reduce((a, b) => a + b.minutes, 0), items,
  }));
});

const totalMinutes = computed(() => sessions.value.reduce((a, b) => a + b.minutes, 0));

function toggle(id) { openId.value = openId.value === id ? null : id; assigningId.value = null; }
async function assign(s, book) {
  busy.value = s.id;
  try { await api.linkSession(s.id, book.id); assigningId.value = null; await load(); }
  finally { busy.value = null; }
}
async function requestDelete(s) {
  if (!confirm('Ask an admin to remove this session? If approved, its coins are taken back.')) return;
  busy.value = s.id;
  try { await api.requestDeleteSession(s.id); await load(); } finally { busy.value = null; }
}
async function cancelDelete(s) {
  busy.value = s.id;
  try { await api.cancelDeleteSession(s.id); await load(); } finally { busy.value = null; }
}
const logTitle = (s) => s.title || (mediumLabel(s.medium) + ' session');
const logMeta = (s) => [fmtDuration(s.minutes), s.title ? mediumLabel(s.medium) : null, s.genres?.length ? s.genres.join(', ') : null].filter(Boolean).join(' · ');
</script>

<template>
  <div class="screen">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-history" style="color:var(--terra);" aria-hidden="true"></i> Reading journey</div>
      <button class="chip" @click="router.back()"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
    </div>

    <div class="card row" style="justify-content:space-around;text-align:center;">
      <div><div style="font-weight:700;font-family:'Quicksand';font-size:18px;">{{ sessions.length }}</div><div class="sub">sessions</div></div>
      <div><div style="font-weight:700;font-family:'Quicksand';font-size:18px;">{{ fmtDuration(totalMinutes) }}</div><div class="sub">all time</div></div>
    </div>

    <div class="row" style="position:relative;">
      <i class="ti ti-search" style="position:absolute;left:13px;color:var(--ink2);font-size:16px;" aria-hidden="true"></i>
      <input v-model="q" placeholder="Search your sessions" style="padding-left:36px;" aria-label="Search your sessions" />
    </div>
    <div class="row" style="gap:7px;flex-wrap:wrap;">
      <button class="chip" :class="{ on: fmt === 'all' }" @click="fmt = 'all'">All</button>
      <button v-for="md in MEDIUMS" :key="md.id" class="chip" :class="{ on: fmt === md.id }" @click="fmt = md.id">{{ md.label }}</button>
    </div>

    <div v-if="loading" class="card sub">Loading…</div>
    <div v-else-if="!filtered.length" class="card sub" style="text-align:center;">No sessions match.</div>

    <template v-for="g in groups" :key="g.key">
      <div class="row" style="justify-content:space-between;margin-top:4px;">
        <span class="sub" style="font-weight:600;">{{ g.label }}</span>
        <span class="sub">{{ fmtDuration(g.minutes) }}</span>
      </div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="s in g.items" :key="s.id" class="card" style="padding:0;overflow:hidden;">
          <button @click="toggle(s.id)" style="display:flex;align-items:center;gap:11px;width:100%;background:none;border:none;cursor:pointer;padding:12px 15px;text-align:left;font-family:inherit;">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ logTitle(s) }}</div>
              <div class="sub">{{ logMeta(s) }}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div style="font-weight:600;color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ s.coins }}</div>
              <div class="sub" style="font-size:11px;">{{ fmtDate(s.createdAt) }}</div>
            </div>
            <span v-if="s.deleteRequested" class="chip" style="padding:2px 8px;font-size:11px;background:#FBE0D2;color:var(--terra-d);flex-shrink:0;">pending</span>
            <i class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;flex-shrink:0;" :style="{ transform: openId === s.id ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
          </button>
          <div v-if="openId === s.id" style="padding:11px 15px 13px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:9px;">
            <div v-if="s.summary" style="font-size:14px;line-height:1.5;white-space:pre-wrap;">{{ s.summary }}</div>
            <div v-if="s.quote" class="sub" style="font-style:italic;">“{{ s.quote }}”</div>

            <template v-if="assigningId === s.id">
              <div class="sub">Link this session to a book on your shelf:</div>
              <div class="row" style="gap:6px;flex-wrap:wrap;">
                <button v-for="b in books" :key="b.id" class="chip" :disabled="busy === s.id" @click="assign(s, b)">
                  <span v-if="b.emoji">{{ b.emoji }}</span><i v-else class="ti ti-book" aria-hidden="true"></i> {{ b.title }}
                </button>
                <span v-if="!books.length" class="sub">No books on your shelf yet. Add one from your shelf first.</span>
              </div>
              <button class="chip" style="align-self:flex-start;" @click="assigningId = null">Cancel</button>
            </template>
            <div v-else class="row" style="gap:8px;flex-wrap:wrap;">
              <button class="chip" @click="assigningId = s.id"><i class="ti ti-link" aria-hidden="true"></i> Assign to book</button>
              <template v-if="s.deleteRequested">
                <span class="sub" style="flex:1;align-self:center;"><i class="ti ti-clock" aria-hidden="true"></i> Removal requested</span>
                <button class="chip" :disabled="busy === s.id" @click="cancelDelete(s)">Cancel request</button>
              </template>
              <button v-else class="chip" style="color:var(--terra-d);margin-left:auto;" :disabled="busy === s.id" @click="requestDelete(s)"><i class="ti ti-trash" aria-hidden="true"></i> Request removal</button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
