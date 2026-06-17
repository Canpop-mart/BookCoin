<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 },
  duration: { type: Number, default: 700 },
});

const shown = ref(0);
let raf = 0;

function tween(to) {
  cancelAnimationFrame(raf);
  const from = shown.value;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / props.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    shown.value = Math.round(from + (to - from) * eased);
    if (t < 1) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}

onMounted(() => tween(props.value));
watch(() => props.value, (v) => tween(v));
onUnmounted(() => cancelAnimationFrame(raf));
</script>

<template>
  <span>{{ shown.toLocaleString() }}</span>
</template>
