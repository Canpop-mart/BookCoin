<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, MEDIUMS } from '../data';

const router = useRouter();
const profile = ref(null);
const lb = ref(null);
const quests = ref([]);
const activity = ref([]);

onMounted(async () => {
  const [p, l, q, a] = await Promise.all([
    api.profile(store.member.id), api.leaderboard('month'), api.quests(), api.activity(),
  ]);
  profile.value = p; lb.value = l; quests.value = q; activity.value = a;
});

const rows = computed(() => lb.value?.rows || []);
const myIndex = computed(() => rows.value.findIndex((r) => r.memberId === store.member.id));
const myRank = computed(() => (myIndex.value >= 0 ? myIndex.value + 1 : null));
const ahead = computed(() => (myIndex.value > 0 ? rows.value[myIndex.value - 1] : null));
const gapAhead = computed(() => (ahead.value ? Math.max(0, ahead.value.minutes - (rows.value[myIndex.value]?.minutes || 0)) : 0));
const top3 = computed(() => rows.value.slice(0, 3));

const monthMinutes = computed(() => profile.value?.monthMinutes ?? 0);
const goal = computed(() => profile.value?.member?.monthlyGoalMinutes || 900);
const claimable = computed(() => quests.value.filter((q) => !['claimed', 'approved', 'pending'].includes(q.claimStatus) && (q.type === 'manual' || q.complete)).length);
const streak = computed(() => {
  const days = new Set((profile.value?.recent || []).map((s) => (s.createdAt || '').slice(0, 10)));
  let n = 0; const d = new Date();
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
});

const pct = (a, b) => Math.min(100, b ? (a / b) * 100 : 0);
const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;
function ago(ts) {
  if (!ts) return '';
  const diff = (Date.now() - Date.parse(ts.replace(' ', 'T') + 'Z')) / 1000;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return Math.round(diff / 86400) + 'd ago';
}
</script>

<template>
  <div class="screen stagger" v-if="profile">
    <div class="row" style="justify-content:space-between;">
      <div class="row" style="gap:7px;"><i class="ti ti-book-2" style="color:var(--terra);font-size:22px;" aria-hidden="true"></i><span class="h">BookCoin</span></div>
      <span class="av" :style="{ background: store.member.color }" style="cursor:pointer;" @click="router.push(`/profile/${store.member.id}`)">{{ store.member.initials }}</span>
    </div>

    <div class="card row" style="background:var(--sage-bg);border-color:transparent;gap:12px;">
      <Mascot :size="68" eyes="happy" />
      <div style="flex:1;">
        <div style="font-weight:600;font-size:16px;">Hey {{ store.member.name }}!</div>
        <div class="sub" style="color:var(--sage-d);margin-top:2px;">
          <template v-if="myRank === 1">Top of the family this month <i class="ti ti-crown" style="color:var(--gold);" aria-hidden="true"></i></template>
          <template v-else-if="ahead">#{{ myRank }} — {{ fmtDuration(gapAhead) }} behind {{ ahead.name }}</template>
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
          <span style="font-size:28px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><CoinCount :value="profile.balance" /></span>
        </div>
      </div>
      <i class="ti ti-coin" style="color:var(--gold);font-size:30px;opacity:.4;" aria-hidden="true"></i>
    </div>

    <button class="btn" @click="router.push('/reading')"><i class="ti ti-player-play" aria-hidden="true"></i> Start reading</button>

    <button v-if="claimable > 0" class="card row" style="cursor:pointer;width:100%;text-align:left;gap:10px;background:#FFF7F3;border-color:#F2D2C5;" @click="router.push('/quests')">
      <i class="ti ti-coin" style="color:var(--gold);font-size:22px;" aria-hidden="true"></i>
      <span style="flex:1;font-weight:600;">{{ claimable }} quest{{ claimable > 1 ? 's' : '' }} ready to claim</span>
      <i class="ti ti-chevron-right" style="color:var(--ink2);" aria-hidden="true"></i>
    </button>

    <div class="card">
      <div class="row" style="justify-content:space-between;font-size:14px;">
        <span><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> Monthly goal</span>
        <span class="sub">{{ fmtDuration(monthMinutes) }} / {{ fmtDuration(goal) }}</span>
      </div>
      <div class="bar" style="margin-top:8px;"><span :style="{ width: pct(monthMinutes, goal) + '%', background: monthMinutes >= goal ? 'var(--terra)' : 'var(--sage)' }"></span></div>
    </div>

    <button class="row" style="background:none;border:none;padding:0;cursor:pointer;justify-content:space-between;width:100%;" @click="router.push('/nook')">
      <span class="sub">family this month</span><span class="sub">see all <i class="ti ti-chevron-right" aria-hidden="true"></i></span>
    </button>
    <div class="card" style="display:flex;flex-direction:column;gap:11px;">
      <div v-for="r in top3" :key="r.memberId" class="row" style="gap:10px;">
        <span class="sub" style="width:12px;">{{ r.rank }}</span>
        <span class="av" style="width:26px;height:26px;font-size:11px;" :style="{ background: r.color }">{{ r.initials }}</span>
        <span style="flex:1;font-weight:600;font-size:14px;">{{ r.name }}<span v-if="r.memberId === store.member.id" class="sub"> · you</span></span>
        <span class="sub">{{ fmtDuration(r.minutes) }}</span>
      </div>
    </div>

    <template v-if="activity.length">
      <div class="sub">around the house</div>
      <div class="card" style="display:flex;flex-direction:column;gap:13px;">
        <div v-for="a in activity.slice(0, 5)" :key="a.id" class="row" style="gap:10px;align-items:flex-start;">
          <span class="av" style="width:28px;height:28px;font-size:11px;" :style="{ background: a.color }">{{ a.initials }}</span>
          <div style="flex:1;font-size:14px;line-height:1.4;">
            <span style="font-weight:600;">{{ a.name }}</span> read {{ fmtDuration(a.minutes) }}<span v-if="a.title"> of {{ a.title }}</span>
            <div class="sub">{{ mediumLabel(a.medium) }} · {{ ago(a.createdAt) }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
