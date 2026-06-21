<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, MEDIUMS, bookSpine } from '../data';
import { AVATARS } from '../avatars';
import pkg from '../../package.json';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const leaderboard = ref(null);
const goalHours = ref(15);
const savingGoal = ref(false);
const id = computed(() => Number(route.params.id) || store.member.id);

async function load() {
  const [p, lb] = await Promise.all([api.profile(id.value), api.leaderboard('month').catch(() => null)]);
  data.value = p;
  leaderboard.value = lb;
  goalHours.value = Math.round((p.member.monthlyGoalMinutes / 60) * 2) / 2;
}
onMounted(load);
watch(() => route.params.id, load);

const isMe = computed(() => id.value === store.member.id);

// celebratory bits
const myRow = computed(() => (leaderboard.value?.rows || []).find((r) => r.memberId === id.value) || null);
const rank = computed(() => (myRow.value && myRow.value.minutes > 0 ? myRow.value.rank : null));
const streak = computed(() => {
  const days = new Set((data.value?.recent || []).map((s) => (s.createdAt || '').slice(0, 10)));
  let n = 0; const d = new Date();
  while (days.has(d.toISOString().slice(0, 10))) { n++; d.setUTCDate(d.getUTCDate() - 1); }
  return n;
});
const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const booksFinished = computed(() => data.value?.shelf?.finishedTotal ?? 0);
const readerTitle = computed(() => {
  const b = booksFinished.value, m = data.value?.totals?.minutes || 0;
  if (b >= 25 || m >= 9000) return 'Book dragon';
  if (b >= 12) return 'Bibliophile';
  if (b >= 5) return 'Bookworm';
  if (b >= 1) return 'Page-turner';
  return 'New reader';
});
const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;
const year = new Date().getFullYear();
const version = pkg.version;
const maxMedium = computed(() => Math.max(1, ...(data.value?.byMedium || []).map((b) => b.minutes)));
const logTitle = (s) => s.title || (mediumLabel(s.medium) + ' session');
const logMeta = (s) => [fmtDuration(s.minutes), s.title ? mediumLabel(s.medium) : null, s.genres?.length ? s.genres.join(', ') : null].filter(Boolean).join(' · ');

// --- free personalization ---
const THEMES = [
  { id: 'classic', label: 'Classic', dot: '#E0785A' },
  { id: 'rose', label: 'Rose', dot: '#D26A86' },
  { id: 'plum', label: 'Plum', dot: '#9B72C7' },
  { id: 'ocean', label: 'Ocean', dot: '#4E93C2' },
  { id: 'forest', label: 'Forest', dot: '#5E9E63' },
  { id: 'evening', label: 'Evening', dot: '#2B2723' },
];
const MASCOTS = [{ id: 'wizard', label: 'Wizard' }, { id: 'owl', label: 'Owl' }, { id: 'fox', label: 'Fox' }, { id: 'cat', label: 'Cat' }, { id: 'mushroom', label: 'Mushroom' }];
const EMBLEMS = ['', '📚', '🦉', '🐉', '🌙', '☕', '🪐', '🌟', '🐈', '🦄', '🎧', '🌸'];
const AVATAR_COLORS = ['#E0785A', '#8FA97C', '#D99A2B', '#C58BA6', '#7BA6C4', '#B07CC6', '#6FB0A0', '#D98C6A'];
const showCustomize = ref(false);
const showMore = ref(false);
async function setAppearance(patch) {
  const updated = await api.setAppearance(patch);
  store.setMember(updated);   // recolours nav avatar + applies theme app-wide
  await load();
}

const openLog = ref({});
const toggleLog = (id) => { openLog.value[id] = !openLog.value[id]; };
async function requestDelete(s) {
  if (!confirm('Ask an admin to remove this session? If approved, its coins are taken back.')) return;
  await api.requestDeleteSession(s.id); await load();
}
async function cancelDelete(s) { await api.cancelDeleteSession(s.id); await load(); }
const logDate = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const earnedCount = computed(() => (data.value?.badges || []).filter((b) => b.earned).length);
const selectedBadge = ref(null);

