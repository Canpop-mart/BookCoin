<script setup>
// A small "i" dot. Tap it for a short explanation, so the UI can stay
// self-explanatory and keep the detail tucked away until someone wants it.
import { ref, nextTick } from 'vue';

defineProps({ text: { type: String, required: true } });
const open = ref(false);
const dot = ref(null);
const pop = ref(null);
const style = ref({});
const below = ref(false);
const placed = ref(false);

async function toggle() {
  if (open.value) { open.value = false; return; }
  open.value = true;
  placed.value = false;
  await nextTick();
  place();
}

// Keep the bubble on-screen: clamp its left edge into the viewport and point
// the arrow back at the dot. Flip below the dot when there isn't room above
// (which is where a dot near the top of the screen would otherwise overflow).
function place() {
  const d = dot.value, el = pop.value;
  if (!d || !el) return;
  const r = d.getBoundingClientRect();
  const pad = 10, gap = 9;
  const w = el.offsetWidth, h = el.offsetHeight;
  const cx = r.left + r.width / 2;
  const left = Math.max(pad, Math.min(cx - w / 2, window.innerWidth - w - pad));
  below.value = r.top - gap - h < pad && r.bottom + gap + h < window.innerHeight;
  const top = below.value ? r.bottom + gap : r.top - gap - h;
  const arrow = Math.max(14, Math.min(cx - left, w - 14));
  style.value = { top: `${top}px`, left: `${left}px`, '--arrow': `${arrow}px` };
  placed.value = true;
}
</script>

<template>
  <span class="info-wrap">
    <button ref="dot" type="button" class="info-dot" :class="{ on: open }" :aria-label="text" @click.stop.prevent="toggle">
      <i class="ti ti-info-circle" aria-hidden="true"></i>
    </button>
    <teleport to="body">
      <div v-if="open" class="info-layer" @click="open = false">
        <span ref="pop" class="info-pop" :class="{ below, placed }" role="tooltip" :style="style" @click.stop>{{ text }}</span>
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
  /* never wider than the screen; JS then clamps its left edge on-screen */
  width: max-content; max-width: min(260px, calc(100vw - 20px));
  background: var(--ink); color: var(--cream);
  font-family: 'Nunito', sans-serif; font-size: 12.5px; line-height: 1.45; font-weight: 500;
  text-align: left;
  padding: 9px 12px; border-radius: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, .28);
  opacity: 0; /* revealed once placed, so it never flashes at the wrong spot */
}
.info-pop.placed { opacity: 1; }
.info-pop::after {
  content: ''; position: absolute; top: 100%; left: var(--arrow, 50%); transform: translateX(-50%);
  border: 6px solid transparent; border-top-color: var(--ink);
}
.info-pop.below::after {
  top: auto; bottom: 100%;
  border-top-color: transparent; border-bottom-color: var(--ink);
}
</style>
