<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../store';
import { api } from '../api';
import { fmtClock, fmtLap } from '../data';

const router = useRouter();
const now = ref(Date.now());
let tick = null;

// pick-a-book step, shown only when starting fresh (no timer already running)
const choosing = ref(false);
const shelf = ref([]);
const loadingShelf = ref(true);

onMounted(async () => {
  if (!store.timer) {
    // fresh start: let them pick a shelf book before the clock starts
    choosing.value = true;
    try {
      const books = await api.books();
      // only what you're actively reading, not the up-next pile
      shelf.value = books.filter((b) => b.status === 'reading');
    } catch { /* no shelf suggestions, still fine to start */ }
    finally { loadingShelf.value = false; }
  }
  tick = setInterval(() => { now.value = Date.now(); }, 1000);
});
onUnmounted(() => clearInterval(tick));

function startWithBook(b) {
  store.startTimer(b.title, { cover: b.cover || '', bookId: b.id });
  choosing.value = false;
}
function startBlank() {
  store.startTimer('');
  choosing.value = false;
}

const running = computed(() => !!store.timer?.running);
const seconds = computed(() => { now.value; return Math.floor(store.elapsedMs() / 1000); });
const title = computed({ get: () => store.timer?.title || '', set: (v) => store.setTimerTitle(v) });
const cover = computed(() => store.timer?.cover || '');
const segments = computed(() => store.timer?.segments || []);

function toggle() { running.value ? store.pauseTimer() : store.resumeTimer(); }
function split() { store.splitTimer(); }
// marking a book finished lives on the log screen, not here
function finish() {
  const seconds = Math.max(1, Math.round(store.elapsedMs() / 1000));
  const t = store.timer?.title || '';
  // every banked lap plus whatever is on the clock right now
  const laps = [...(store.timer?.segments || []), { seconds, title: t }];
  const meta = { bookId: store.timer?.bookId || null, cover: store.timer?.cover || '' };
  store.clearTimer();
  store.setDraft({ seconds, title: t, segments: laps, ...meta });
  router.replace('/log');
}
function cancel() { store.clearTimer(); router.replace('/'); }
</script>

<template>
  <!-- pick a book to read -->
  <div v-if="choosing" class="screen full">
    <div class="row" style="justify-content:space-between;">
      <button class="chip" @click="router.replace('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
      <span class="sub"><i class="ti ti-book-2" aria-hidden="true"></i> Start reading</span>
      <span style="width:36px;"></span>
    </div>
    <div class="h" style="margin-top:6px;">What are you reading?</div>

    <div v-if="loadingShelf" class="card sub">Loading your shelf…</div>
    <template v-else>
      <div v-if="shelf.length" class="stagger" style="display:flex;flex-direction:column;gap:9px;">
        <button v-for="b in shelf" :key="b.id" class="card row" style="gap:12px;text-align:left;cursor:pointer;width:100%;" @click="startWithBook(b)">
          <span class="av" style="width:38px;height:52px;border-radius:4px 7px 7px 4px;overflow:hidden;background:#EFE0F0;color:#6E5E94;flex-shrink:0;">
            <img v-if="b.cover" :src="b.cover" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;" @error="b.cover = ''" />
            <span v-else-if="b.emoji">{{ b.emoji }}</span><i v-else class="ti ti-book" aria-hidden="true"></i>
          </span>
          <span style="flex:1;min-width:0;">
            <span style="font-weight:600;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.title }}</span>
            <span class="sub" v-if="b.author">{{ b.author }}</span>
          </span>
          <i class="ti ti-player-play" style="color:var(--terra);font-size:19px;flex-shrink:0;" aria-hidden="true"></i>
        </button>
      </div>
      <div v-else class="card sub" style="text-align:center;">Nothing marked as reading right now. Start below, or mark a book as reading on your shelf.</div>

      <button class="btn soft" style="margin-top:2px;" @click="startBlank"><i class="ti ti-clock" aria-hidden="true"></i> Start without a book</button>
    </template>
  </div>

  <!-- the running session -->
  <div v-else class="screen full" style="text-align:center;">
    <div class="row" style="justify-content:space-between;">
      <button class="chip" @click="cancel"><i class="ti ti-x" aria-hidden="true"></i></button>
      <span class="sub"><i class="ti ti-book-2" aria-hidden="true"></i> Reading session</span>
      <button class="chip" aria-label="Minimize" title="Keep timing in the background" @click="router.push('/')"><i class="ti ti-minus" aria-hidden="true"></i></button>
    </div>

    <div class="row" style="gap:10px;margin-top:8px;">
      <img v-if="cover" :src="cover" alt="" style="width:34px;height:48px;object-fit:cover;border-radius:3px 6px 6px 3px;box-shadow:0 1px 4px rgba(0,0,0,.25);flex-shrink:0;" />
      <input v-model="title" placeholder="What are you reading? (optional)" style="flex:1;text-align:center;" />
    </div>

    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <Mascot :size="100" eyes="happy" :variant="store.member?.mascot || 'wizard'" :mood="running ? 'cheer' : 'idle'" />
      <div style="font-size:54px;font-weight:700;font-family:'Quicksand';color:var(--ink);">{{ fmtClock(seconds) }}</div>
      <div class="sub">
        <i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i>
        {{ running ? "You're earning coins as you read" : "Paused. Resume when you're ready." }}
      </div>
      <div class="sub" style="font-size:12px;opacity:.8;max-width:240px;">Leave the app if you like. Your time keeps counting.</div>
      <div v-if="segments.length" class="row" style="gap:6px;flex-wrap:wrap;justify-content:center;max-width:300px;">
        <span v-for="(s, i) in segments" :key="i" class="chip" style="font-size:12px;background:var(--sage-bg);color:var(--sage-d);">
          <i class="ti ti-check" aria-hidden="true"></i> {{ s.title || `Book ${i + 1}` }} · {{ fmtLap(s.seconds) }}
        </span>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="row" style="gap:10px;">
        <button class="btn soft" @click="toggle">
          <i :class="running ? 'ti ti-player-pause' : 'ti ti-player-play'" aria-hidden="true"></i>
          {{ running ? 'Pause' : 'Resume' }}
        </button>
        <button class="btn soft" @click="split"><i class="ti ti-arrows-split-2" aria-hidden="true"></i> Split</button>
        <InfoBubble text="Banks the time so far and keeps the clock running. Use it when you switch books mid-session, or when one session spreads across several sittings." />
      </div>
      <button class="btn" @click="finish()"><i class="ti ti-check" aria-hidden="true"></i> Done reading</button>
    </div>
  </div>
</template>
