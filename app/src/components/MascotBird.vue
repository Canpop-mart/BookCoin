<script setup>
defineProps({
  size: { type: Number, default: 76 },
  eyes: { type: String, default: 'open' }, // 'open' | 'happy'
});
</script>

<template>
  <svg :width="size" :height="size * 1.04" viewBox="0 0 100 104" role="img" aria-label="Pip the reading bird">
    <ellipse cx="40" cy="97" rx="6" ry="4" fill="#E8A33D" />
    <ellipse cx="60" cy="97" rx="6" ry="4" fill="#E8A33D" />
    <ellipse cx="50" cy="58" rx="33" ry="37" fill="#F2C49B" />
    <ellipse cx="20" cy="60" rx="9" ry="17" fill="#E3A878" />
    <ellipse cx="80" cy="60" rx="9" ry="17" fill="#E3A878" />
    <ellipse cx="50" cy="64" rx="22" ry="27" fill="#FBEBD6" />
    <circle cx="42" cy="23" r="5" fill="#F2C49B" />
    <circle cx="58" cy="23" r="5" fill="#F2C49B" />
    <circle cx="30" cy="57" r="6" fill="#F2A9A0" opacity="0.7" />
    <circle cx="70" cy="57" r="6" fill="#F2A9A0" opacity="0.7" />
    <template v-if="eyes === 'happy'">
      <path d="M33 44 q7 -7 14 0" fill="none" stroke="#4A3F35" stroke-width="2.4" stroke-linecap="round" />
      <path d="M53 44 q7 -7 14 0" fill="none" stroke="#4A3F35" stroke-width="2.4" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="40" cy="44" r="9.5" fill="#fff" />
      <circle cx="60" cy="44" r="9.5" fill="#fff" />
      <circle cx="41" cy="45" r="5" fill="#4A3F35" />
      <circle cx="59" cy="45" r="5" fill="#4A3F35" />
      <circle cx="43" cy="43" r="1.6" fill="#fff" />
      <circle cx="61" cy="43" r="1.6" fill="#fff" />
    </template>
    <path d="M50 50 l-5 6 h10 z" fill="#E8A33D" />
    <path d="M34 79 q16 -7 32 0 v9 q-16 -6 -32 0 z" fill="#D9785A" />
    <path d="M50 77 v11" stroke="#B85C40" stroke-width="1.5" />
  </svg>
</template>
