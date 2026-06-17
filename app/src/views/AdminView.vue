<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const allowed = ref(true);
const members = ref([]);
const quests = ref([]);
const rewards = ref([]);
const redemptions = ref([]);
const claims = ref([]);
const toast = ref('');

const COLORS = ['#E0785A', '#8FA97C', '#D99A2B', '#C58BA6', '#7BA6C4', '#B07CC6', '#6FB0A0', '#D98C6A'];
const mForm = reactive({ id: null, name: '', pin: '', role: 'member', goalHours: 15, color: '' });
const qForm = reactive({ title: '', description: '', type: 'minutes', target: 60, rewardCoins: 100, period: 'month', requiresApproval: false });
const rForm = reactive({ name: '', description: '', costCoins: 200, tier: 'low', stock: '' });

const QTYPES = [['minutes', 'Minutes read'], ['sessions', 'Sessions logged'], ['genres', 'Genres read'], ['mediums', 'Formats read'], ['streak', 'Day streak'], ['manual', 'Manual / bounty']];
const pendingRedemptions = computed(() => redemptions.value.filter((r) => r.status === 'requested'));

async function load() {
  try {
    [members.value, quests.value, rewards.value, redemptions.value, claims.value] = await Promise.all([
      api.admin.members(), api.admin.quests(), api.admin.rewards(), api.admin.redemptions(), api.admin.claims(),
    ]);
  } catch (e) {
    if (/admin/i.test(e.message)) allowed.value = false;
  }
}
onMounted(load);

async function act(fn) { try { await fn(); await load(); } catch (e) { toast.value = e.message; } }

function resetMember() { Object.assign(mForm, { id: null, name: '', pin: '', role: 'member', goalHours: 15, color: '' }); }
function editMember(m) {
  Object.assign(mForm, { id: m.id, name: m.name, pin: '', role: m.role, goalHours: Math.round(m.monthlyGoalMinutes / 60 * 2) / 2, color: m.color });
}
async function saveMember() {
  if (!mForm.name.trim()) { toast.value = 'Name is required'; return; }
  if (!mForm.id && !mForm.pin) { toast.value = 'Set a PIN'; return; }
  const body = { name: mForm.name.trim(), role: mForm.role, monthlyGoalMinutes: Math.round(mForm.goalHours * 60), color: mForm.color || undefined };
  if (mForm.pin) body.pin = mForm.pin;
  try {
    if (mForm.id) await api.admin.updateMember(mForm.id, body);
    else await api.admin.createMember(body);
    toast.value = mForm.id ? 'Member saved' : 'Member added';
    resetMember();
    await load();
  } catch (e) { toast.value = e.message; }
}
function removeMember(m) {
  if (!confirm(`Delete ${m.name}? This also removes their reading history and coins.`)) return;
  act(() => api.admin.deleteMember(m.id));
}

async function createQuest() {
  if (!qForm.title) return;
  await act(() => api.admin.createQuest({ ...qForm }));
  toast.value = 'Quest created'; qForm.title = ''; qForm.description = '';
}
async function createReward() {
  if (!rForm.name) return;
  await act(() => api.admin.createReward({ ...rForm }));
  toast.value = 'Reward created'; rForm.name = ''; rForm.description = '';
}
</script>

