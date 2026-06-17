<script setup>
import { computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from './api';
import { store } from './store';
import BottomNav from './components/BottomNav.vue';

const route = useRoute();
const showNav = computed(() => !route.meta.public && !route.meta.full);

// keep the cached member (name/initials/role) fresh after edits
onMounted(async () => {
  if (store.token) {
    try { const me = await api.me(); store.setMember(me.member); } catch {}
  }
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
