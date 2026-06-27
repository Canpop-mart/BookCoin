<script setup>
// A small "i" dot. Tap it for a short explanation, so the UI can stay
// self-explanatory and keep the detail tucked away until someone wants it.
import { ref } from 'vue';

defineProps({ text: { type: String, required: true } });
const open = ref(false);
const dot = ref(null);
const pos = ref({ top: 0, left: 0 });

function toggle() {
  if (!open.value && dot.value) {
    const r = dot.value.getBoundingClientRect();
    pos.value = { top: r.top, left: r.left + r.width / 2 };
  }
  open.value = !open.value;
}
</script>

<template>
  <span class="info-wrap">
    <button ref="dot" type="button" class="info-dot" :class="{ on: open }" :aria-label="text" @click.stop.prevent="toggle">
      <i class="ti ti-info-circle" aria-hidden="true"></i>
    </button>
    <teleport to="body">
      <div v-if="open" class="info-layer" @click="open = false">
        <span class="info-pop" role="tooltip" :style="{ top: pos.top + 'px', left: pos.left + 'px' }" @click.stop>{{ text }}</span>
      </div>
    </teleport>
  </span>
</template>

<style scoped>
.info-wrap { display: inline-flex; vertical-align: middle; line-height: 0; }
.info-dot {
  border: none; background: none; cursor: pointer; padding: 0; margin: 0 0 0 2px;
  color: var(--ink2); font-size: 16px; display: inline-flex;
}
.info-dot.on { color: var(--terra); }
.info-layer { position: fixed; inset: 0; z-index: 70; }
.info-pop {
  position: fixed;
  transform: translate(-50%, -100%) translateY(-9px);
  width: max-content; max-width: min(240px, 78vw);
  background: var(--ink); color: var(--cream);
  font-family: 'Nunito', sans-serif; font-size: 12.5px; line-height: 1.45; font-weight: 500;
  text-align: left;
  padding: 9px 12px; border-radius: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, .28);
}
.info-pop::after {
  content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: var(--ink);
}
</style>
