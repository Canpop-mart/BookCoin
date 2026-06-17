<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, MEDIUMS } from '../data';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const goalHours = ref(15);
const savingGoal = ref(false);
const id = computed(() => Number(route.params.id) || store.member.id);

async function load() {
  data.value = await api.profile(id.value);
  goalHours.value = Math.round((data.value.member.monthlyGoalMinutes / 60) * 2) / 2;
}
onMounted(load);
watch(() => route.params.id, load);

const isMe = computed(() => id.value === store.member.id);
const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;
const openLog = ref({});
const toggleLog = (id) => { openLog.value[id] = !openLog.value[id]; };
const logDate = (ts) => (ts ? new Date(ts.replace(' ', 'T') + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');
const earnedCount = computed(() => (data.value?.badges || []).filter((b) => b.earned).length);

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
    <div class="row" style="gap:13px;">
      <span class="av" style="width:54px;height:54px;font-size:19px;" :style="{ background: data.member.color }">{{ data.member.initials }}</span>
      <div>
        <div class="h" style="font-size:21px;">{{ data.member.name }}</div>
        <div class="sub"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ data.balance }} coins</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ fmtDuration(data.totals.minutes) }}</div>
        <div class="sub">Read</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ data.totals.sessions }}</div>
        <div class="sub">Sessions</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ data.totals.pages }}</div>
        <div class="sub">Pages</div>
      </div>
    </div>

    <div v-if="isMe" class="card row" style="justify-content:space-between;">
      <div>
        <div style="font-weight:600;font-size:14px;"><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> Monthly goal</div>
        <div class="sub">Your monthly reading target</div>
      </div>
      <div class="row" style="gap:6px;">
        <input v-model.number="goalHours" type="number" min="0.5" step="0.5" style="width:64px;text-align:center;padding:9px;" aria-label="goal hours" />
        <span class="sub">h</span>
        <button class="chip" :disabled="savingGoal" @click="saveGoal" style="background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i></button>
      </div>
    </div>

    <div class="row" style="justify-content:space-between;">
      <span class="sub">Badges</span>
      <span class="sub">{{ earnedCount }} / {{ data.badges.length }}</span>
    </div>
    <div class="card" style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;">
      <div v-for="b in data.badges" :key="b.id" style="text-align:center;" :style="{ opacity: b.earned ? 1 : .3 }" :title="b.desc">
        <span class="av" style="width:46px;height:46px;margin:0 auto;"
          :style="b.earned ? { background: 'var(--gold-bg)', color: 'var(--gold-d)' } : { background: '#EDE5D6', color: '#A99A85' }">
          <i :class="['ti', b.icon]" style="font-size:22px;" aria-hidden="true"></i>
        </span>
        <div class="sub" style="margin-top:5px;font-size:11px;line-height:1.2;">{{ b.name }}</div>
      </div>
    </div>

    <div v-if="data.byMedium.length" class="card">
      <div class="sub" style="margin-bottom:8px;">Time by format</div>
      <div v-for="b in data.byMedium" :key="b.medium" class="row" style="justify-content:space-between;font-size:14px;padding:3px 0;">
        <span>{{ mediumLabel(b.medium) }}</span><span class="sub">{{ fmtDuration(b.minutes) }}</span>
      </div>
    </div>

    <div class="sub" style="margin-top:2px;">Reading log</div>
    <div v-if="!data.recent.length" class="card sub">No sessions logged yet.</div>
    <div class="stagger" style="display:flex;flex-direction:column;gap:8px;">
      <div v-for="s in data.recent" :key="s.id" class="card" style="padding:0;overflow:hidden;">
        <button @click="toggleLog(s.id)"
          style="display:flex;align-items:center;gap:11px;width:100%;background:none;border:none;cursor:pointer;padding:12px 15px;text-align:left;font-family:inherit;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">{{ s.title || 'Untitled' }}</div>
            <div class="sub">{{ fmtDuration(s.minutes) }} · {{ mediumLabel(s.medium) }}<span v-if="s.genres?.length"> · {{ s.genres.join(', ') }}</span></div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:600;color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ s.coins }}</div>
            <div class="sub" style="font-size:11px;">{{ logDate(s.createdAt) }}</div>
          </div>
          <i v-if="s.summary || s.quote" class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;flex-shrink:0;" :style="{ transform: openLog[s.id] ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
        </button>
        <div v-if="openLog[s.id] && (s.summary || s.quote)" style="padding:11px 15px 13px;border-top:1px solid var(--line);">
          <div v-if="s.summary" style="font-size:14px;line-height:1.5;">{{ s.summary }}</div>
          <div v-if="s.quote" class="sub" style="font-style:italic;margin-top:6px;">“{{ s.quote }}”</div>
        </div>
      </div>
    </div>

    <button v-if="isMe && data.member.role === 'admin'" class="btn soft" style="margin-top:8px;" @click="router.push('/admin')"><i class="ti ti-settings" aria-hidden="true"></i> Admin</button>
    <button v-if="isMe" class="btn soft" @click="logout"><i class="ti ti-logout" aria-hidden="true"></i> Log out</button>
  </div>
</template>
