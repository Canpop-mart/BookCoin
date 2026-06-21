<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { fmtDuration, MEDIUMS, bookSpine } from '../data';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const editMeta = ref(false);
const editReview = ref(false);
const meta = reactive({ title: '', author: '' });
const reviewDraft = ref('');
const showCover = ref(false);
const busy = ref(false);

const book = computed(() => data.value?.book || null);
const sessions = computed(() => data.value?.sessions || []);
const stats = computed(() => data.value?.stats || { minutes: 0, sessions: 0, coins: 0 });
const spineBg = computed(() => (book.value ? bookSpine(book.value).bg : '#C9A06E'));
const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;
const fmtDate = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '');

const COVER_EMOJIS = ['', '📕', '📗', '📘', '📙', '📚', '🐉', '🚀', '🔮', '🗺️', '🏰', '💀', '❤️', '🌙', '⭐', '🦄', '🐈', '☕', '🌸', '🔪', '🧪', '⚔️', '👑', '🌊'];
const STATUSES = [['want', 'Want to read', 'ti-bookmark'], ['reading', 'Reading', 'ti-book'], ['finished', 'Finished', 'ti-check']];

async function load() { data.value = await api.book(route.params.id); }
onMounted(load);
watch(() => route.params.id, load);

async function save(patch, after) {
  busy.value = true;
  try { await api.updateBook(book.value.id, patch); await load(); if (after) after(); }
  finally { busy.value = false; }
}
function startEditMeta() { meta.title = book.value.title; meta.author = book.value.author || ''; editMeta.value = true; }
function saveMeta() { if (!meta.title.trim()) return; save({ title: meta.title.trim(), author: meta.author.trim() }, () => { editMeta.value = false; }); }
function startReview() { reviewDraft.value = book.value.review || ''; editReview.value = true; }
function saveReview() { save({ review: reviewDraft.value.trim() }, () => { editReview.value = false; }); }
function rate(n) { save({ rating: book.value.rating === n ? 0 : n, status: 'finished' }); }
async function remove() {
  if (!confirm(`Remove “${book.value.title}” from your shelf?`)) return;
  await api.removeBook(book.value.id);
  router.replace('/shelf');
}
</script>

