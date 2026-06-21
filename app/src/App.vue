<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from './api';
import { store } from './store';
import { fmtClock, claimableQuests } from './data';
import { showReadingNotification, clearReadingNotification, onNotificationTap } from './timerNotify';
import BottomNav from './components/BottomNav.vue';
import Onboarding from './components/Onboarding.vue';

const route = useRoute();
const router = useRouter();
const showNav = computed(() => !route.meta.public && !route.meta.full);

// apply the member's chosen theme to the whole app (free personalization)
watch(() => store.member?.theme, (t) => {
  document.documentElement.dataset.theme = t && t !== 'classic' ? t : '';
}, { immediate: true });

// running-timer indicator (ticks once a second; elapsed is wall-clock based)
const nowMs = ref(Date.now());
let tick = null;
const showPill = computed(() => !!store.timer && route.path !== '/reading' && !route.meta.public);
const pillTime = computed(() => { nowMs.value; return store.timer ? fmtClock(Math.floor(store.elapsedMs() / 1000)) : ''; });

// --- pull-to-refresh: drag down at the top of a main screen to reload it ---
const refreshKey = ref(0);     // bumping it remounts the current screen, re-running its data fetch
const refreshing = ref(false);
const pullY = ref(0);
const pulling = ref(false);
const pullOffset = computed(() => (refreshing.value ? 46 : pullY.value));
let ptrStartY = 0;
const scrollTop = () => (document.scrollingElement || document.documentElement).scrollTop;
function ptrStart(e) {
  if (refreshing.value || !showNav.value || e.touches.length !== 1 || scrollTop() > 0) { pulling.value = false; return; }
  pulling.value = true; ptrStartY = e.touches[0].clientY; pullY.value = 0;
}
function ptrMove(e) {
  if (!pulling.value || refreshing.value) return;
  const dy = e.touches[0].clientY - ptrStartY;
  if (dy <= 0) { pullY.value = 0; return; }
  pullY.value = Math.min(dy * 0.45, 80);   // diminishing resistance
  if (pullY.value > 2) e.preventDefault();  // take over from native overscroll
}
function ptrEnd() {
  if (!pulling.value) return;
  pulling.value = false;
  if (pullY.value >= 52) doRefresh();
  else pullY.value = 0;
}
async function doRefresh() {
  refreshing.value = true;
  refreshKey.value++;            // remount current screen → re-fetch its data
  try { if (store.token) { store.setMember((await api.me()).member); store.setDeliveries((await api.myOffers()).toFulfill.length); } } catch {}
  setTimeout(() => { refreshing.value = false; pullY.value = 0; }, 600);
}

// mirror the timer into an ongoing phone notification so people can leave the app
watch(() => (store.timer ? (store.timer.running ? 'run' : 'pause') : 'none'), (s) => {
  if (s === 'run') showReadingNotification(false);
  else if (s === 'pause') showReadingNotification(true);
  else clearReadingNotification();
}, { immediate: true });

// Android hardware back: navigate within the app instead of quitting it.
// Only at Home (the root) does back actually leave the app.
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (router.currentRoute.value.path === '/') CapacitorApp.exitApp();
    else if (canGoBack) router.back();
    else router.replace('/');
  });
}

onMounted(async () => {
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  window.addEventListener('touchstart', ptrStart, { passive: true });
  window.addEventListener('touchmove', ptrMove, { passive: false });
  window.addEventListener('touchend', ptrEnd, { passive: true });
  window.addEventListener('touchcancel', ptrEnd, { passive: true });
  onNotificationTap(() => router.push('/reading')); // tapping the notification returns to the session
  if (!store.token) return;
  try { store.setMember((await api.me()).member); } catch {}
  try { store.setDeliveries((await api.myOffers()).toFulfill.length); } catch {} // Rewards nav badge
  try { store.setQuestsReady(claimableQuests(await api.quests())); } catch {} // Quests nav badge
  // surface a month-end ceremony the first time you open the app in a new month
  try {
    const { summary, seen } = await api.ceremony();
    if (summary && !seen) router.replace('/ceremony');
  } catch {}
});
onUnmounted(() => {
  clearInterval(tick);
  window.removeEventListener('touchstart', ptrStart);
  window.removeEventListener('touchmove', ptrMove);
  window.removeEventListener('touchend', ptrEnd);
  window.removeEventListener('touchcancel', ptrEnd);
});
</script>

<template>
  <div class="app">
    <div v-if="showNav" class="ptr" :style="{ opacity: Math.min(1, pullOffset / 36), transform: `translate(-50%, ${pullOffset - 34}px)` }">
      <i class="ti ti-refresh" :class="{ spin: refreshing }" :style="refreshing ? {} : { transform: `rotate(${pullY * 3.2}deg)` }" aria-hidden="true"></i>
    </div>
    <div :style="{ transform: pullOffset ? `translateY(${pullOffset}px)` : 'none', transition: pulling ? 'none' : 'transform .25s ease' }">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" :key="route.path + '#' + refreshKey" />
        </transition>
      </router-view>
    </div>

    <button v-if="showPill" class="resume-pill" @click="router.push('/reading')">
      <i class="ti ti-book-2" aria-hidden="true"></i>
      <span>Reading · {{ pillTime }}</span>
      <i v-if="store.timer && !store.timer.running" class="ti ti-player-pause" aria-hidden="true"></i>
      <i class="ti ti-chevron-right" aria-hidden="true"></i>
    </button>

    <BottomNav v-if="showNav" />
    <Onboarding v-if="store.member && store.member.onboarded === false" />
  </div>
</template>

<style scoped>
.ptr {
  position: absolute; top: 0; left: 50%; z-index: 5;
  width: 30px; height: 30px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--card); border: 1px solid var(--line);
  color: var(--terra); font-size: 17px; pointer-events: none;
  box-shadow: 0 2px 6px rgba(74, 63, 53, 0.12);
}
.ptr .spin { animation: ptr-spin 0.7s linear infinite; }
@keyframes ptr-spin { to { transform: rotate(360deg); } }
</style>
