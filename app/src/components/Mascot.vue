<script setup>
import { ref } from 'vue';

const props = defineProps({
  size: { type: Number, default: 76 },
  eyes: { type: String, default: 'open' },     // 'open' | 'happy'
  mood: { type: String, default: 'idle' },      // 'idle' | 'cheer'
  variant: { type: String, default: 'wizard' }, // 'wizard' | 'owl' | 'fox' | 'cat'
});

const labels = { wizard: 'A wizard on a skateboard', owl: 'A cozy owl', fox: 'A friendly fox', cat: 'A reading cat', mushroom: 'A cheery mushroom' };

// tap → play a one-shot trick (hop + spin), then settle back to idle
const tricking = ref(false);
function doTrick() {
  if (tricking.value) return;
  tricking.value = true;
  setTimeout(() => { tricking.value = false; }, 750);
}
</script>

<template>
  <svg :width="size" :height="size * 1.16" viewBox="0 0 100 116" role="img" :aria-label="labels[variant] || 'Mascot'"
    @click="doTrick" style="cursor:pointer;"
    :class="['mascot', { cheer: mood === 'cheer', trick: tricking }]">

    <!-- ============ WIZARD ============ -->
    <template v-if="variant === 'wizard'">
      <rect x="20" y="99" width="60" height="7" rx="3.5" fill="#D9785A" />
      <circle cx="33" cy="109" r="4.5" fill="#4A3F35" />
      <circle cx="67" cy="109" r="4.5" fill="#4A3F35" />
      <circle cx="33" cy="109" r="1.6" fill="#E8C33D" />
      <circle cx="67" cy="109" r="1.6" fill="#E8C33D" />
      <ellipse cx="44" cy="97" rx="4.5" ry="3" fill="#4A3F35" />
      <ellipse cx="56" cy="97" rx="4.5" ry="3" fill="#4A3F35" />
      <path d="M40 62 Q 35 62 34 71 L 30 97 Q 50 91 70 97 L 66 71 Q 65 62 60 62 Z" fill="#6E5E94" />
      <path d="M50 64 L50 93" stroke="#574879" stroke-width="2" stroke-linecap="round" />
      <circle cx="50" cy="74" r="1.5" fill="#E8C33D" />
      <circle cx="50" cy="82" r="1.5" fill="#E8C33D" />
      <path d="M41 67 Q 30 64 25 56" stroke="#6E5E94" stroke-width="7" stroke-linecap="round" fill="none" />
      <path d="M59 67 Q 71 66 77 70" stroke="#6E5E94" stroke-width="7" stroke-linecap="round" fill="none" />
      <circle cx="24" cy="55" r="3.6" fill="#F2C49B" />
      <circle cx="78" cy="71" r="3.6" fill="#F2C49B" />
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
      <path d="M38 53 L62 53 Q 60 73 50 73 Q 40 73 38 53 Z" fill="#FBF3E7" stroke="#ECDDC8" stroke-width="1" />
      <path d="M33 38 Q 50 34 67 38 L 58 9 Q 56 4 51 7 Z" fill="#574879" />
      <ellipse cx="50" cy="38" rx="20" ry="5" fill="#8B7BB5" />
      <circle cx="52" cy="7" r="3" fill="#E8C33D" />
      <path d="M49 19 L51 24 L56 25 L51 26 L49 31 L47 26 L42 25 L47 24 Z" fill="#E8C33D" />
      <path d="M74 20 L75.4 23 L78 24 L75.4 25 L74 28 L72.6 25 L70 24 L72.6 23 Z" fill="#E8C33D" opacity="0.85" />
    </template>

    <!-- ============ OWL ============ -->
    <template v-else-if="variant === 'owl'">
      <path d="M44 100 v6 M44 100 l-4 6 M44 100 l4 6" stroke="#E0A52C" stroke-width="2.4" stroke-linecap="round" fill="none" />
      <path d="M56 100 v6 M56 100 l-4 6 M56 100 l4 6" stroke="#E0A52C" stroke-width="2.4" stroke-linecap="round" fill="none" />
      <path d="M31 47 L34 31 L42 44 Z" fill="#9C7248" />
      <path d="M69 47 L66 31 L58 44 Z" fill="#9C7248" />
      <ellipse cx="50" cy="70" rx="29" ry="33" fill="#B98A5E" />
      <path d="M23 63 Q18 84 33 97 Q26 80 30 64 Z" fill="#9C7248" />
      <path d="M77 63 Q82 84 67 97 Q74 80 70 64 Z" fill="#9C7248" />
      <ellipse cx="50" cy="77" rx="18" ry="22" fill="#F2E3CC" />
      <circle cx="40" cy="60" r="13" fill="#F7EEDD" />
      <circle cx="60" cy="60" r="13" fill="#F7EEDD" />
      <template v-if="eyes === 'happy'">
        <path d="M34 61 q6 -6 12 0" fill="none" stroke="#4A3F35" stroke-width="2.6" stroke-linecap="round" />
        <path d="M54 61 q6 -6 12 0" fill="none" stroke="#4A3F35" stroke-width="2.6" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="40" cy="61" r="5.5" fill="#4A3F35" />
        <circle cx="60" cy="61" r="5.5" fill="#4A3F35" />
        <circle cx="41.6" cy="59.6" r="1.5" fill="#fff" />
        <circle cx="61.6" cy="59.6" r="1.5" fill="#fff" />
      </template>
      <path d="M50 63 L44 70 L56 70 Z" fill="#E0A52C" />
    </template>

    <!-- ============ FOX ============ -->
    <template v-else-if="variant === 'fox'">
      <path d="M66 95 Q90 93 85 70 Q84 90 64 87 Z" fill="#E08A4E" />
      <path d="M85 70 Q89 79 84 85 Q82 78 83 71 Z" fill="#FBF3E7" />
      <ellipse cx="48" cy="87" rx="19" ry="15" fill="#E08A4E" />
      <ellipse cx="48" cy="91" rx="10" ry="9" fill="#FBF3E7" />
      <path d="M32 56 L26 33 L45 48 Z" fill="#E08A4E" />
      <path d="M64 56 L70 33 L51 48 Z" fill="#E08A4E" />
      <path d="M34 52 L32 41 L42 49 Z" fill="#4A3F35" opacity="0.45" />
      <path d="M62 52 L64 41 L54 49 Z" fill="#4A3F35" opacity="0.45" />
      <path d="M30 53 Q50 43 70 53 Q66 74 50 77 Q34 74 30 53 Z" fill="#E08A4E" />
      <path d="M50 59 Q41 77 50 77 Q59 77 50 59 Z" fill="#FBF3E7" />
      <path d="M36 73 Q50 80 64 73 L62 80 Q50 86 38 80 Z" fill="#8FA97C" />
      <template v-if="eyes === 'happy'">
        <path d="M38 58 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
        <path d="M54 58 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="42" cy="58" r="2.8" fill="#4A3F35" />
        <circle cx="58" cy="58" r="2.8" fill="#4A3F35" />
      </template>
      <circle cx="50" cy="65" r="2.6" fill="#4A3F35" />
    </template>

    <!-- ============ CAT ============ -->
    <template v-else-if="variant === 'cat'">
      <path d="M64 92 Q86 90 79 68" stroke="#A89A86" stroke-width="6" fill="none" stroke-linecap="round" />
      <ellipse cx="48" cy="86" rx="19" ry="15" fill="#A89A86" />
      <path d="M48 83 Q40 79 31 81 L31 97 Q40 95 48 98 Z" fill="#FFFBF2" stroke="#ECDDC8" stroke-width="0.8" />
      <path d="M48 83 Q56 79 65 81 L65 97 Q56 95 48 98 Z" fill="#FBEFD9" stroke="#ECDDC8" stroke-width="0.8" />
      <path d="M48 83 L48 98" stroke="#C9B89E" stroke-width="1.4" />
      <path d="M33 46 L31 29 L47 42 Z" fill="#A89A86" />
      <path d="M63 46 L65 29 L49 42 Z" fill="#A89A86" />
      <path d="M35 44 L34 35 L43 42 Z" fill="#F2A9A0" />
      <path d="M61 44 L62 35 L53 42 Z" fill="#F2A9A0" />
      <circle cx="48" cy="55" r="19" fill="#A89A86" />
      <template v-if="eyes === 'happy'">
        <path d="M37 55 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
        <path d="M51 55 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="41" cy="55" r="2.8" fill="#4A3F35" />
        <circle cx="55" cy="55" r="2.8" fill="#4A3F35" />
      </template>
      <path d="M48 60 l-2.5 2.5 h5 z" fill="#F2A9A0" />
      <g stroke="#C9B89E" stroke-width="1" stroke-linecap="round">
        <path d="M41 61 H 27" /><path d="M41 64 H 29" />
        <path d="M55 61 H 69" /><path d="M55 64 H 67" />
      </g>
    </template>

    <!-- ============ MUSHROOM (mushling) ============ -->
    <template v-else-if="variant === 'mushroom'">
      <path d="M40 100 v6 M40 100 l-3 6 M40 100 l3 6" stroke="#C8A06A" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M60 100 v6 M60 100 l-3 6 M60 100 l3 6" stroke="#C8A06A" stroke-width="2.2" stroke-linecap="round" fill="none" />
      <path d="M37 64 C 35 86, 39 101, 50 101 C 61 101, 65 86, 63 64 Z" fill="#F5EAD6" />
      <path d="M15 66 C 15 32, 30 28, 50 28 C 70 28, 85 32, 85 66 Z" fill="#D9534F" />
      <rect x="18" y="62" width="64" height="7" rx="3.5" fill="#C8463F" />
      <circle cx="33" cy="47" r="6" fill="#FBF3E7" />
      <circle cx="58" cy="42" r="7.5" fill="#FBF3E7" />
      <circle cx="71" cy="55" r="4.5" fill="#FBF3E7" />
      <circle cx="46" cy="56" r="3.5" fill="#FBF3E7" />
      <ellipse cx="40" cy="86" rx="3.5" ry="3" fill="#F2A9A0" opacity="0.6" />
      <ellipse cx="60" cy="86" rx="3.5" ry="3" fill="#F2A9A0" opacity="0.6" />
      <template v-if="eyes === 'happy'">
        <path d="M40 81 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
        <path d="M52 81 q4 -4 8 0" fill="none" stroke="#4A3F35" stroke-width="2.2" stroke-linecap="round" />
      </template>
      <template v-else>
        <circle cx="44" cy="82" r="2.6" fill="#4A3F35" />
        <circle cx="56" cy="82" r="2.6" fill="#4A3F35" />
      </template>
      <path d="M46 87 q4 4 8 0" stroke="#4A3F35" stroke-width="2" fill="none" stroke-linecap="round" />
    </template>
  </svg>
</template>
