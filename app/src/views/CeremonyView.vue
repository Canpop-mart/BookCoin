<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { monthName, fmtDuration } from '../data';
import LineChart from '../components/LineChart.vue';

const route = useRoute();
const router = useRouter();
const summary = ref(null);
const burst = ref(false);
const saving = ref(false);
const replay = computed(() => !!route.query.replay);

onMounted(async () => {
  let res;
  try { res = await api.ceremony(); } catch { router.replace('/'); return; }
  if (!res.summary) { router.replace('/'); return; }
  summary.value = res.summary;
  burst.value = true;
});

// podium order: [2nd, 1st, 3rd] so 1st sits in the middle
const podium = computed(() => {
  const s = summary.value?.standings || [];
  return [s[1], s[0], s[2]];
});
const medal = {
  1: { bg: 'var(--gold-bg)', fg: 'var(--gold-d)', h: 104 },
  2: { bg: '#E7E1D4', fg: '#6E665A', h: 76 },
  3: { bg: '#ECD7BE', fg: '#8A5A33', h: 58 },
};

async function done() {
  saving.value = true;
  try { await api.markCeremonySeen(summary.value.month); } catch {}
  router.replace(replay.value ? '/nook' : '/');
}
</script>

<template>
  <div class="screen full" v-if="summary" style="text-align:center;align-items:center;gap:14px;">
    <CoinBurst v-if="burst" />
    <Mascot :size="80" mood="cheer" />
    <div class="h" style="font-size:24px;">{{ monthName(summary.month) }} results</div>
    <p class="sub" style="margin-top:-8px;">{{ replay ? 'Last month’s finale.' : 'The reading month is over — here’s how it shook out!' }}</p>

    <!-- podium -->
    <div class="podium">
      <div v-for="s in podium" :key="s ? s.id : Math.random()" class="podium-col" :style="s ? {} : { visibility: 'hidden' }">
        <template v-if="s">
          <i v-if="s.rank === 1" class="ti ti-crown" style="color:var(--gold);font-size:24px;" aria-hidden="true"></i>
          <span class="av" :style="{ background: s.color, width: s.rank === 1 ? '50px' : '42px', height: s.rank === 1 ? '50px' : '42px', fontSize: s.rank === 1 ? '17px' : '14px', border: '3px solid var(--card)' }">{{ s.initials }}</span>
          <div class="podium-name">{{ s.name }}</div>
          <div class="podium-block" :style="{ height: medal[s.rank].h + 'px', background: medal[s.rank].bg, color: medal[s.rank].fg }">
            <div class="podium-rank">{{ s.rank }}</div>
            <div style="font-size:12px;font-weight:600;">{{ fmtDuration(s.minutes) }}</div>
            <div style="font-size:11px;"><i class="ti ti-coin" aria-hidden="true"></i> +{{ s.bonus }}</div>
          </div>
        </template>
      </div>
    </div>

    <!-- fun stats -->
    <template v-if="summary.stats">
      <div class="sub" style="margin-top:4px;">The month in numbers</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;width:100%;">
        <div class="stat-tile"><div class="stat-n">{{ fmtDuration(summary.stats.totalMinutes) }}</div><div class="sub">read together</div></div>
        <div class="stat-tile"><div class="stat-n">{{ summary.stats.totalSessions }}</div><div class="sub">sessions</div></div>
        <div class="stat-tile"><div class="stat-n">{{ summary.stats.totalPages }}</div><div class="sub">pages</div></div>
        <div class="stat-tile"><div class="stat-n">{{ summary.stats.genres }}</div><div class="sub">genres explored</div></div>
      </div>
      <p v-if="summary.stats.longest" class="sub">Longest single sitting: {{ summary.stats.longest.minutes }} min by {{ summary.stats.longest.name }} <i class="ti ti-flame" style="color:var(--terra);" aria-hidden="true"></i></p>
    </template>

    <!-- how the month unfolded -->
    <template v-if="summary.series && summary.series.length">
      <div class="sub" style="margin-top:4px;">How the month unfolded</div>
      <div class="card" style="width:100%;">
        <LineChart :series="summary.series" />
        <div class="row" style="gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px;">
          <span v-for="s in summary.series" :key="s.id" class="sub" style="display:flex;align-items:center;gap:5px;">
            <span style="width:10px;height:10px;border-radius:50%;display:inline-block;" :style="{ background: s.color }"></span>{{ s.name }}
          </span>
        </div>
      </div>
    </template>

    <!-- bonus stars -->
    <div class="sub" style="margin-top:4px;">Bonus stars · +{{ summary.starCoins }} each</div>
    <div class="card" style="display:flex;flex-direction:column;gap:13px;width:100%;text-align:left;">
      <div v-for="st in summary.stars.filter((s) => s.winners.length)" :key="st.key" class="row" style="gap:11px;">
        <span class="av" style="width:34px;height:34px;background:var(--gold-bg);color:var(--gold-d);"><i :class="['ti', st.icon]" aria-hidden="true"></i></span>
        <div style="flex:1;">
          <div style="font-weight:600;">{{ st.label }}</div>
          <div class="sub">{{ st.desc }} · {{ st.winners.map((w) => w.name).join(', ') }}</div>
        </div>
        <i class="ti ti-star" style="color:var(--gold);font-size:20px;" aria-hidden="true"></i>
      </div>
      <div v-if="!summary.stars.some((s) => s.winners.length)" class="sub">No stars earned this month.</div>
    </div>

    <button class="btn" :disabled="saving" @click="done"><i class="ti ti-check" aria-hidden="true"></i> {{ replay ? 'Done' : 'Continue' }}</button>
  </div>
</template>

<style scoped>
.podium { display: flex; align-items: flex-end; justify-content: center; gap: 8px; width: 100%; margin-top: 4px; }
.podium-col { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; max-width: 110px; }
.podium-name { font-weight: 600; font-size: 13px; text-align: center; line-height: 1.1; }
.podium-block {
  width: 100%; border-radius: 12px 12px 0 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 1px; padding: 7px 4px;
}
.podium-rank { font-family: 'Quicksand', sans-serif; font-weight: 700; font-size: 22px; line-height: 1; }
.stat-tile { background: var(--sage-bg); border-radius: var(--border-radius-lg); padding: 12px; }
.stat-n { font-size: 22px; font-weight: 700; font-family: 'Quicksand', sans-serif; color: var(--sage-d); }
</style>
