<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const allowed = ref(true);
const quests = ref([]);
const rewards = ref([]);
const redemptions = ref([]);
const claims = ref([]);
const toast = ref('');

const qForm = reactive({ title: '', description: '', type: 'minutes', target: 60, rewardCoins: 100, period: 'month', requiresApproval: false });
const rForm = reactive({ name: '', description: '', costCoins: 200, tier: 'low', stock: '' });

const QTYPES = [['minutes', 'minutes read'], ['sessions', '# sessions'], ['genres', '# genres'], ['mediums', '# formats'], ['streak', 'day streak'], ['manual', 'manual / bounty']];
const pendingRedemptions = computed(() => redemptions.value.filter((r) => r.status === 'requested'));

async function load() {
  try {
    [quests.value, rewards.value, redemptions.value, claims.value] = await Promise.all([
      api.admin.quests(), api.admin.rewards(), api.admin.redemptions(), api.admin.claims(),
    ]);
  } catch (e) {
    if (/admin/i.test(e.message)) allowed.value = false;
  }
}
onMounted(load);

async function act(fn) { try { await fn(); await load(); } catch (e) { toast.value = e.message; } }
async function createQuest() {
  if (!qForm.title) return;
  await act(() => api.admin.createQuest({ ...qForm }));
  toast.value = 'Quest added'; qForm.title = ''; qForm.description = '';
}
async function createReward() {
  if (!rForm.name) return;
  await act(() => api.admin.createReward({ ...rForm }));
  toast.value = 'Reward added'; rForm.name = ''; rForm.description = '';
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

      <div class="sub">needs your ok</div>
      <div v-if="!claims.length && !pendingRedemptions.length" class="card sub">Nothing waiting.</div>
      <div v-for="c in claims" :key="'c' + c.id" class="card row" style="gap:10px;">
        <span class="av" style="width:30px;height:30px;" :style="{ background: c.color }">{{ c.initials }}</span>
        <div style="flex:1;"><div style="font-weight:600;">{{ c.member }}</div><div class="sub">quest: {{ c.title }} · +{{ c.rewardCoins }}</div></div>
        <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.approveClaim(c.id))"><i class="ti ti-check" aria-hidden="true"></i></button>
        <button class="chip" @click="act(() => api.admin.rejectClaim(c.id))"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <div v-for="r in pendingRedemptions" :key="'r' + r.id" class="card row" style="gap:10px;">
        <span class="av" style="width:30px;height:30px;" :style="{ background: r.color }">{{ r.initials }}</span>
        <div style="flex:1;"><div style="font-weight:600;">{{ r.member }}</div><div class="sub">reward: {{ r.name }} · {{ r.costCoins }} coins</div></div>
        <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.fulfill(r.id))"><i class="ti ti-check" aria-hidden="true"></i> give</button>
        <button class="chip" @click="act(() => api.admin.cancel(r.id))">refund</button>
      </div>

      <div class="sub" style="margin-top:6px;">new quest</div>
      <div class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="qForm.title" placeholder="title" />
        <input v-model="qForm.description" placeholder="description" />
        <div class="row" style="gap:8px;">
          <select v-model="qForm.type" style="flex:1;"><option v-for="t in QTYPES" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
          <select v-model="qForm.period" style="width:120px;"><option value="month">monthly</option><option value="once">one-time</option></select>
        </div>
        <div class="row" style="gap:8px;">
          <input v-model.number="qForm.target" type="number" min="1" placeholder="target" />
          <input v-model.number="qForm.rewardCoins" type="number" min="0" placeholder="coins" />
        </div>
        <label v-if="qForm.type === 'manual'" class="sub row" style="gap:8px;"><input type="checkbox" v-model="qForm.requiresApproval" style="width:auto;" /> needs admin approval</label>
        <button class="btn" @click="createQuest"><i class="ti ti-plus" aria-hidden="true"></i> Add quest</button>
      </div>

      <div class="sub">quests</div>
      <div v-for="q in quests" :key="q.id" class="card row" style="padding:10px 13px;" :style="q.active ? {} : { opacity: .5 }">
        <div style="flex:1;"><span style="font-weight:600;">{{ q.title }}</span> <span class="sub">{{ q.type }} · +{{ q.reward_coins }}</span></div>
        <button v-if="q.active" class="chip" @click="act(() => api.admin.deleteQuest(q.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <span v-else class="sub">retired</span>
      </div>

      <div class="sub" style="margin-top:6px;">new reward</div>
      <div class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="rForm.name" placeholder="name" />
        <input v-model="rForm.description" placeholder="description" />
        <div class="row" style="gap:8px;">
          <input v-model.number="rForm.costCoins" type="number" min="0" placeholder="cost" />
          <select v-model="rForm.tier" style="width:100px;"><option value="low">low</option><option value="mid">mid</option><option value="high">high</option></select>
          <input v-model="rForm.stock" type="number" min="0" placeholder="stock ∞" style="width:110px;" />
        </div>
        <button class="btn" @click="createReward"><i class="ti ti-plus" aria-hidden="true"></i> Add reward</button>
      </div>

      <div class="sub">rewards</div>
      <div v-for="r in rewards" :key="r.id" class="card row" style="padding:10px 13px;" :style="r.active ? {} : { opacity: .5 }">
        <div style="flex:1;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.cost_coins }} · {{ r.tier }}</span></div>
        <button v-if="r.active" class="chip" @click="act(() => api.admin.deleteReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        <span v-else class="sub">retired</span>
      </div>
    </template>
  </div>
</template>
