<script setup>
import { store } from '../store';
</script>

<template>
  <nav class="bottom-nav">
    <router-link to="/"><i class="ti ti-home" aria-hidden="true"></i><span>Home</span></router-link>
    <router-link to="/quests"><i class="ti ti-wand" aria-hidden="true"></i><span>Quests</span></router-link>
    <router-link to="/nook"><i class="ti ti-trophy" aria-hidden="true"></i><span>Ranks</span></router-link>
    <router-link to="/shop" style="position:relative;"><i class="ti ti-gift" aria-hidden="true"></i><span>Rewards</span><span v-if="store.deliveries" class="nav-badge">{{ store.deliveries }}</span></router-link>
    <router-link :to="`/profile/${store.member?.id ?? ''}`"><i class="ti ti-user" aria-hidden="true"></i><span>Profile</span></router-link>
  </nav>
</template>

<style scoped>
.nav-badge {
  position: absolute; top: 0; left: 50%; transform: translateX(3px);
  min-width: 16px; height: 16px; padding: 0 4px;
  background: var(--terra); color: #fff;
  border-radius: 999px; font-size: 10px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 0 2px var(--card);
}
</style>
