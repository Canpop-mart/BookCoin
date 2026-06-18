<script setup>
import { ref } from 'vue';
import { api } from '../api';
import { store } from '../store';

const SLIDES = [
  { mascot: true, title: 'Welcome to BookCoin', body: 'Read, earn coins for your time, and enjoy a little friendly competition with your people.' },
  { icon: 'ti-player-play', title: 'Log your reading', body: 'Tap Start reading to time a session, or log one yourself. Minutes are what count — pages are just for fun.' },
  { icon: 'ti-wand', title: 'Quests & challenges', body: 'Earn bonus coins for monthly goals, and for trying new genres and formats.' },
  { icon: 'ti-gift', title: 'Rewards & ranks', body: 'Spend coins on real treats, climb the monthly leaderboard, and celebrate at the month-end ceremony.' },
];
const i = ref(0);
const busy = ref(false);

async function finish() {
  busy.value = true;
  try {
    const m = await api.markOnboarded();
    store.setMember(m);
  } catch {
    if (store.member) { store.member.onboarded = true; store.save(); } // optimistic fallback
  }
}
function next() { if (i.value < SLIDES.length - 1) i.value++; else finish(); }
function back() { if (i.value > 0) i.value--; }
</script>

<template>
  <div class="onb-overlay">
    <div class="onb-card pop-in">
      <button class="onb-skip" @click="finish">Skip</button>
      <div class="onb-art">
        <Mascot v-if="SLIDES[i].mascot" :size="92" eyes="happy" :variant="store.member?.mascot || 'wizard'" />
        <span v-else class="av" style="width:74px;height:74px;background:var(--sage-bg);color:var(--sage-d);"><i :class="['ti', SLIDES[i].icon]" style="font-size:34px;" aria-hidden="true"></i></span>
      </div>
      <div class="h" style="font-size:20px;text-align:center;">{{ SLIDES[i].title }}</div>
      <p class="sub" style="text-align:center;line-height:1.6;font-size:14px;margin:0;min-height:44px;">{{ SLIDES[i].body }}</p>
      <div class="onb-dots">
        <span v-for="(s, n) in SLIDES" :key="n" :class="{ on: n === i }"></span>
      </div>
      <div class="row" style="gap:10px;width:100%;">
        <button v-if="i > 0" class="btn soft" style="flex:1;" @click="back"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
        <button class="btn" style="flex:1;" :disabled="busy" @click="next">{{ i === SLIDES.length - 1 ? 'Get started' : 'Next' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onb-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: rgba(74, 63, 53, .5);
  display: flex; align-items: center; justify-content: center; padding: 20px;
}
.onb-card {
  background: var(--cream); border-radius: 24px; padding: 28px 22px 22px;
  width: 100%; max-width: 360px;
  display: flex; flex-direction: column; align-items: center; gap: 12px; position: relative;
}
.onb-skip { position: absolute; top: 14px; right: 16px; background: none; border: none; color: var(--ink2); cursor: pointer; font-family: inherit; font-size: 13px; }
.onb-art { height: 100px; display: flex; align-items: center; justify-content: center; }
.onb-dots { display: flex; gap: 7px; margin: 2px 0 6px; }
.onb-dots span { width: 7px; height: 7px; border-radius: 50%; background: var(--line); transition: all .2s ease; }
.onb-dots span.on { background: var(--terra); width: 20px; border-radius: 4px; }
</style>
