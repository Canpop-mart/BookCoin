<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from './api';
import { store } from './store';
import { fmtClock } from './data';
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
  onNotificationTap(() => router.push('/reading')); // tapping the notification returns to the session
  if (!store.token) return;
  try { store.setMember((await api.me()).member); } catch {}
  // surface a month-end ceremony the first time you open the app in a new month
  try {
    const { summary, seen } = await api.ceremony();
    if (summary && !seen) router.replace('/ceremony');
  } catch {}
});
onUnmounted(() => clearInterval(tick));
</script>

<template>
  <div class="app">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

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