async function saveGoal() {
  savingGoal.value = true;
  try {
    await api.setGoal(Math.round(goalHours.value * 60));
    await load();
  } finally {
    savingGoal.value = false;
  }
}

async function logout() {
  try { await api.logout(); } catch {}
  store.logout();
  router.push('/login');
}
</script>

<template>
  <div class="screen stagger" v-if="data">
    <!-- celebratory hero — this is your space -->
    <div class="card" style="text-align:center;padding:20px 16px 16px;position:relative;background:var(--sage-bg);border-color:transparent;">
      <button v-if="isMe" class="chip" aria-label="Customize" title="Customize" @click="showCustomize = !showCustomize"
        style="position:absolute;top:13px;right:13px;background:var(--card);" :style="showCustomize ? { background: 'var(--terra)', color: '#fff' } : {}">
        <i class="ti ti-settings" aria-hidden="true"></i>
      </button>
      <span style="position:relative;display:inline-block;">
        <Avatar :member="data.member" :size="80" />
        <span v-if="data.member.emblem" style="position:absolute;right:-2px;bottom:-2px;width:26px;height:26px;font-size:15px;background:var(--card);border:1px solid var(--line);border-radius:50%;display:flex;align-items:center;justify-content:center;">{{ data.member.emblem }}</span>
      </span>
      <div class="h" style="font-size:23px;margin-top:9px;">{{ data.member.name }}</div>
      <div class="sub" style="color:var(--sage-d);">{{ readerTitle }}</div>
      <div v-if="rank || streak > 0" class="row" style="gap:6px;justify-content:center;flex-wrap:wrap;margin-top:11px;">
        <span v-if="rank" class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i :class="rank === 1 ? 'ti ti-crown' : 'ti ti-trophy'" aria-hidden="true"></i> {{ rank === 1 ? '1st this month' : ordinal(rank) + ' this month' }}</span>
        <span v-if="streak > 0" class="chip" style="background:#FBE0D2;color:var(--terra-d);"><i class="ti ti-flame flame" aria-hidden="true"></i> {{ streak }}-day streak</span>
      </div>
    </div>

    <!-- accomplishments at a glance -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div class="card" style="text-align:center;padding:14px 6px;">
        <i class="ti ti-clock-hour-3" style="color:var(--terra);font-size:18px;" aria-hidden="true"></i>
        <div style="font-size:17px;font-weight:700;font-family:'Quicksand';margin-top:3px;">{{ fmtDuration(data.totals.minutes) }}</div><div class="sub" style="font-size:11px;">read</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 6px;">
        <i class="ti ti-book-2" style="color:var(--sage-d);font-size:18px;" aria-hidden="true"></i>
        <div style="font-size:17px;font-weight:700;font-family:'Quicksand';margin-top:3px;">{{ booksFinished }}</div><div class="sub" style="font-size:11px;">books</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 6px;">
        <i class="ti ti-coin" style="color:var(--gold);font-size:18px;" aria-hidden="true"></i>
        <div style="font-size:17px;font-weight:700;font-family:'Quicksand';margin-top:3px;color:var(--gold-d);">{{ data.lifetimeEarned ?? data.balance }}</div><div class="sub" style="font-size:11px;">earned</div>
      </div>
    </div>

    <div v-if="isMe && showCustomize" class="card pop-in" style="display:flex;flex-direction:column;gap:15px;">
      <div class="row" style="justify-content:space-between;">
        <span style="font-weight:600;font-size:14px;"><i class="ti ti-palette" style="color:var(--terra);" aria-hidden="true"></i> Customize</span>
        <button class="chip" aria-label="Close" @click="showCustomize = false"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div>
        <div class="sub" style="margin-bottom:8px;"><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> Monthly goal</div>
        <div class="row" style="gap:8px;">
          <input v-model.number="goalHours" type="number" min="0.5" step="0.5" style="width:78px;text-align:center;" aria-label="goal hours" />
          <span class="sub">hours / month</span>
          <button class="chip" :disabled="savingGoal" @click="saveGoal" style="margin-left:auto;background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i> Save</button>
        </div>
      </div>
        <div>
          <div class="sub" style="margin-bottom:8px;">Avatar</div>
          <div class="row" style="gap:9px;flex-wrap:wrap;">
            <button aria-label="Initials" @click="setAppearance({ avatar: '' })"
              style="padding:2px;border-radius:50%;cursor:pointer;background:none;line-height:0;"
              :style="{ border: !data.member.avatar ? '2px solid var(--terra)' : '2px solid transparent' }">
              <Avatar :member="{ avatar: '', color: data.member.color, initials: data.member.initials }" :size="42" />
            </button>
            <button v-for="av in AVATARS" :key="av.id" :aria-label="av.label" @click="setAppearance({ avatar: av.id })"
              style="padding:2px;border-radius:50%;cursor:pointer;background:none;line-height:0;"
              :style="{ border: data.member.avatar === av.id ? '2px solid var(--terra)' : '2px solid transparent' }">
              <Avatar :avatar="av.id" :size="42" />
            </button>
          </div>
        </div>
        <div>
          <div class="sub" style="margin-bottom:8px;">Mascot</div>
          <div class="row" style="gap:8px;flex-wrap:wrap;">
            <button v-for="mc in MASCOTS" :key="mc.id" @click="setAppearance({ mascot: mc.id })"
              style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;border-radius:16px;padding:6px 4px 4px;width:62px;font-family:inherit;background:var(--card);"
              :style="{ border: (data.member.mascot || 'wizard') === mc.id ? '2px solid var(--terra)' : '2px solid var(--line)' }">
              <Mascot :variant="mc.id" :size="40" eyes="happy" />
              <span class="sub" style="font-size:11px;">{{ mc.label }}</span>
            </button>
          </div>
        </div>
        <button class="chip" style="align-self:flex-start;" @click="showMore = !showMore">More options <i :class="showMore ? 'ti ti-chevron-up' : 'ti ti-chevron-down'" style="font-size:14px;" aria-hidden="true"></i></button>
        <template v-if="showMore">
          <div>
            <div class="sub" style="margin-bottom:8px;">Theme</div>
            <div class="row" style="gap:8px;flex-wrap:wrap;">
              <button v-for="t in THEMES" :key="t.id" class="chip" :class="{ on: (data.member.theme || 'classic') === t.id }" style="gap:7px;" @click="setAppearance({ theme: t.id })">
                <span style="width:13px;height:13px;border-radius:50%;display:inline-block;border:1px solid rgba(0,0,0,.12);" :style="{ background: t.dot }"></span>{{ t.label }}
              </button>
            </div>
          </div>
          <div v-if="!data.member.avatar">
            <div class="sub" style="margin-bottom:8px;">Initials colour</div>
            <div class="row" style="gap:9px;flex-wrap:wrap;">
              <button v-for="c in AVATAR_COLORS" :key="c" aria-label="initials colour" @click="setAppearance({ color: c })"
                :style="{ background: c, width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', padding: 0, border: data.member.color === c ? '2px solid var(--ink)' : '2px solid transparent' }"></button>
            </div>
          </div>
          <div>
            <div class="sub" style="margin-bottom:8px;">Emblem</div>
            <div class="row" style="gap:7px;flex-wrap:wrap;">
              <button v-for="e in EMBLEMS" :key="e || 'none'" class="chip" :class="{ on: (data.member.emblem || '') === e }"
                style="width:42px;height:42px;justify-content:center;padding:0;font-size:19px;" :aria-label="e || 'none'" @click="setAppearance({ emblem: e })">
                <span v-if="e">{{ e }}</span><i v-else class="ti ti-ban" style="font-size:16px;" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </template>
      </div>

    <!-- your collection — the centerpiece -->
    <div v-if="data.shelf" class="card" style="display:flex;flex-direction:column;gap:11px;">
      <div class="row" style="justify-content:space-between;">
        <span style="font-weight:600;font-size:14px;"><i class="ti ti-books" style="color:var(--terra);" aria-hidden="true"></i> Your collection<span class="sub" style="font-weight:400;"> · {{ data.shelf.finishedTotal }} book{{ data.shelf.finishedTotal === 1 ? '' : 's' }}</span></span>
        <button v-if="isMe" class="chip" @click="router.push('/shelf')">{{ data.shelf.finishedRecent?.length ? 'Manage' : 'Start' }} <i class="ti ti-chevron-right" aria-hidden="true"></i></button>
      </div>
      <div v-if="data.shelf.finishedRecent?.length" class="mini-shelf">
        <div v-for="b in data.shelf.finishedRecent" :key="b.id" class="mini-spine"
          :style="{ height: (34 + bookSpine(b).tall * 5) + 'px', width: (14 + bookSpine(b).wide * 2) + 'px', background: bookSpine(b).bg }" :title="b.title"></div>
      </div>
      <div class="sub" style="font-size:12px;">{{ data.shelf.finishedThisYear }} finished in {{ year }}<span v-if="data.shelf.wantTotal"> · {{ data.shelf.wantTotal }} up next</span></div>
      <div v-for="b in data.shelf.reading" :key="b.id" class="row" style="gap:8px;">
        <span v-if="b.emoji" style="font-size:15px;flex-shrink:0;line-height:1;">{{ b.emoji }}</span>
        <i v-else class="ti ti-book" style="color:var(--terra);font-size:15px;flex-shrink:0;" aria-hidden="true"></i>
        <div style="min-width:0;font-size:13px;"><span style="font-weight:600;">{{ b.title }}</span><span class="sub" v-if="b.author"> · {{ b.author }}</span> <span class="sub">· reading</span></div>
      </div>
      <div v-if="!data.shelf.finishedTotal && !data.shelf.reading.length && !data.shelf.wantTotal" class="sub">{{ isMe ? 'Add the book you’re reading to start your shelf.' : 'No books on the shelf yet.' }}</div>
    </div>

    <!-- badges as trophies -->
    <div class="card" style="display:flex;flex-direction:column;gap:14px;">
      <span style="font-weight:600;font-size:14px;"><i class="ti ti-award" style="color:var(--gold-d);" aria-hidden="true"></i> Badges<span class="sub" style="font-weight:400;"> · {{ earnedCount }} of {{ data.badges.length }} earned</span></span>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
        <button v-for="b in data.badges" :key="b.id" @click="selectedBadge = selectedBadge && selectedBadge.id === b.id ? null : b"
          style="background:none;border:none;cursor:pointer;text-align:center;padding:0;font-family:inherit;" :style="{ opacity: b.earned ? 1 : .35 }">
          <span class="av" style="width:46px;height:46px;margin:0 auto;transition:box-shadow .15s ease;"
            :style="[b.earned ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' } : { background: '#EDE5D6', color: '#A99A85' }, selectedBadge && selectedBadge.id === b.id ? { boxShadow: '0 0 0 3px var(--terra)' } : {}]">
            <i :class="['ti', b.icon]" style="font-size:22px;" aria-hidden="true"></i>
          </span>
          <div class="sub" style="margin-top:5px;font-size:11px;line-height:1.2;">{{ b.name }}</div>
        </button>
      </div>
      <div v-if="selectedBadge" class="pop-in" style="background:var(--paper);border-radius:14px;padding:11px 13px;display:flex;gap:10px;align-items:center;">
        <span class="av" style="width:34px;height:34px;flex-shrink:0;" :style="selectedBadge.earned ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' } : { background: '#EDE5D6', color: '#A99A85' }"><i :class="['ti', selectedBadge.icon]" style="font-size:17px;" aria-hidden="true"></i></span>
        <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;">{{ selectedBadge.name }}</div><div class="sub">{{ selectedBadge.desc }}</div></div>
        <span class="chip" :style="selectedBadge.earned ? { background: 'var(--sage-bg)', color: 'var(--sage-d)' } : {}">{{ selectedBadge.earned ? 'Earned' : 'Locked' }}</span>
      </div>
    </div>

    <!-- time by format -->
    <div v-if="data.byMedium.length" class="card">
      <div class="sub" style="margin-bottom:10px;">Time by format</div>
      <div v-for="b in data.byMedium" :key="b.medium" class="row" style="gap:10px;font-size:13px;padding:4px 0;">
        <span style="width:62px;flex-shrink:0;">{{ mediumLabel(b.medium) }}</span>
        <div class="bar" style="flex:1;"><span :style="{ width: (b.minutes / maxMedium * 100) + '%', background: 'var(--terra)' }"></span></div>
        <span class="sub" style="width:52px;text-align:right;flex-shrink:0;">{{ fmtDuration(b.minutes) }}</span>
      </div>
    </div>

    <!-- reading journey -->
    <div class="sub" style="margin-top:2px;"><i class="ti ti-history" aria-hidden="true"></i> Reading journey</div>
    <div v-if="!data.recent.length" class="card sub">No sessions logged yet.</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="s in data.recent" :key="s.id" class="card" style="padding:0;overflow:hidden;">
        <button @click="toggleLog(s.id)"
          style="display:flex;align-items:center;gap:11px;width:100%;background:none;border:none;cursor:pointer;padding:12px 15px;text-align:left;font-family:inherit;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ logTitle(s) }}</div>
            <div class="sub">{{ logMeta(s) }}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:600;color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ s.coins }}</div>
            <div class="sub" style="font-size:11px;">{{ logDate(s.createdAt) }}</div>
          </div>
          <span v-if="s.deleteRequested" class="chip" style="padding:2px 8px;font-size:11px;background:#FBE0D2;color:var(--terra-d);flex-shrink:0;" title="Removal awaiting admin">pending</span>
          <i v-if="s.summary || s.quote || isMe" class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;flex-shrink:0;" :style="{ transform: openLog[s.id] ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
        </button>
        <div v-if="openLog[s.id] && (s.summary || s.quote || isMe)" style="padding:11px 15px 13px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:8px;">
          <div v-if="s.summary" style="font-size:14px;line-height:1.5;">{{ s.summary }}</div>
          <div v-if="s.quote" class="sub" style="font-style:italic;">“{{ s.quote }}”</div>
          <div v-if="isMe" class="row" style="gap:8px;">
            <template v-if="s.deleteRequested">
              <span class="sub" style="flex:1;"><i class="ti ti-clock" aria-hidden="true"></i> Removal requested — waiting for an admin</span>
              <button class="chip" @click="cancelDelete(s)">Cancel request</button>
            </template>
            <button v-else class="chip" style="color:var(--terra-d);" @click="requestDelete(s)"><i class="ti ti-trash" aria-hidden="true"></i> Request removal</button>
          </div>
        </div>
      </div>
    </div>

    <button v-if="isMe && data.member.role === 'admin'" class="btn soft" style="margin-top:8px;" @click="router.push('/admin')"><i class="ti ti-settings" aria-hidden="true"></i> Admin</button>
    <button v-if="isMe" class="btn soft" @click="logout"><i class="ti ti-logout" aria-hidden="true"></i> Log out</button>
    <div class="sub" style="text-align:center;font-size:11px;opacity:.6;margin-top:6px;">BookCoin v{{ version }}</div>
  </div>
</template>

<style scoped>
.mini-shelf {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  padding: 12px 12px 0;
  min-height: 58px;
  background: #4A3526;
  border-bottom: 7px solid #A97E4F;
  border-radius: 9px;
  box-shadow: inset 0 2px 7px rgba(0, 0, 0, .28);
  overflow: hidden;
}
.mini-spine {
  flex-shrink: 0;
  border-radius: 2px 2px 0 0;
  box-shadow: inset -1.5px 0 3px rgba(0, 0, 0, .22), inset 1.5px 0 2px rgba(255, 255, 255, .12);
}
</style>
