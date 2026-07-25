<script setup>
// The "you finished a book" moment. Every finish path lands here: rate it,
// give it a cover, jot a review, then send it to the shelf. Meant to feel proud.
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { hapticWin } from '../haptics';
import { fmtDuration, bookSpine, COVER_EMOJIS, READER_TITLES } from '../data';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const coins = ref(null);          // coin result, if we arrived from logging a session
const finishedCount = ref(0);
const finishedThisYear = ref(0);
const showCover = ref(false);
const review = ref('');
const busy = ref(false);

const book = computed(() => data.value?.book || null);
const stats = computed(() => data.value?.stats || { minutes: 0, sessions: 0 });
const spineBg = computed(() => (book.value ? bookSpine(book.value).bg : '#C9A06E'));
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

async function reload() { data.value = await api.book(route.params.id); }

onMounted(async () => {
  coins.value = store.takeFinishResult();
  await reload();
  review.value = book.value?.review || '';
  // belt-and-braces: every caller marks it finished first, but confirm it here too
  if (book.value && book.value.status !== 'finished') { await api.updateBook(book.value.id, { status: 'finished' }); await reload(); }
  try {
    const all = await api.books();
    const done = all.filter((b) => b.status === 'finished');
    finishedCount.value = done.length;
    const yr = String(new Date().getFullYear());
    finishedThisYear.value = done.filter((b) => (b.finishedAt || b.createdAt || '').slice(0, 4) === yr).length;
  } catch { /* counts are a nicety */ }
  hapticWin();
});

const milestones = computed(() => {
  const out = [];
  const n = finishedCount.value;
  if (n === 1) out.push({ icon: 'ti-confetti', text: 'Your first finished book!' });
  else if (finishedThisYear.value === 1) out.push({ icon: 'ti-confetti', text: `First book of ${new Date().getFullYear()}!` });
  // landing exactly on a reader-title threshold means you just levelled up
  const lvl = READER_TITLES.find((t) => t.books === n);
  if (lvl && n !== 1) out.push({ icon: 'ti-arrow-up-circle', text: `You're a ${lvl.title} now!` });
  if (coins.value?.goalJustMet) out.push({ icon: 'ti-target', text: 'Monthly goal reached!' });
  if (coins.value?.streakHit) out.push({ icon: 'ti-flame', text: `${coins.value.streakHit}-day streak!` });
  return out;
});

async function rate(n) {
  busy.value = true;
  try { await api.updateBook(book.value.id, { rating: book.value.rating === n ? 0 : n }); await reload(); }
  finally { busy.value = false; }
}
async function setCover(e) {
  busy.value = true;
  try { await api.updateBook(book.value.id, { emoji: e }); await reload(); showCover.value = false; }
  finally { busy.value = false; }
}
async function done() {
  if (book.value && review.value.trim() !== (book.value.review || '')) {
    try { await api.updateBook(book.value.id, { review: review.value.trim() }); } catch { /* don't trap them on the screen */ }
  }
  router.replace('/shelf');
}
</script>

