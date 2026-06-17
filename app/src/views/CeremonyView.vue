<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { monthName, fmtDuration } from '../data';

const router = useRouter();
const summary = ref(null);
const burst = ref(false);
const saving = ref(false);

onMounted(async () => {
  let res;
  try { res = await api.ceremony(); } catch { router.replace('/'); return; }
  if (!res.summary || res.seen) { router.replace('/'); return; }
  summary.value = res.summary;
  burst.value = true;
});

const rankStyle = (r) => r === 1 ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' }
  : r === 2 ? { background: '#EDE5D6', color: '#86735A' }
    : r === 3 ? { background: 'var(--blush-bg)', color: 'var(--blush-d)' }
      : { background: '#F0E0C8', color: '#86735A' };

async function done() {
  saving.value = true;
  try { await api.markCeremonySeen(summary.value.month); } catch {}
  router.replace('/');
}
</script>

<template>
  <div class="screen full" v-if="summary" style="text-align:center;align-items:center;gap:14px;">
    <CoinBurst v-if="burst" />
    <Mascot :size="92" mood="cheer" />
    <div class="h" style="font-size:24px;">{{ monthName(summary.month) }} results</div>
    <p class="sub" style="margin-top:-6px;">The reading month is over — here's how it shook out!</p>

    <div style="width:100%;text-align:left;">
      <div class="sub" style="margin-bottom:7px;">Podium</div>
      <div class="card stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="s in summary.standings.slice(0, 3)" :key="s.id" class="row" style="gap:10px;">
          <span class="av" style="width:28px;height:28px;font-size:12px;" :style="rankStyle(s.rank)">{{ s.rank }}</span>
          <span class="av" style="width:30px;height:30px;" :style="{ background: s.color }">{{ s.initials }}</span>
          <span style="flex:1;font-weight:600;">{{ s.name }}</span>
          <span class="sub">{{ fmtDuration(s.minutes) }}</span>
          <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);padding:4px 10px;"><i class="ti ti-coin" aria-hidden="true"></i> +{{ s.bonus }}</span>
        </div>
      </div>
    </div>

    <div style="width:100%;text-align:left;">
      <div class="sub" style="margin-bottom:7px;">Bonus stars · +{{ summary.starCoins }} each</div>
      <div class="card stagger" style="display:flex;flex-direction:column;gap:13px;">
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
    </div>

    <button class="btn" :disabled="saving" @click="done"><i class="ti ti-check" aria-hidden="true"></i> Continue</button>
  </div>
</template>
