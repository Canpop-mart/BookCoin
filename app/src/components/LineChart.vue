<script setup>
import { computed } from 'vue';

const props = defineProps({
  series: { type: Array, default: () => [] }, // [{ id, name, color, points: [n,...] }]
  height: { type: Number, default: 130 },
});

const W = 320, H = 130, padX = 4, padTop = 10, padBottom = 6;
const len = computed(() => Math.max(2, props.series[0]?.points.length || 2));
const maxY = computed(() => Math.max(1, ...props.series.flatMap((s) => s.points)));

function path(points) {
  return points.map((v, i) => {
    const x = padX + (i / (len.value - 1)) * (W - 2 * padX);
    const y = (H - padBottom) - (v / maxY.value) * (H - padTop - padBottom);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" width="100%" :height="height" preserveAspectRatio="none" role="img" aria-label="Cumulative reading time per member through the month">
    <line :x1="padX" :y1="H - padBottom" :x2="W - padX" :y2="H - padBottom" stroke="var(--line)" stroke-width="1" vector-effect="non-scaling-stroke" />
    <path v-for="s in series" :key="s.id" :d="path(s.points)" fill="none" :stroke="s.color"
      stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
  </svg>
</template>
