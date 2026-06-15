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

const me = computed(() => (data.value?.rows || []).find((r) => r.memberId === store.member.id));
const pct = (a, b) => Math.min(100, b ? (a / b) * 100 : 0);
</script>

<template>
  <div class="screen" v-if="data">
    <div class="h"><i class="ti ti-home" style="color:var(--terra);" aria-hidden="true"></i> Family reading nook</div>

    <div class="row" style="gap:7px;">
      <button class="chip" :class="{ on: period === 'month' }" style="flex:1;justify-content:center;" @click="setPeriod('month')">this month</button>
      <button class="chip" :class="{ on: period === 'all' }" style="flex:1;justify-content:center;" @click="setPeriod('all')">all-time</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:9px;">
      <div v-for="r in data.rows" :key="r.memberId" class="card row" style="padding:11px 13px;"
        :style="r.memberId === store.member.id ? { background: 'var(--blush-bg)', borderColor: '#F2D2C5' } : {}">
        <span class="av" style="width:28px;height:28px;font-size:12px;background:#F0E0C8;color:#86735A;">
          <i v-if="r.rank === 1 && r.minutes > 0" class="ti ti-leaf" style="color:var(--gold);" aria-hidden="true"></i>
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
        <span><i class="ti ti-seedling" aria-hidden="true"></i> your gentle goal</span>
        <span>{{ fmtDuration(me.minutes) }} of {{ fmtDuration(me.goal) }}</span>
      </div>
      <div class="bar" style="margin-top:8px;background:#D8E2C7;"><span :style="{ width: pct(me.minutes, me.goal) + '%' }"></span></div>
    </div>

    <p class="sub" style="text-align:center;opacity:.7;">everyone’s reading together — no pressure <i class="ti ti-heart" aria-hidden="true"></i></p>
  </div>
</template>