<template>
  <div class="screen full" v-if="book" style="align-items:center;text-align:center;">
    <CoinBurst />
    <div class="row" style="width:100%;justify-content:flex-end;">
      <button class="chip" aria-label="Done" @click="done"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div class="h" style="font-size:24px;margin-top:4px;">You finished it!</div>
    <div v-if="finishedCount" class="sub" style="color:var(--gold-d);font-weight:600;">
      <i class="ti ti-confetti" aria-hidden="true"></i> Your {{ ordinal(finishedCount) }} book on the shelf
    </div>
    <div v-if="milestones.length" class="row pop-in" style="gap:7px;flex-wrap:wrap;justify-content:center;">
      <span v-for="m in milestones" :key="m.text" class="chip" style="background:var(--gold-bg);color:var(--gold-d);font-weight:700;">
        <i :class="['ti', m.icon, m.icon === 'ti-flame' ? 'flame' : '']" aria-hidden="true"></i> {{ m.text }}
      </span>
    </div>

    <!-- the book itself, as a little trophy -->
    <button class="cover" :style="{ background: spineBg }" title="Choose a cover" @click="showCover = !showCover">
      <img v-if="book.cover" :src="book.cover" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:6px 11px 11px 6px;" @error="book.cover = ''" />
      <span v-else-if="book.emoji" style="font-size:46px;">{{ book.emoji }}</span>
      <i v-else class="ti ti-book" style="font-size:40px;color:#fff;opacity:.92;" aria-hidden="true"></i>
      <span class="cover-badge"><i class="ti ti-check" aria-hidden="true"></i></span>
    </button>
    <button class="chip" style="padding:3px 11px;font-size:12px;margin-top:-4px;" @click="showCover = !showCover"><i class="ti ti-photo" aria-hidden="true"></i> Cover</button>
    <div v-if="showCover" class="row pop-in" style="gap:6px;flex-wrap:wrap;justify-content:center;">
      <button v-for="e in COVER_EMOJIS" :key="e || 'none'" class="chip" :class="{ on: (book.emoji || '') === e }" style="width:34px;height:34px;justify-content:center;padding:0;font-size:16px;" :aria-label="e || 'no cover'" @click="setCover(e)">
        <span v-if="e">{{ e }}</span><i v-else class="ti ti-ban" style="font-size:13px;" aria-hidden="true"></i>
      </button>
    </div>

    <div style="margin-top:2px;">
      <div class="h" style="font-size:20px;">{{ book.title }}</div>
      <div class="sub" v-if="book.author">{{ book.author }}</div>
    </div>

    <!-- rate it -->
    <div>
      <div class="sub" style="margin-bottom:4px;">How was it?</div>
      <div class="row" style="gap:5px;justify-content:center;">
        <button v-for="n in 5" :key="n" :disabled="busy" @click="rate(n)" aria-label="rate" style="border:none;background:none;cursor:pointer;font-size:30px;line-height:1;padding:0;color:var(--gold);" :style="{ opacity: n <= (book.rating || 0) ? 1 : 0.24 }">★</button>
      </div>
    </div>

    <!-- coins earned, only when this came from a logged session -->
    <div v-if="coins" class="card" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:var(--gold-bg);border-color:#EBD49B;">
      <span class="sub" style="color:var(--gold-d);">
        <i class="ti ti-clock" aria-hidden="true"></i> {{ fmtDuration(coins.minutes) }} this session<template v-if="coins.isNewGenre"> · new-genre bonus</template>
      </span>
      <span style="font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ coins.coins }}</span>
    </div>

    <!-- time spent with the whole book -->
    <div class="row" style="gap:18px;justify-content:center;">
      <div><span style="font-weight:700;font-family:'Quicksand';font-size:16px;">{{ fmtDuration(stats.minutes) }}</span> <span class="sub">with it</span></div>
      <div><span style="font-weight:700;font-family:'Quicksand';font-size:16px;">{{ stats.sessions }}</span> <span class="sub">session{{ stats.sessions === 1 ? '' : 's' }}</span></div>
    </div>

    <!-- a few words for the collection -->
    <div style="width:100%;text-align:left;">
      <div class="sub" style="margin-bottom:6px;"><i class="ti ti-quote" style="color:var(--terra);" aria-hidden="true"></i> Your review <span style="opacity:.7;">(optional)</span></div>
      <textarea v-model="review" rows="3" placeholder="A line you loved, how it made you feel, who should read it next."></textarea>
    </div>

    <button class="btn" :disabled="busy" @click="done"><i class="ti ti-books" aria-hidden="true"></i> Add to my shelf</button>
  </div>
</template>

<style scoped>
.cover {
  position: relative;
  width: 96px; height: 128px;
  border: none; border-radius: 6px 11px 11px 6px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 20px rgba(74, 63, 53, .3), inset -4px 0 7px rgba(0, 0, 0, .2), inset 4px 0 5px rgba(255, 255, 255, .16);
  margin-top: 6px;
}
.cover-badge {
  position: absolute; right: -7px; bottom: -7px;
  width: 30px; height: 30px; border-radius: 50%;
  background: var(--sage); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; box-shadow: 0 2px 6px rgba(0, 0, 0, .25); border: 2px solid var(--cream);
}
</style>
