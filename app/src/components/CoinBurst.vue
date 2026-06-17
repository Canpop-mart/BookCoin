<script setup>
// A short celebratory shower of coins. Mount it (e.g. v-if) to play once.
const coins = Array.from({ length: 16 }, () => ({
  x: Math.round((Math.random() * 2 - 1) * 140),
  y: Math.round(-70 - Math.random() * 150),
  r: Math.round((Math.random() * 2 - 1) * 220),
  delay: (Math.random() * 0.12).toFixed(2),
  dur: (0.8 + Math.random() * 0.5).toFixed(2),
}));
</script>

<template>
  <div class="burst" aria-hidden="true">
    <i v-for="(c, i) in coins" :key="i" class="ti ti-coin burst-coin"
      :style="{ '--x': c.x + 'px', '--y': c.y + 'px', '--r': c.r + 'deg', animationDelay: c.delay + 's', animationDuration: c.dur + 's' }"></i>
  </div>
</template>
