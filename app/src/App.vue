<script setup>
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from './api';
import { store } from './store';
import BottomNav from './components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const showNav = computed(() => !route.meta.public && !route.meta.full);

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
