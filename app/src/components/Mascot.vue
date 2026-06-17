<script setup>
defineProps({
  size: { type: Number, default: 76 },
  eyes: { type: String, default: 'open' }, // 'open' | 'happy'
});
</script>

<template>
  <svg :width="size" :height="size * 1.16" viewBox="0 0 100 116" role="img" aria-label="A little wizard on a skateboard">
    <!-- skateboard -->
    <rect x="20" y="99" width="60" height="7" rx="3.5" fill="#D9785A" />
    <circle cx="33" cy="109" r="4.5" fill="#4A3F35" />
    <circle cx="67" cy="109" r="4.5" fill="#4A3F35" />
    <circle cx="33" cy="109" r="1.6" fill="#E8C33D" />
    <circle cx="67" cy="109" r="1.6" fill="#E8C33D" />
    <!-- feet -->
    <ellipse cx="44" cy="97" rx="4.5" ry="3" fill="#4A3F35" />
    <ellipse cx="56" cy="97" rx="4.5" ry="3" fill="#4A3F35" />
    <!-- robe -->
    <path d="M40 62 Q 35 62 34 71 L 30 97 Q 50 91 70 97 L 66 71 Q 65 62 60 62 Z" fill="#6E5E94" />
    <path d="M50 64 L50 93" stroke="#574879" stroke-width="2" stroke-linecap="round" />
    <circle cx="50" cy="74" r="1.5" fill="#E8C33D" />
    <circle cx="50" cy="82" r="1.5" fill="#E8C33D" />
    <!-- arms (balancing) -->
    <path d="M41 67 Q 30 64 25 56" stroke="#6E5E94" stroke-width="7" stroke-linecap="round" fill="none" />
    <path d="M59 67 Q 71 66 77 70" stroke="#6E5E94" stroke-width="7" stroke-linecap="round" fill="none" />
    <circle cx="24" cy="55" r="3.6" fill="#F2C49B" />
    <circle cx="78" cy="71" r="3.6" fill="#F2C49B" />
    <!-- face -->
    <circle cx="50" cy="50" r="15" fill="#F2C49B" />
    <circle cx="39" cy="52" r="4" fill="#F2A9A0" opacity="0.65" />
    <circle cx="61" cy="52" r="4" fill="#F2A9A0" opacity="0.65" />
    <template v-if="eyes === 'happy'">
      <path d="M42 49 q3 -3 6 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
      <path d="M52 49 q3 -3 6 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
    </template>
    <template v-else>
      <circle cx="45" cy="49" r="2.5" fill="#4A3F35" />
      <circle cx="55" cy="49" r="2.5" fill="#4A3F35" />
      <circle cx="45.9" cy="48.2" r="0.9" fill="#fff" />
      <circle cx="55.9" cy="48.2" r="0.9" fill="#fff" />
    </template>
    <!-- beard -->
    <path d="M38 53 L62 53 Q 60 73 50 73 Q 40 73 38 53 Z" fill="#FBF3E7" stroke="#ECDDC8" stroke-width="1" />
    <!-- hat -->
    <path d="M33 38 Q 50 34 67 38 L 58 9 Q 56 4 51 7 Z" fill="#574879" />
    <ellipse cx="50" cy="38" rx="20" ry="5" fill="#8B7BB5" />
    <circle cx="52" cy="7" r="3" fill="#E8C33D" />
    <path d="M49 19 L51 24 L56 25 L51 26 L49 31 L47 26 L42 25 L47 24 Z" fill="#E8C33D" />
    <!-- sparkle -->
    <path d="M74 20 L75.4 23 L78 24 L75.4 25 L74 28 L72.6 25 L70 24 L72.6 23 Z" fill="#E8C33D" opacity="0.85" />
  </svg>
</template>
