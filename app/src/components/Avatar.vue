<script setup>
import { computed } from 'vue';
import { AVATAR_BY_ID } from '../avatars';

// Renders a member's chosen cute avatar, or falls back to the initials disc.
// Pass either a member object or the individual fields.
const props = defineProps({
  member: { type: Object, default: null },
  avatar: { type: String, default: '' },
  color: { type: String, default: '' },
  initials: { type: String, default: '' },
  size: { type: Number, default: 34 },
});

const art = computed(() => AVATAR_BY_ID[props.avatar || props.member?.avatar || ''] || null);
const col = computed(() => props.color || props.member?.color || '#B8A88F');
const ini = computed(() => props.initials || props.member?.initials || '');
const fontSize = computed(() => Math.round(props.size * 0.4) + 'px');
</script>

<template>
  <span class="av" :style="{ width: size + 'px', height: size + 'px', fontSize, overflow: 'hidden', background: art ? 'transparent' : col }">
    <span v-if="art" style="display:block;width:100%;height:100%;" v-html="art.svg"></span>
    <template v-else>{{ ini }}</template>
  </span>
</template>