<template>
  <div class="screen" v-if="book">
    <div class="row" style="justify-content:space-between;">
      <button class="chip" @click="router.back()"><i class="ti ti-arrow-left" aria-hidden="true"></i> Shelf</button>
      <button class="chip" aria-label="remove" @click="remove"><i class="ti ti-trash" aria-hidden="true"></i></button>
    </div>

    <!-- hero -->
    <div class="card" style="display:flex;flex-direction:column;gap:12px;align-items:center;text-align:center;">
      <button class="av" style="width:74px;height:98px;border:none;border-radius:5px 9px 9px 5px;font-size:38px;cursor:pointer;box-shadow:0 4px 10px rgba(74,63,53,.22);"
        :style="{ background: spineBg }" title="Change cover" @click="showCover = !showCover">
        <span v-if="book.emoji">{{ book.emoji }}</span><i v-else class="ti ti-book" style="font-size:30px;color:#fff;opacity:.92;" aria-hidden="true"></i>
      </button>

      <div v-if="!editMeta" style="min-width:0;">
        <div class="h" style="font-size:20px;">{{ book.title }}</div>
        <div class="sub" v-if="book.author">{{ book.author }}</div>
        <button class="chip" style="margin-top:7px;padding:3px 11px;" @click="startEditMeta"><i class="ti ti-edit" aria-hidden="true"></i> Edit details</button>
      </div>
      <div v-else style="width:100%;display:flex;flex-direction:column;gap:8px;">
        <input v-model="meta.title" placeholder="Title" />
        <input v-model="meta.author" placeholder="Author (optional)" />
        <div class="row" style="gap:8px;justify-content:center;">
          <button class="btn" style="width:auto;padding:9px 18px;" :disabled="busy || !meta.title.trim()" @click="saveMeta"><i class="ti ti-check" aria-hidden="true"></i> Save</button>
          <button class="chip" @click="editMeta = false">Cancel</button>
        </div>
      </div>

      <div v-if="showCover" class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;">
        <button v-for="e in COVER_EMOJIS" :key="e || 'none'" class="chip" :class="{ on: (book.emoji || '') === e }" style="width:34px;height:34px;justify-content:center;padding:0;font-size:16px;" :aria-label="e || 'no cover'" @click="save({ emoji: e })">
          <span v-if="e">{{ e }}</span><i v-else class="ti ti-ban" style="font-size:13px;" aria-hidden="true"></i>
        </button>
      </div>

      <div class="row" style="gap:7px;justify-content:center;flex-wrap:wrap;">
        <button v-for="[id, label, icon] in STATUSES" :key="id" class="chip" :class="{ on: book.status === id }" :disabled="busy" @click="save({ status: id })">
          <i :class="['ti', icon]" aria-hidden="true"></i> {{ label }}
        </button>
      </div>

      <div v-if="book.status === 'finished'" class="row" style="gap:3px;justify-content:center;">
        <span v-for="n in 5" :key="n" @click="rate(n)" style="cursor:pointer;font-size:20px;line-height:1;color:var(--gold);" :style="{ opacity: n <= (book.rating || 0) ? 1 : 0.26 }">★</span>
      </div>
    </div>

    <!-- stats -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div class="card" style="text-align:center;padding:13px 6px;">
        <div style="font-size:18px;font-weight:700;font-family:'Quicksand';">{{ fmtDuration(stats.minutes) }}</div><div class="sub">Time with it</div>
      </div>
      <div class="card" style="text-align:center;padding:13px 6px;">
        <div style="font-size:18px;font-weight:700;font-family:'Quicksand';">{{ stats.sessions }}</div><div class="sub">Sessions</div>
      </div>
      <div class="card" style="text-align:center;padding:13px 6px;">
        <div style="font-size:18px;font-weight:700;font-family:'Quicksand';color:var(--gold-d);">{{ stats.coins }}</div><div class="sub">Coins</div>
      </div>
    </div>
    <p v-if="book.finishedAt" class="sub" style="text-align:center;margin-top:-4px;"><i class="ti ti-confetti" style="color:var(--gold-d);" aria-hidden="true"></i> Finished {{ fmtDate(book.finishedAt) }}</p>

    <!-- your thoughts (review) -->
    <div class="card" style="display:flex;flex-direction:column;gap:9px;">
      <div class="sub"><i class="ti ti-quote" style="color:var(--terra);" aria-hidden="true"></i> Your thoughts</div>
      <template v-if="!editReview">
        <p v-if="book.review" style="font-family:'Quicksand';line-height:1.5;white-space:pre-wrap;">{{ book.review }}</p>
        <button class="chip" style="align-self:flex-start;" @click="startReview"><i :class="book.review ? 'ti ti-edit' : 'ti ti-plus'" aria-hidden="true"></i> {{ book.review ? 'Edit' : 'Add your review' }}</button>
      </template>
      <template v-else>
        <textarea v-model="reviewDraft" placeholder="What did you think? A line you loved, how it made you feel…" rows="4"></textarea>
        <div class="row" style="gap:8px;">
          <button class="btn" style="width:auto;padding:9px 18px;" :disabled="busy" @click="saveReview"><i class="ti ti-check" aria-hidden="true"></i> Save</button>
          <button class="chip" @click="editReview = false">Cancel</button>
        </div>
      </template>
    </div>

    <!-- the trophy room: every session with this book -->
    <div class="sub" style="margin-top:2px;"><i class="ti ti-history" aria-hidden="true"></i> Your time with this book</div>
    <div v-if="!sessions.length" class="card sub" style="text-align:center;">No sessions logged for this title yet — when you read it and log time, your moments collect here.</div>
    <div v-else class="stagger" style="display:flex;flex-direction:column;gap:10px;">
      <div v-for="s in sessions" :key="s.id" class="card" style="display:flex;flex-direction:column;gap:7px;">
        <div class="row" style="justify-content:space-between;">
          <span style="font-weight:600;font-family:'Quicksand';">{{ fmtDuration(s.minutes) }}</span>
          <span class="sub">{{ fmtDate(s.createdAt) }}</span>
        </div>
        <div class="sub" v-if="s.medium || s.genres?.length">{{ [mediumLabel(s.medium), ...(s.genres || [])].filter(Boolean).join(' · ') }}</div>
        <p v-if="s.summary" style="line-height:1.5;white-space:pre-wrap;">{{ s.summary }}</p>
        <blockquote v-if="s.quote" style="margin:0;padding:8px 12px;background:var(--paper);border-left:3px solid var(--gold);border-radius:0 10px 10px 0;font-family:'Quicksand';font-style:italic;color:var(--ink);">“{{ s.quote }}”</blockquote>
      </div>
    </div>
  </div>
</template>
