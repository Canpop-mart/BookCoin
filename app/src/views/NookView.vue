<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, daysLeftInMonth, monthName } from '../data';

const router = useRouter();
const daysLeft = daysLeftInMonth();
const period = ref('month');
const data = ref(null);
const lastResults = ref(null);

async function load() { data.value = await api.leaderboard(period.value); }
onMounted(async () => {
  await load();
  try { const c = await api.ceremony(); if (c.summary) lastResults.value = c.summary.month; } catch {}
});
function setPeriod(p) { if (p !== period.value) { period.value = p; load(); } }

const rows = computed(() => data.value?.rows || []);
const myIndex = computed(() => rows.value.findIndex((r) => r.memberId === store.member.id));
const me = computed(() => rows.value[myIndex.value]);
const ahead = computed(() => (myIndex.value > 0 ? rows.value[myIndex.value - 1] : null));
const gapAhead = computed(() => (ahead.value ? Math.max(0, ahead.value.minutes - (me.value?.minutes || 0)) : 0));
const pct = (a, b) => Math.min(100, b ? (a / b) * 100 : 0);
</script>

<template>
  <div class="screen" v-if="data">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-trophy" style="color:var(--gold);" aria-hidden="true"></i> Leaderboard</div>
      <span class="sub" v-if="period === 'month'"><i class="ti ti-clock" aria-hidden="true"></i> {{ daysLeft }}d left</span>
    </div>

    <div class="row" style="gap:7px;">
      <button class="chip" :class="{ on: period === 'month' }" style="flex:1;justify-content:center;" @click="setPeriod('month')">This month</button>
      <button class="chip" :class="{ on: period === 'all' }" style="flex:1;justify-content:center;" @click="setPeriod('all')">All time</button>
    </div>

    <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
      <div v-for="r in data.rows" :key="r.memberId" class="card row" style="padding:11px 13px;"
        :style="r.memberId === store.member.id ? { background: 'var(--blush-bg)', borderColor: '#F2D2C5' } : {}">
        <span class="av" style="width:28px;height:28px;font-size:12px;"
          :style="r.rank === 1 && r.minutes > 0 ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' } : { background: '#F0E0C8', color: '#86735A' }">
          <i v-if="r.rank === 1 && r.minutes > 0" class="ti ti-crown" aria-hidden="true"></i>
          <template v-else>{{ r.rank }}</template>
        </span>
        <Avatar :member="r" :size="30" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">{{ r.name }}<span v-if="r.memberId === store.member.id" class="sub"> · you</span></div>
          <div class="sub"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ r.coins }}{{ period === 'all' ? ' earned' : '' }}</div>
        </div>
        <div style="font-weight:700;font-family:'Quicksand';color:var(--ink);white-space:nowrap;">{{ fmtDuration(r.minutes) }}</div>
      </div>
    </div>

    <div v-if="period === 'month' && me" class="card" style="background:var(--sage-bg);border-color:transparent;">
      <div class="row" style="justify-content:space-between;font-size:14px;color:var(--sage-d);">
        <span><i class="ti ti-target" aria-hidden="true"></i> Your goal</span>
        <span>{{ fmtDuration(me.minutes) }} of {{ fmtDuration(me.goal) }}</span>
      </div>
      <div class="bar" style="margin-top:8px;background:#D8E2C7;"><span :style="{ width: pct(me.minutes, me.goal) + '%' }"></span></div>
    </div>

    <p v-if="period === 'month' && ahead" class="sub" style="text-align:center;">
      {{ fmtDuration(gapAhead) }} behind {{ ahead.name }}
    </p>
    <p v-else-if="period === 'month' && me && me.minutes > 0" class="sub" style="text-align:center;">
      You're in 1st place <i class="ti ti-crown" style="color:var(--gold);" aria-hidden="true"></i>
    </p>

    <button v-if="lastResults" class="chip" style="align-self:center;margin-top:6px;" @click="router.push('/ceremony?replay=1')">
      <i class="ti ti-trophy" style="color:var(--gold);" aria-hidden="true"></i> {{ monthName(lastResults) }} results
    </button>
  </div>
</template>
