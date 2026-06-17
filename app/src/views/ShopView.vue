<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api';
import { store } from '../store';

const data = ref(null);
const redemptions = ref([]);
const offers = ref({ mine: [], toFulfill: [] });
const busy = ref(null);
const toast = ref('');
const burst = ref(false);
const showOffer = ref(false);
const form = reactive({ name: '', description: '', costCoins: 50, ownerCut: 50, tier: 'mid' });

async function load() {
  [data.value, redemptions.value, offers.value] = await Promise.all([api.rewards(), api.myRedemptions(), api.myOffers()]);
}
onMounted(load);

const tier = {
  low: { bg: 'var(--sage-bg)', fg: 'var(--sage-d)' },
  mid: { bg: 'var(--gold-bg)', fg: 'var(--gold-d)' },
  high: { bg: 'var(--blush-bg)', fg: 'var(--blush-d)' },
};
const statusStyle = (s) => s === 'fulfilled' || s === 'approved'
  ? { background: 'var(--sage-bg)', color: 'var(--sage-d)' }
  : s === 'cancelled' || s === 'denied'
    ? { background: 'var(--chip)', color: 'var(--chip-ink)' }
    : { background: 'var(--gold-bg)', color: 'var(--gold-d)' };

async function run(fn, msg) {
  busy.value = true; toast.value = '';
  try { await fn(); if (msg) toast.value = msg; await load(); }
  catch (e) { toast.value = e.message; }
  finally { busy.value = false; }
}
function redeem(r) {
  if (r.ownerId === store.member.id || data.value.balance < r.costCoins) return;
  run(async () => { await api.redeemReward(r.id); burst.value = true; setTimeout(() => { burst.value = false; }, 1300); }, `${r.name} redeemed — ${r.ownerName} will deliver it`);
}
function submitOffer() {
  if (!form.name.trim()) { toast.value = 'Give it a name'; return; }
  run(() => api.createReward({ ...form }), store.member.role === 'admin' ? 'Reward added' : 'Sent to an admin for approval')
    .then(() => { showOffer.value = false; form.name = ''; form.description = ''; });
}
</script>

<template>
  <div class="screen" v-if="data">
    <CoinBurst v-if="burst" />
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-gift" style="color:var(--terra);" aria-hidden="true"></i> Rewards</div>
      <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> <CoinCount :value="data.balance" /></span>
    </div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <button class="chip" style="align-self:flex-start;" @click="showOffer = !showOffer"><i class="ti ti-plus" aria-hidden="true"></i> Offer a reward</button>
    <div v-if="showOffer" class="card" style="display:flex;flex-direction:column;gap:9px;">
      <input v-model="form.name" placeholder="What are you offering? (e.g. a drawing)" />
      <input v-model="form.description" placeholder="Description (optional)" />
      <div class="row" style="gap:8px;">
        <label class="sub" style="flex:1;">Price <input v-model.number="form.costCoins" type="number" min="0" /></label>
        <label class="sub" style="flex:1;">Your cut % <input v-model.number="form.ownerCut" type="number" min="0" max="100" /></label>
      </div>
      <div class="sub">You keep {{ form.ownerCut }}% of the price ({{ Math.round(form.costCoins * form.ownerCut / 100) }} coins); the rest is spent.</div>
      <button class="btn" :disabled="busy" @click="submitOffer"><i class="ti ti-check" aria-hidden="true"></i> {{ store.member.role === 'admin' ? 'Add reward' : 'Submit for approval' }}</button>
    </div>

    <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
      <div v-for="r in data.rewards" :key="r.id" class="card row" style="gap:12px;">
        <div style="flex:1;">
          <div class="row" style="gap:8px;">
            <span style="font-weight:600;">{{ r.name }}</span>
            <span class="chip" :style="{ background: tier[r.tier].bg, color: tier[r.tier].fg, padding: '3px 10px' }">{{ r.tier }}</span>
          </div>
          <div class="sub" v-if="r.description">{{ r.description }}</div>
          <div class="sub" style="margin-top:2px;">
            <span class="av" style="width:18px;height:18px;font-size:9px;display:inline-flex;vertical-align:-4px;" :style="{ background: r.ownerColor }">{{ r.ownerInitials }}</span>
            offered by {{ r.ownerName }}<span v-if="r.stock != null"> · {{ r.stock }} left</span>
          </div>
        </div>
        <span v-if="r.ownerId === store.member.id" class="chip" style="align-self:center;">yours</span>
        <button v-else class="btn" style="width:auto;padding:11px 15px;align-self:center;"
          :disabled="busy || data.balance < r.costCoins || (r.stock != null && r.stock <= 0)" @click="redeem(r)">
          <i class="ti ti-coin" aria-hidden="true"></i> {{ r.costCoins }}
        </button>
      </div>
    </div>

    <template v-if="offers.toFulfill.length">
      <div class="sub" style="margin-top:6px;">To deliver</div>
      <div v-for="rd in offers.toFulfill" :key="rd.id" class="card row" style="gap:10px;">
        <span class="av" style="width:30px;height:30px;" :style="{ background: rd.color }">{{ rd.initials }}</span>
        <div style="flex:1;"><div style="font-weight:600;">{{ rd.name }}</div><div class="sub">for {{ rd.member }} · you earn {{ Math.round(rd.costCoins * rd.ownerCut / 100) }}</div></div>
        <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" :disabled="busy" @click="run(() => api.fulfillRedemption(rd.id), 'Delivered!')"><i class="ti ti-check" aria-hidden="true"></i> Given</button>
        <button class="chip" :disabled="busy" @click="run(() => api.cancelRedemption(rd.id), 'Cancelled & refunded')"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
    </template>

    <template v-if="offers.mine.length">
      <div class="sub" style="margin-top:6px;">Your offers</div>
      <div v-for="r in offers.mine" :key="r.id" class="card row" style="padding:11px 14px;">
        <div style="flex:1;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.costCoins }} · {{ r.ownerCut }}% cut</span></div>
        <span class="chip" :style="statusStyle(r.status)" style="padding:3px 10px;">{{ r.status }}</span>
        <button class="chip" :disabled="busy" @click="run(() => api.archiveReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div>
    </template>

    <template v-if="redemptions.length">
      <div class="sub" style="margin-top:6px;">Your redemptions</div>
      <div v-for="rd in redemptions" :key="rd.id" class="card row" style="justify-content:space-between;padding:11px 14px;">
        <span>{{ rd.name }}</span>
        <span class="chip" :style="statusStyle(rd.status)">{{ rd.status === 'requested' ? 'pending' : rd.status }}</span>
      </div>
    </template>
  </div>
</template>
