<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration } from '../data';

const router = useRouter();
const data = ref(null);
const lb = ref(null);
const monthKey = new Date().toISOString().slice(0, 7);

onMounted(async () => {
  const [p, l] = await Promise.all([api.profile(store.member.id), api.leaderboard('month')]);
  data.value = p; lb.value = l;
});

const rows = computed(() => lb.value?.rows || []);
const myIndex = computed(() => rows.value.findIndex((r) => r.memberId === store.member.id));
const myRank = computed(() => (myIndex.value >= 0 ? myIndex.value + 1 : null));
const ahead = computed(() => (myIndex.value > 0 ? rows.value[myIndex.value - 1] : null));
const gapAhead = computed(() => {
  if (!ahead.value) return 0;
  return Math.max(0, ahead.value.minutes - (rows.value[myIndex.value]?.minutes || 0));
});

const monthSessions = computed(() =>
  (data.value?.recent || []).filter((s) => (s.createdAt || '').slice(0, 7) === monthKey));
const genresThisMonth = computed(() => {
  const set = new Set();
  monthSessions.value.forEach((s) => (s.genres || []).forEach((g) => set.add(g)));
  return set.size;
});
const monthMinutes = computed(() => data.value?.monthMinutes ?? 0);
const goal = computed(() => data.value?.member?.monthlyGoalMinutes || 900);
const streak = computed(() => {
  const days = new Set((data.value?.recent || []).map((s) => (s.createdAt || '').slice(0, 10)));
  let n = 0;
  const d = new Date();
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
});
const pct = (a, b) => Math.min(100, b ? (a / b) * 100 : 0);
</script>

<template>
  <div class="screen stagger" v-if="data">
    <div class="row" style="justify-content:space-between;">
      <div class="row" style="gap:7px;"><i class="ti ti-book-2" style="color:var(--terra);font-size:22px;" aria-hidden="true"></i><span class="h">BookCoin</span></div>
      <span class="av" :style="{ background: store.member.color }">{{ store.member.initials }}</span>
    </div>

    <div class="card row" style="background:var(--sage-bg);border-color:transparent;gap:12px;">
      <Mascot :size="66" eyes="happy" />
      <div style="flex:1;">
        <div style="font-weight:600;font-size:16px;">Hey {{ store.member.name }}!</div>
        <div class="sub" style="color:var(--sage-d);margin-top:2px;">
          <template v-if="myRank === 1">Top of the family this month <i class="ti ti-crown" style="color:var(--gold);" aria-hidden="true"></i></template>
          <template v-else-if="ahead">#{{ myRank }} this month — {{ fmtDuration(gapAhead) }} behind {{ ahead.name }}. Catch up!</template>
          <template v-else>Log a session to climb the board</template>
        </div>
      </div>
      <span v-if="streak > 0" class="chip" style="background:#FBE0D2;color:var(--terra-d);"><i class="ti ti-flame flame" aria-hidden="true"></i> {{ streak }}d</span>
    </div>

    <div class="card row" style="background:var(--gold-bg);border-color:transparent;justify-content:space-between;">
      <div>
        <div class="sub" style="color:var(--gold-d);">your coins</div>
        <div class="row" style="gap:7px;margin-top:2px;">
          <i class="ti ti-coin" style="color:var(--gold);font-size:26px;" aria-hidden="true"></i>
          <span style="font-size:28px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><CoinCount :value="data.balance" /></span>
        </div>
      </div>
      <i class="ti ti-coin" style="color:var(--gold);font-size:30px;opacity:.4;" aria-hidden="true"></i>
    </div>

    <button class="btn" @click="router.push('/reading')"><i class="ti ti-player-play" aria-hidden="true"></i> Start reading</button>

    <div class="sub" style="margin-top:2px;">this month</div>
    <div class="card" style="display:flex;flex-direction:column;gap:15px;">
      <div>
        <div class="row" style="justify-content:space-between;font-size:14px;">
          <span><i class="ti ti-compass" style="color:var(--sage);" aria-hidden="true"></i> Genre explorer</span>
          <span class="sub">{{ genresThisMonth }} of 5 genres</span>
        </div>
        <div class="bar" style="margin-top:8px;"><span :style="{ width: pct(genresThisMonth, 5) + '%' }"></span></div>
      </div>
      <div>
        <div class="row" style="justify-content:space-between;font-size:14px;">
          <span><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> Reading goal</span>
          <span class="sub">{{ fmtDuration(monthMinutes) }} / {{ fmtDuration(goal) }}</span>
        </div>
        <div class="bar" style="margin-top:8px;"><span :style="{ width: pct(monthMinutes, goal) + '%' }"></span></div>
      </div>
    </div>
  </div>
</template>
