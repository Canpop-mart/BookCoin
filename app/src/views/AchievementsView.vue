<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';

const route = useRoute();
const router = useRouter();
const id = computed(() => Number(route.params.id) || store.member.id);
const data = ref(null);

async function load() { data.value = await api.profile(id.value); }
onMounted(load);

const isMe = computed(() => id.value === store.member.id);
const tracks = computed(() => data.value?.achievements?.tracks || []);
const specials = computed(() => data.value?.achievements?.specials || []);

const rarityColor = (r) => (r === 'legendary' ? 'var(--r-legendary)' : r === 'rare' ? 'var(--r-rare)' : 'var(--r-common)');
const rarityBg = (r) => (r === 'legendary' ? 'color-mix(in srgb, var(--r-legendary) 16%, var(--card))'
  : r === 'rare' ? 'color-mix(in srgb, var(--r-rare) 16%, var(--card))'
  : 'color-mix(in srgb, var(--r-common) 16%, var(--card))');

const earnedCount = computed(() =>
  tracks.value.filter((t) => t.earned).length + specials.value.filter((s) => s.earned).length);
const totalCount = computed(() => tracks.value.length + specials.value.length);

const CATEGORIES = ['Reading', 'Habit', 'Explorer', 'Collector'];
const tracksIn = (cat) => tracks.value.filter((t) => t.category === cat);
const pct = (t) => (t.next && t.next.at ? Math.min(100, Math.round((t.value / t.next.at) * 100)) : 100);
</script>

<template>
  <div class="screen" v-if="data">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-award" style="color:var(--gold-d);" aria-hidden="true"></i> Achievements</div>
      <button class="chip" aria-label="Back" @click="router.back()"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>
    <div class="sub" style="margin-top:-6px;">{{ isMe ? 'You have' : data.member.name + ' has' }} earned {{ earnedCount }} of {{ totalCount }}.</div>

    <!-- tracks grouped by category -->
    <template v-for="cat in CATEGORIES" :key="cat">
      <div v-if="tracksIn(cat).length" class="sub" style="margin-top:2px;font-weight:600;">{{ cat }}</div>
      <div v-for="t in tracksIn(cat)" :key="t.id" class="card" style="display:flex;gap:12px;align-items:center;" :style="{ opacity: t.earned ? 1 : .82 }">
        <span class="badge-ic" :style="t.earned ? { color: rarityColor(t.current.rarity), background: rarityBg(t.current.rarity) } : { color: 'var(--ink2)', background: 'var(--paper)' }">
          <i :class="['ti', t.icon]" aria-hidden="true"></i>
        </span>
        <div style="flex:1;min-width:0;">
          <div class="row" style="justify-content:space-between;gap:8px;">
            <span style="font-weight:600;font-size:14px;">{{ t.earned ? t.current.title : t.name }}</span>
            <span class="tier-pips" aria-hidden="true">
              <span v-for="(tr, i) in t.tiers" :key="i" class="pip" :style="{ background: i <= t.tierIndex ? rarityColor(tr.rarity) : 'var(--line)' }"></span>
            </span>
          </div>
          <div class="bar" style="margin-top:6px;"><span :style="{ width: pct(t) + '%', background: t.earned ? rarityColor(t.current.rarity) : 'var(--sage)' }"></span></div>
          <div class="sub" style="margin-top:5px;font-size:12px;">
            {{ t.name }} · <template v-if="t.next">{{ t.next.remaining }}{{ t.unit }} to <b>{{ t.next.title }}</b></template><template v-else>every tier earned</template>
          </div>
        </div>
      </div>
    </template>

    <!-- specials -->
    <div class="sub" style="margin-top:2px;font-weight:600;">Special</div>
    <div style="display:flex;flex-direction:column;gap:9px;">
      <div v-for="s in specials" :key="s.id" class="card row" style="gap:12px;" :style="{ opacity: s.earned ? 1 : .5 }">
        <span class="badge-ic" :style="s.earned ? { color: rarityColor(s.rarity), background: rarityBg(s.rarity) } : { color: 'var(--ink2)', background: 'var(--paper)' }">
          <i :class="['ti', s.icon]" aria-hidden="true"></i>
        </span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">{{ s.earned ? s.title : s.name }}</div>
          <div class="sub" style="font-size:12px;">{{ s.desc }}</div>
        </div>
        <span class="chip" style="flex-shrink:0;" :style="s.earned ? { background: rarityBg(s.rarity), color: rarityColor(s.rarity) } : {}">{{ s.earned ? 'Earned' : 'Locked' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.badge-ic {
  width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.tier-pips { display: inline-flex; gap: 3px; align-items: center; flex-shrink: 0; }
.pip { width: 7px; height: 7px; border-radius: 50%; }
</style>
