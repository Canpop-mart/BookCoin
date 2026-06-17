<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration } from '../data';

const period = ref('month');
const data = ref(null);

async function load() { data.value = await api.leaderboard(period.value); }
onMounted(load);
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
    <div class="h"><i class="ti ti-trophy" style="color:var(--gold);" aria-hidden="true"></i> Family leaderboard</div>

    <div class="row" style="gap:7px;">
      <button class="chip" :class="{ on: period === 'month' }" style="flex:1;justify-content:center;" @click="setPeriod('month')">this month</button>
      <button class="chip" :class="{ on: period === 'all' }" style="flex:1;justify-content:center;" @click="setPeriod('all')">all-time</button>
    </div>

    <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
      <div v-for="r in data.rows" :key="r.memberId" class="card row" style="padding:11px 13px;"
        :style="r.memberId === store.member.id ? { background: 'var(--blush-bg)', borderColor: '#F2D2C5' } : {}">
        <span class="av" style="width:28px;height:28px;font-size:12px;"
          :style="r.rank === 1 && r.minutes > 0 ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' } : { background: '#F0E0C8', color: '#86735A' }">
          <i v-if="r.rank === 1 && r.minutes > 0" class="ti ti-crown" aria-hidden="true"></i>
          <template v-else>{{ r.rank }}</template>
        </span>
        <span class="av" style="width:30px;height:30px;" :style="{ background: r.color }">{{ r.initials }}</span>
        <div style="flex:1;">
          <div style="font-weight:600;">{{ r.name }}<span v-if="r.memberId === store.member.id" class="sub"> · you</span></div>
          <div class="sub">{{ fmtDuration(r.minutes) }}<span v-if="r.pages"> · {{ r.pages }} pages</span></div>
        </div>
        <div class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ r.coins }}</div>
      </div>
    </div>

    <div v-if="period === 'month' && me" class="card" style="background:var(--sage-bg);border-color:transparent;">
      <div class="row" style="justify-content:space-between;font-size:14px;color:var(--sage-d);">
        <span><i class="ti ti-target" aria-hidden="true"></i> your goal</span>
        <span>{{ fmtDuration(me.minutes) }} of {{ fmtDuration(me.goal) }}</span>
      </div>
      <div class="bar" style="margin-top:8px;background:#D8E2C7;"><span :style="{ width: pct(me.minutes, me.goal) + '%' }"></span></div>
    </div>

    <p v-if="period === 'month' && ahead" class="sub" style="text-align:center;">
      {{ fmtDuration(gapAhead) }} behind {{ ahead.name }} — you've got this <i class="ti ti-flame" style="color:var(--terra);" aria-hidden="true"></i>
    </p>
    <p v-else-if="period === 'month' && me && me.minutes > 0" class="sub" style="text-align:center;">
      You're leading the family <i class="ti ti-crown" style="color:var(--gold);" aria-hidden="true"></i>
    </p>
  </div>
</template>
