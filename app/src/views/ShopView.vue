<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '../api';
import { store } from '../store';

const data = ref(null);
const redemptions = ref([]);
const offers = ref({ mine: [], toFulfill: [] });
const busy = ref(false);
const toast = ref('');
const burst = ref(false);
const view = ref('shop');
const menuOpen = ref(false);
const showOffer = ref(false);
const form = reactive({ name: '', description: '', costCoins: 50, ownerCut: 50, tier: 'mid' });

async function load() {
  [data.value, redemptions.value, offers.value] = await Promise.all([api.rewards(), api.myRedemptions(), api.myOffers()]);
}
onMounted(load);

function setView(v) { view.value = v; menuOpen.value = false; }

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
      <div style="position:relative;">
        <button class="reward-switch" @click="menuOpen = !menuOpen">
          <i class="ti ti-gift" style="color:var(--terra);" aria-hidden="true"></i>
          {{ view === 'shop' ? 'Shop' : 'My offers' }}
          <i class="ti ti-chevron-down" style="font-size:15px;color:var(--ink2);" aria-hidden="true"></i>
        </button>
        <template v-if="menuOpen">
          <div @click="menuOpen = false" style="position:fixed;inset:0;z-index:20;"></div>
          <div class="reward-menu">
            <button @click="setView('shop')" :style="view === 'shop' ? { background: 'var(--cream)', fontWeight: 600 } : {}">Shop</button>
            <button @click="setView('mine')" :style="view === 'mine' ? { background: 'var(--cream)', fontWeight: 600 } : {}">
              My offers<span v-if="offers.toFulfill.length" style="margin-left:auto;color:var(--terra-d);">{{ offers.toFulfill.length }}</span>
            </button>
          </div>
        </template>
      </div>
      <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> <CoinCount :value="data.balance" /></span>
    </div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <!-- ============ SHOP ============ -->
    <template v-if="view === 'shop'">
      <button class="chip" style="align-self:flex-start;" @click="showOffer = !showOffer"><i class="ti ti-plus" aria-hidden="true"></i> Offer a reward</button>
      <div v-if="showOffer" class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="form.name" placeholder="What are you offering? (e.g. a drawing)" />
        <input v-model="form.description" placeholder="Description (optional)" />
        <div class="row" style="gap:8px;">
          <label class="sub" style="flex:1;">Price <input v-model.number="form.costCoins" type="number" min="0" /></label>
          <label class="sub" style="flex:1;">Your cut % <input v-model.number="form.ownerCut" type="number" min="0" max="100" /></label>
        </div>
        <div class="sub">You keep {{ Math.round(form.costCoins * form.ownerCut / 100) }} coins; the rest is spent.</div>
        <button class="btn" :disabled="busy" @click="submitOffer"><i class="ti ti-check" aria-hidden="true"></i> {{ store.member.role === 'admin' ? 'Add reward' : 'Submit for approval' }}</button>
      </div>

      <div v-if="!data.rewards.length" class="card sub">No rewards yet — offer one above!</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="r in data.rewards" :key="r.id" class="card" style="display:flex;gap:13px;align-items:center;">
          <div style="width:48px;height:48px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"
            :style="{ background: tier[r.tier].bg, color: tier[r.tier].fg }">
            <i class="ti ti-gift" style="font-size:24px;" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">{{ r.name }}</div>
            <div class="sub" v-if="r.description">{{ r.description }}</div>
            <div class="row" style="gap:6px;margin-top:4px;">
              <span class="av" style="width:18px;height:18px;font-size:8px;" :style="{ background: r.ownerColor }">{{ r.ownerInitials }}</span>
              <span class="sub">{{ r.ownerName }}<span v-if="r.stock != null"> · {{ r.stock }} left</span></span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">
            <div style="font-weight:700;font-family:'Quicksand';color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ r.costCoins }}</div>
            <span v-if="r.ownerId === store.member.id" class="chip" style="padding:5px 12px;">yours</span>
            <button v-else class="btn" style="width:auto;padding:8px 16px;font-size:14px;"
              :disabled="busy || data.balance < r.costCoins || (r.stock != null && r.stock <= 0)" @click="redeem(r)">Redeem</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ MY OFFERS ============ -->
    <template v-else>
      <div v-if="!offers.toFulfill.length && !offers.mine.length && !redemptions.length" class="card sub">
        Nothing here yet — redeem a reward or offer one of your own.
      </div>

      <template v-if="offers.toFulfill.length">
        <div class="sub">To deliver</div>
        <div v-for="rd in offers.toFulfill" :key="rd.id" class="card row" style="gap:10px;">
          <span class="av" style="width:30px;height:30px;" :style="{ background: rd.color }">{{ rd.initials }}</span>
          <div style="flex:1;"><div style="font-weight:600;">{{ rd.name }}</div><div class="sub">for {{ rd.member }} · you earn {{ Math.round(rd.costCoins * rd.ownerCut / 100) }}</div></div>
          <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" :disabled="busy" @click="run(() => api.fulfillRedemption(rd.id), 'Delivered!')"><i class="ti ti-check" aria-hidden="true"></i> Given</button>
          <button class="chip" :disabled="busy" @click="run(() => api.cancelRedemption(rd.id), 'Cancelled & refunded')"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
      </template>

      <template v-if="offers.mine.length">
        <div class="sub" style="margin-top:4px;">Listed by you</div>
        <div v-for="r in offers.mine" :key="r.id" class="card row" style="padding:11px 14px;gap:8px;">
          <div style="flex:1;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.costCoins }} · {{ r.ownerCut }}% cut</span></div>
          <span class="chip" :style="statusStyle(r.status)" style="padding:3px 10px;">{{ r.status }}</span>
          <button class="chip" :disabled="busy" @click="run(() => api.archiveReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </template>

      <template v-if="redemptions.length">
        <div class="sub" style="margin-top:4px;">Redeemed by you</div>
        <div v-for="rd in redemptions" :key="rd.id" class="card row" style="justify-content:space-between;padding:11px 14px;">
          <span>{{ rd.name }}</span>
          <span class="chip" :style="statusStyle(rd.status)">{{ rd.status === 'requested' ? 'pending' : rd.status }}</span>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.reward-switch {
  display: flex; align-items: center; gap: 7px;
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: 'Quicksand', sans-serif; font-size: 18px; font-weight: 600; color: var(--ink);
}
.reward-menu {
  position: absolute; top: 32px; left: 0; z-index: 21;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 6px; min-width: 160px; box-shadow: 0 8px 22px rgba(74, 63, 53, 0.14);
}
.reward-menu button {
  display: flex; align-items: center; width: 100%; text-align: left;
  background: none; border: none; cursor: pointer; padding: 10px 12px;
  border-radius: 10px; font-family: inherit; font-size: 14px; color: var(--ink);
}
</style>