<template>
  <div class="screen full">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-settings" style="color:var(--terra);" aria-hidden="true"></i> Admin</div>
      <button class="chip" @click="router.push('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div v-if="!allowed" class="card sub">Admins only.</div>

    <template v-else>
      <p v-if="toast" class="sub" style="color:var(--sage-d);">{{ toast }}</p>

      <div class="sub">Pending approval</div>
      <div v-if="!claims.length && !pendingRedemptions.length" class="card sub">Nothing pending.</div>
      <div v-for="c in claims" :key="'c' + c.id" class="card row" style="gap:10px;">
        <span class="av" style="width:30px;height:30px;" :style="{ background: c.color }">{{ c.initials }}</span>
        <div style="flex:1;"><div style="font-weight:600;">{{ c.member }}</div><div class="sub">quest: {{ c.title }} · +{{ c.rewardCoins }}</div></div>
        <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.approveClaim(c.id))"><i class="ti ti-check" aria-hidden="true"></i></button>
        <button class="chip" @click="act(() => api.admin.rejectClaim(c.id))"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div v-for="r in pendingRedemptions" :key="'r' + r.id" class="card row" style="gap:10px;">
        <span class="av" style="width:30px;height:30px;" :style="{ background: r.color }">{{ r.initials }}</span>
        <div style="flex:1;"><div style="font-weight:600;">{{ r.member }}</div><div class="sub">reward: {{ r.name }} · {{ r.costCoins }} coins</div></div>
        <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.fulfill(r.id))"><i class="ti ti-check" aria-hidden="true"></i> Fulfill</button>
        <button class="chip" @click="act(() => api.admin.cancel(r.id))">refund</button>
      </div>

      <div class="sub" style="margin-top:6px;">Members</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div v-for="m in members" :key="m.id" class="card row" style="padding:10px 13px;gap:10px;">
          <span class="av" style="width:30px;height:30px;" :style="{ background: m.color }">{{ m.initials }}</span>
          <div style="flex:1;">
            <span style="font-weight:600;">{{ m.name }}</span>
            <span v-if="m.role === 'admin'" class="chip" style="padding:2px 9px;margin-left:6px;background:var(--gold-bg);color:var(--gold-d);">admin</span>
          </div>
          <button class="chip" aria-label="edit" @click="editMember(m)"><i class="ti ti-edit" aria-hidden="true"></i></button>
          <button class="chip" aria-label="delete" @click="removeMember(m)"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;gap:9px;">
        <div class="sub">{{ mForm.id ? 'Edit member' : 'Add member' }}</div>
        <input v-model="mForm.name" placeholder="Name" />
        <input v-model="mForm.pin" :placeholder="mForm.id ? 'New PIN (blank = keep)' : 'PIN'" inputmode="numeric" autocomplete="off" />
        <div class="row" style="gap:8px;">
          <select v-model="mForm.role" style="flex:1;"><option value="member">Member</option><option value="admin">Admin</option></select>
          <input v-model.number="mForm.goalHours" type="number" min="0.5" step="0.5" style="width:108px;" placeholder="Goal (h)" />
        </div>
        <div class="row" style="gap:8px;flex-wrap:wrap;">
          <button v-for="c in COLORS" :key="c" aria-label="colour" @click="mForm.color = c"
            :style="{ background: c, width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', padding: 0, border: mForm.color === c ? '2px solid var(--ink)' : '2px solid transparent' }"></button>
        </div>
        <button class="btn" @click="saveMember"><i class="ti ti-check" aria-hidden="true"></i> {{ mForm.id ? 'Save member' : 'Add member' }}</button>
        <button v-if="mForm.id" class="chip" @click="resetMember">Cancel</button>
      </div>

      <div class="sub" style="margin-top:6px;">Create quest</div>
      <div class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="qForm.title" placeholder="Title" />
        <input v-model="qForm.description" placeholder="Description" />
        <div class="row" style="gap:8px;">
          <select v-model="qForm.type" style="flex:1;"><option v-for="t in QTYPES" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
          <select v-model="qForm.period" style="width:120px;"><option value="month">Monthly</option><option value="once">One-time</option></select>
        </div>
        <div class="row" style="gap:8px;">
          <input v-model.number="qForm.target" type="number" min="1" placeholder="Target" />
          <input v-model.number="qForm.rewardCoins" type="number" min="0" placeholder="Reward coins" />
        </div>
        <label v-if="qForm.type === 'manual'" class="sub row" style="gap:8px;"><input type="checkbox" v-model="qForm.requiresApproval" style="width:auto;" /> Requires approval</label>
        <button class="btn" @click="createQuest"><i class="ti ti-plus" aria-hidden="true"></i> Create quest</button>
      </div>

      <div class="sub">Quests</div>
      <div v-for="q in quests" :key="q.id" class="card row" style="padding:10px 13px;" :style="q.active ? {} : { opacity: .5 }">
        <div style="flex:1;"><span style="font-weight:600;">{{ q.title }}</span> <span class="sub">{{ q.type }} · +{{ q.reward_coins }}</span></div>
        <button v-if="q.active" class="chip" @click="act(() => api.admin.deleteQuest(q.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <span v-else class="sub">retired</span>
      </div>

      <div class="sub" style="margin-top:6px;">Create reward</div>
      <div class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="rForm.name" placeholder="Name" />
        <input v-model="rForm.description" placeholder="Description" />
        <div class="row" style="gap:8px;">
          <input v-model.number="rForm.costCoins" type="number" min="0" placeholder="Cost" />
          <select v-model="rForm.tier" style="width:100px;"><option value="low">Low</option><option value="mid">Mid</option><option value="high">High</option></select>
          <input v-model="rForm.stock" type="number" min="0" placeholder="Stock (∞)" style="width:120px;" />
        </div>
        <button class="btn" @click="createReward"><i class="ti ti-plus" aria-hidden="true"></i> Create reward</button>
      </div>

      <div class="sub">Rewards</div>
      <div v-for="r in rewards" :key="r.id" class="card row" style="padding:10px 13px;" :style="r.active ? {} : { opacity: .5 }">
        <div style="flex:1;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.cost_coins }} · {{ r.tier }}</span></div>
        <button v-if="r.active" class="chip" @click="act(() => api.admin.deleteReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <span v-else class="sub">retired</span>
      </div>
    </template>
  </div>
</template>
