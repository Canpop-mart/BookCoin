<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { store } from '../store';
import { fmtClock } from '../data';

const router = useRouter();
const seconds = ref(0);
const running = ref(true);
const title = ref('');
let timer = null;

onMounted(() => { timer = setInterval(() => { if (running.value) seconds.value++; }, 1000); });
onUnmounted(() => clearInterval(timer));

function finish() {
  const minutes = Math.max(1, Math.round(seconds.value / 60));
  store.draft = { minutes, title: title.value };
  router.replace('/log');
}
function cancel() { router.replace('/'); }
</script>

<template>
  <div class="screen full" style="text-align:center;">
    <div class="row" style="justify-content:space-between;">
      <button class="chip" @click="cancel"><i class="ti ti-x" aria-hidden="true"></i></button>
      <span class="sub"><i class="ti ti-book-2" aria-hidden="true"></i> Reading session</span>
      <span style="width:34px;"></span>
    </div>

    <input v-model="title" placeholder="What are you reading? (optional)" style="text-align:center;margin-top:8px;" />

    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">
      <Mascot :size="100" eyes="happy" />
      <div style="font-size:54px;font-weight:700;font-family:'Quicksand';color:var(--ink);">{{ fmtClock(seconds) }}</div>
      <div class="sub">
        <i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i>
        {{ running ? "You're earning coins as you read" : "Paused — resume when you're ready" }}
      </div>
    </div>

    <div class="row" style="gap:10px;">
      <button class="btn soft" @click="running = !running">
        <i :class="running ? 'ti ti-player-pause' : 'ti ti-player-play'" aria-hidden="true"></i>
        {{ running ? 'Pause' : 'Resume' }}
      </button>
      <button class="btn" @click="finish"><i class="ti ti-check" aria-hidden="true"></i> Finish</button>
    </div>
  </div>
</template>
