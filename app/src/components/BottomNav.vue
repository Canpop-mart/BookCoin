<script setup>
import { store } from '../store';
</script>

<template>
  <nav class="bottom-nav">
    <router-link to="/"><i class="ti ti-home" aria-hidden="true"></i><span>Home</span></router-link>
    <router-link to="/nook"><i class="ti ti-trophy" aria-hidden="true"></i><span>Ranks</span></router-link>
    <router-link :to="`/profile/${store.member?.id ?? ''}`"><i class="ti ti-user" aria-hidden="true"></i><span>Me</span></router-link>
  </nav>
</template>
