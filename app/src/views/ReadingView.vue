<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../store';
import { fmtClock } from '../data';

const router = useRouter();
const now = ref(Date.now());
let tick = null;

onMounted(() => {
  if (!store.timer) store.startTimer(''); // fresh start; otherwise resume the persisted one
  tick = setInterval(() => { now.value = Date.now(); }, 1000);
});
onUnmounted(() => clearInterval(tick));

const running = computed(() => !!store.timer?.running);
const seconds = computed(() => { now.value; return Math.floor(store.elapsedMs() / 1000); });
const title = computed({ get: () => store.timer?.title || '', set: (v) => store.setTimerTitle(v) });

function toggle() { running.value ? store.pauseTimer() : store.resumeTimer(); }
function finish() {
  const seconds = Math.max(1, Math.round(store.elapsedMs() / 1000));
  const t = store.timer?.title || '';
  store.clearTimer();
  store.draft = { seconds, title: t };
  router.replace('/log');
}
function cancel() { store.clearTimer(); router.replace('/'); }
</script>

<template>
  <div class="screen full" style="text-align:center;">
    <div class="row" style="justify-content:space-between;">
      <button class="chip" @click="cancel"><i class="ti ti-x" aria-hidden="true"></i></button>
      <span class="sub"><i class="ti ti-book-2" aria-hidden="true"></i> Reading session</span>
      <button class="chip" aria-label="Minimize" title="Keep timing in the background" @click="router.push('/')"><i class="ti ti-minus" aria-hidden="true"></i></button>
    </div>

    <input v-model="title" placeholder="What are you reading? (optional)" style="text-align:center;margin-top:8px;" />

    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <Mascot :size="100" eyes="happy" :variant="store.member?.mascot || 'wizard'" :mood="running ? 'cheer' : 'idle'" />
      <div style="font-size:54px;font-weight:700;font-family:'Quicksand';color:var(--ink);">{{ fmtClock(seconds) }}</div>
      <div class="sub">
        <i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i>
        {{ running ? "You're earning coins as you read" : "Paused — resume when you're ready" }}
      </div>
      <div class="sub" style="font-size:12px;opacity:.8;max-width:240px;">Leave the app if you like — your time keeps counting.</div>
    </div>

    <div class="row" style="gap:10px;">
      <button class="btn soft" @click="toggle">
        <i :class="running ? 'ti ti-player-pause' : 'ti ti-player-play'" aria-hidden="true"></i>
        {{ running ? 'Pause' : 'Resume' }}
      </button>
      <button class="btn" @click="finish"><i class="ti ti-check" aria-hidden="true"></i> Finish</button>
    </div>
  </div>
</template>
