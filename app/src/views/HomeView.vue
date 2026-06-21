<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, MEDIUMS, daysLeftInMonth } from '../data';

const router = useRouter();
const daysLeft = daysLeftInMonth();
const profile = ref(null);
const lb = ref(null);
const activity = ref([]);
const comTab = ref('leaders');

onMounted(async () => {
  const [p, l, a] = await Promise.all([
    api.profile(store.member.id), api.leaderboard('month'), api.activity(),
  ]);
  profile.value = p; lb.value = l; activity.value = a;
});

const rows = computed(() => lb.value?.rows || []);
const myIndex = computed(() => rows.value.findIndex((r) => r.memberId === store.member.id));
const myRank = computed(() => (myIndex.value >= 0 ? myIndex.value + 1 : null));
const ahead = computed(() => (myIndex.value > 0 ? rows.value[myIndex.value - 1] : null));
const gapAhead = computed(() => (ahead.value ? Math.max(0, ahead.value.minutes - (rows.value[myIndex.value]?.minutes || 0)) : 0));
const top3 = computed(() => rows.value.slice(0, 3));

const reading = computed(() => profile.value?.shelf?.reading || []);
const monthMinutes = computed(() => profile.value?.monthMinutes ?? 0);
const goal = computed(() => profile.value?.member?.monthlyGoalMinutes || 900);
const goalPct = computed(() => pct(monthMinutes.value, goal.value));
const goalMet = computed(() => monthMinutes.value >= goal.value);
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
      <span style="cursor:pointer;position:relative;flex-shrink:0;" @click="router.push(`/profile/${store.member.id}`)">
        <Avatar :member="store.member" :size="34" />
        <span v-if="store.member.emblem" style="position:absolute;right:-3px;bottom:-3px;width:18px;height:18px;font-size:11px;background:var(--card);border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;">{{ store.member.emblem }}</span>
      </span>
    </div>

    <!-- hero: greeting + balance + goal, one cohesive block -->
    <div class="card" style="display:flex;flex-direction:column;gap:13px;">
      <div class="row" style="gap:13px;">
        <Mascot :size="60" eyes="happy" :variant="store.member.mascot || 'wizard'" />
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:17px;">Hi, {{ store.member.name }}</div>
          <div class="sub" style="margin-top:2px;">
            <template v-if="myRank === 1">You're 1st this month <i class="ti ti-crown" style="color:var(--gold);" aria-hidden="true"></i></template>
            <template v-else-if="ahead">{{ myRank }}{{ ['th','st','nd','rd'][myRank % 10] || 'th' }} place · {{ fmtDuration(gapAhead) }} behind {{ ahead.name }}</template>
            <template v-else>Log a session to join the leaderboard</template>
          </div>
        </div>
        <span v-if="streak > 0" class="chip" style="background:#FBE0D2;color:var(--terra-d);align-self:flex-start;"><i class="ti ti-flame flame" aria-hidden="true"></i> {{ streak }}d</span>
      </div>
      <div class="row" style="gap:0;border-top:1px solid var(--line);padding-top:13px;">
        <div style="flex:1;">
          <div class="sub" style="color:var(--gold-d);">Balance</div>
          <div class="row" style="gap:6px;margin-top:2px;">
            <i class="ti ti-coin" style="color:var(--gold);font-size:23px;" aria-hidden="true"></i>
            <span style="font-size:25px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><CoinCount :value="profile.balance" /></span>
          </div>
        </div>
        <div style="width:1px;align-self:stretch;background:var(--line);margin:0 16px;"></div>
        <div class="row" style="gap:11px;">
          <div style="position:relative;width:52px;height:52px;flex-shrink:0;">
            <svg viewBox="0 0 36 36" width="52" height="52" style="display:block;">
              <circle cx="18" cy="18" r="15.6" fill="none" stroke="var(--line)" stroke-width="3.4" />
              <circle cx="18" cy="18" r="15.6" fill="none" :stroke="goalMet ? 'var(--terra)' : 'var(--sage)'" stroke-width="3.4" stroke-linecap="round" pathLength="100" :stroke-dasharray="`${goalPct} 100`" transform="rotate(-90 18 18)" />
            </svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;font-family:'Quicksand';">{{ Math.round(goalPct) }}%</div>
          </div>
          <div>
            <div class="sub"><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> Goal</div>
            <div style="font-weight:600;font-size:13px;margin-top:1px;">{{ fmtDuration(monthMinutes) }}</div>
            <div class="sub" style="font-size:11px;">of {{ fmtDuration(goal) }}</div>
          </div>
        </div>
      </div>
    </div>

    <button class="btn" @click="router.push('/reading')"><i class="ti ti-player-play" aria-hidden="true"></i> Start reading</button>

    <button class="card" style="cursor:pointer;width:100%;text-align:left;display:flex;flex-direction:column;gap:10px;font-family:inherit;" @click="router.push('/shelf')">
      <div class="row" style="justify-content:space-between;width:100%;">
        <span class="sub"><i class="ti ti-book" aria-hidden="true"></i> Currently reading</span>
        <span class="sub">My shelf <i class="ti ti-chevron-right" aria-hidden="true"></i></span>
      </div>
      <div v-for="b in reading.slice(0, 2)" :key="b.id" class="row" style="gap:10px;width:100%;">
        <span class="av" style="width:30px;height:30px;font-size:15px;background:#EFE0F0;color:#6E5E94;flex-shrink:0;"><span v-if="b.emoji">{{ b.emoji }}</span><i v-else class="ti ti-book" aria-hidden="true"></i></span>
        <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ b.title }}</div><div class="sub" v-if="b.author">{{ b.author }}</div></div>
      </div>
      <div v-if="!reading.length" class="sub">Add what you're reading to track it →</div>
    </button>

    <!-- community: leaderboard + activity under one set of selectable headers -->
    <div class="row" style="gap:7px;">
      <button class="chip" :class="{ on: comTab === 'leaders' }" style="flex:1;justify-content:center;" @click="comTab = 'leaders'"><i class="ti ti-trophy" aria-hidden="true"></i> Leaderboard</button>
      <button class="chip" :class="{ on: comTab === 'activity' }" style="flex:1;justify-content:center;" @click="comTab = 'activity'"><i class="ti ti-activity" aria-hidden="true"></i> Activity</button>
    </div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px;">
      <template v-if="comTab === 'leaders'">
        <div v-for="r in top3" :key="r.memberId" class="row" style="gap:10px;">
          <span class="sub" style="width:12px;">{{ r.rank }}</span>
          <Avatar :member="r" :size="26" />
          <span style="flex:1;font-weight:600;font-size:14px;">{{ r.name }}<span v-if="r.memberId === store.member.id" class="sub"> · you</span></span>
          <span class="sub">{{ fmtDuration(r.minutes) }}</span>
        </div>
        <button class="chip" style="align-self:center;margin-top:2px;" @click="router.push('/nook')">Full leaderboard · {{ daysLeft }}d left <i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      </template>
      <template v-else>
        <div v-if="!activity.length" class="sub" style="text-align:center;">No activity yet — be the first to log a session.</div>
        <div v-for="a in activity.slice(0, 6)" :key="a.id" class="row" style="gap:10px;align-items:flex-start;">
          <Avatar :member="a" :size="28" />
          <div style="flex:1;font-size:14px;line-height:1.4;">
            <span style="font-weight:600;">{{ a.name }}</span> read {{ fmtDuration(a.minutes) }}<span v-if="a.title"> of {{ a.title }}</span>
            <div class="sub">{{ mediumLabel(a.medium) }} · {{ ago(a.createdAt) }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
