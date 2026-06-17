<script setup>
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from './api';
import { store } from './store';
import BottomNav from './components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const showNav = computed(() => !route.meta.public && !route.meta.full);

// Android hardware back: navigate within the app instead of quitting it.
// Only at Home (the root) does back actually leave the app.
if (Capacitor.isNativePlatform()) {
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (router.currentRoute.value.path === '/') CapacitorApp.exitApp();
    else if (canGoBack) router.back();
    else router.replace('/');
  });
}

// apply the member's chosen theme to the whole app (free personalization)
watch(() => store.member?.theme, (t) => {
  document.documentElement.dataset.theme = t && t !== 'classic' ? t : '';
}, { immediate: true });

onMounted(async () => {
  if (!store.token) return;
  try { store.setMember((await api.me()).member); } catch {}
  // surface a month-end ceremony the first time you open the app in a new month
  try {
    const { summary, seen } = await api.ceremony();
    if (summary && !seen) router.replace('/ceremony');
  } catch {}
});
</script>

<template>
  <div class="app">
    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
    <BottomNav v-if="showNav" />
  </div>
</template>
