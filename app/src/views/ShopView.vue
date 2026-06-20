<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api';
import { store } from '../store';
import { usd } from '../data';

const data = ref(null);
const redemptions = ref([]);
const offers = ref({ mine: [], toFulfill: [] });
const busy = ref(false);
const toast = ref('');
const burst = ref(false);
const view = ref('store');
const menuOpen = ref(false);
const showOffer = ref(false);
const members = ref([]);
const form = reactive({ editingId: null, name: '', description: '', costCoins: 50, scope: 'everyone', audience: [] });

const toDeliver = computed(() => offers.value.toFulfill.length);
const VIEWS = { store: 'Store', offers: 'My offers', receipts: 'Purchases' };
const viewLabel = computed(() => VIEWS[view.value]);
function setView(v) { view.value = v; menuOpen.value = false; }
// people you can offer a reward to — everyone except yourself
const otherMembers = computed(() => members.value.filter((m) => m.id !== store.member.id));
const memberName = (id) => members.value.find((m) => m.id === id)?.name || '';
function toggleAudience(id) {
  const i = form.audience.indexOf(id);
  if (i === -1) form.audience.push(id); else form.audience.splice(i, 1);
}
function resetForm() { Object.assign(form, { editingId: null, name: '', description: '', costCoins: 50, scope: 'everyone', audience: [] }); }
function openOffer() { resetForm(); showOffer.value = true; }
function editOffer(r) {
  Object.assign(form, { editingId: r.id, name: r.name, description: r.description || '', costCoins: r.costCoins, scope: r.scope, audience: [...(r.audienceIds || [])] });
  showOffer.value = true;
}
function closeOffer() { showOffer.value = false; resetForm(); }

async function load() {
  [data.value, redemptions.value, offers.value, members.value] = await Promise.all([api.rewards(), api.myRedemptions(), api.myOffers(), api.members()]);
  store.setDeliveries(offers.value.toFulfill.length); // drives the nav badge
}
onMounted(load);

const tier = {
  low: { bg: 'var(--sage-bg)', fg: 'var(--sage-d)' },
  mid: { bg: 'var(--gold-bg)', fg: 'var(--gold-d)' },
  high: { bg: 'var(--blush-bg)', fg: 'var(--blush-d)' },
};
// icon colour is derived from price (no manual tier choice)
const tierFor = (cost) => (cost >= 900 ? 'high' : cost >= 300 ? 'mid' : 'low');
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
  if (form.scope === 'people' && !form.audience.length) { toast.value = 'Pick who it\'s for, or choose Everyone'; return; }
  const payload = { name: form.name, description: form.description, costCoins: form.costCoins, scope: form.scope, audience: form.audience };
  const isAdmin = store.member.role === 'admin';
  const msg = form.editingId
    ? (isAdmin ? 'Reward updated' : 'Saved — sent to an admin for re-approval')
    : (isAdmin ? 'Reward added' : 'Sent to an admin for approval');
  const action = form.editingId ? () => api.editReward(form.editingId, payload) : () => api.createReward(payload);
  run(action, msg).then(() => { showOffer.value = false; resetForm(); });
}
</script>

<template>
  <div class="screen" v-if="data">
    <CoinBurst v-if="burst" />
    <div class="row" style="justify-content:space-between;">
      <div style="position:relative;">
        <button class="reward-switch" @click="menuOpen = !menuOpen">
          <i class="ti ti-gift" style="color:var(--terra);" aria-hidden="true"></i>
          {{ viewLabel }}
          <i class="ti ti-chevron-down" style="font-size:15px;color:var(--ink2);" aria-hidden="true"></i>
          <span v-if="view !== 'offers' && toDeliver" class="badge-dot">{{ toDeliver }}</span>
        </button>
        <template v-if="menuOpen">
          <div @click="menuOpen = false" style="position:fixed;inset:0;z-index:20;"></div>
          <div class="reward-menu">
            <button @click="setView('store')" :style="view === 'store' ? { background: 'var(--cream)', fontWeight: 600 } : {}">Store</button>
            <button @click="setView('offers')" :style="view === 'offers' ? { background: 'var(--cream)', fontWeight: 600 } : {}">
              My offers<span v-if="toDeliver" style="margin-left:auto;color:var(--terra-d);font-weight:700;">{{ toDeliver }}</span>
            </button>
            <button @click="setView('receipts')" :style="view === 'receipts' ? { background: 'var(--cream)', fontWeight: 600 } : {}">Purchases</button>
          </div>
        </template>
      </div>
      <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> <CoinCount :value="data.balance" /></span>
    </div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <!-- offer / edit reward form — shows on any tab when open -->
    <div v-if="showOffer" class="card" style="display:flex;flex-direction:column;gap:9px;">
      <div class="row" style="justify-content:space-between;">
        <span style="font-weight:600;font-size:14px;">{{ form.editingId ? 'Edit reward' : 'Offer a reward' }}</span>
        <button class="chip" aria-label="Close" @click="closeOffer"><i class="ti ti-x" aria-hidden="true"></i></button>
      </div>
      <input v-model="form.name" placeholder="What are you offering? (e.g. a drawing)" />
      <input v-model="form.description" placeholder="Description (optional)" />
      <label class="sub">Price <input v-model.number="form.costCoins" type="number" min="0" /></label>
      <div>
        <div class="sub" style="margin-bottom:6px;">Who's this for?</div>
        <div class="row" style="gap:8px;">
          <button type="button" class="chip" :class="{ on: form.scope === 'everyone' }" style="flex:1;justify-content:center;" @click="form.scope = 'everyone'"><i class="ti ti-users" aria-hidden="true"></i> Everyone</button>
          <button type="button" class="chip" :class="{ on: form.scope === 'people' }" style="flex:1;justify-content:center;" @click="form.scope = 'people'"><i class="ti ti-user-check" aria-hidden="true"></i> Specific people</button>
        </div>
        <div v-if="form.scope === 'people'" class="row" style="gap:7px;flex-wrap:wrap;margin-top:8px;">
          <button v-for="m in otherMembers" :key="m.id" type="button" class="chip" :class="{ on: form.audience.includes(m.id) }" style="gap:6px;" @click="toggleAudience(m.id)">
            <Avatar :member="m" :size="18" /> {{ m.name }}
          </button>
        </div>
      </div>
      <div class="sub">{{ form.costCoins || 0 }} coins ≈ <strong style="color:var(--ink);">{{ usd(form.costCoins) }}</strong>. When someone buys it you keep <strong style="color:var(--ink);">{{ Math.ceil((form.costCoins || 0) * 0.2) }}</strong> (20%); the rest is spent.</div>
      <p v-if="form.editingId && store.member.role !== 'admin'" class="sub" style="color:var(--terra-d);"><i class="ti ti-info-circle" aria-hidden="true"></i> Editing sends it back to an admin for re-approval.</p>
      <button class="btn" :disabled="busy" @click="submitOffer"><i class="ti ti-check" aria-hidden="true"></i> {{ form.editingId ? 'Save changes' : (store.member.role === 'admin' ? 'Add reward' : 'Submit for approval') }}</button>
    </div>

    <!-- ============ STORE ============ -->
    <template v-if="view === 'store'">
      <button v-if="!showOffer" class="chip" style="align-self:flex-start;" @click="openOffer"><i class="ti ti-plus" aria-hidden="true"></i> Offer a reward</button>

      <div v-if="!data.rewards.length" class="card sub">No rewards yet — offer one above!</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="r in data.rewards" :key="r.id" class="card" style="display:flex;gap:13px;align-items:center;">
          <div style="width:48px;height:48px;border-radius:14px;flex-shrink:0;display:flex;align-items:center;justify-content:center;"
            :style="{ background: tier[tierFor(r.costCoins)].bg, color: tier[tierFor(r.costCoins)].fg }">
            <i class="ti ti-gift" style="font-size:24px;" aria-hidden="true"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">{{ r.name }}</div>
            <div class="sub" v-if="r.description">{{ r.description }}</div>
            <div class="row" style="gap:6px;margin-top:4px;flex-wrap:wrap;">
              <Avatar :avatar="r.ownerAvatar" :color="r.ownerColor" :initials="r.ownerInitials" :size="18" />
              <span class="sub">from {{ r.ownerName }}<span v-if="r.stock != null"> · {{ r.stock }} left</span></span>
              <span v-if="r.scope === 'people'" class="chip" style="padding:1px 8px;font-size:11px;background:var(--blush-bg);color:var(--blush-d);"><i class="ti ti-user-check" aria-hidden="true"></i> just for you</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">
            <div style="font-weight:700;font-family:'Quicksand';color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ r.costCoins }}</div>
            <button v-if="r.ownerId !== store.member.id" class="btn" style="width:auto;padding:8px 18px;font-size:14px;"
              :disabled="busy || data.balance < r.costCoins || (r.stock != null && r.stock <= 0)" @click="redeem(r)"><i class="ti ti-shopping-bag" aria-hidden="true"></i> Buy</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ============ MY OFFERS ============ -->
    <template v-else-if="view === 'offers'">
      <div v-if="!offers.toFulfill.length && !offers.mine.length" class="card sub">
        You haven't offered any rewards yet — head to the Store to add one.
      </div>

      <template v-if="offers.toFulfill.length">
        <div class="sub"><i class="ti ti-bell" style="color:var(--terra);" aria-hidden="true"></i> Someone bought yours — deliver it</div>
        <div v-for="rd in offers.toFulfill" :key="rd.id" class="card row" style="gap:10px;background:#FFF7F3;border-color:#F2D2C5;">
          <Avatar :member="rd" :size="30" />
          <div style="flex:1;"><div style="font-weight:600;">{{ rd.name }}</div><div class="sub">for {{ rd.member }} · you earn {{ Math.ceil(rd.costCoins * 0.2) }}</div></div>
          <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" :disabled="busy" @click="run(() => api.fulfillRedemption(rd.id), 'Delivered!')"><i class="ti ti-check" aria-hidden="true"></i> Given</button>
          <button class="chip" :disabled="busy" @click="run(() => api.cancelRedemption(rd.id), 'Cancelled & refunded')"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
      </template>

      <template v-if="offers.mine.length">
        <div class="sub" style="margin-top:4px;">Listed by you</div>
        <div v-for="r in offers.mine" :key="r.id" class="card row" style="padding:11px 14px;gap:8px;">
          <div style="flex:1;min-width:0;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.costCoins }} · keep {{ Math.ceil(r.costCoins * 0.2) }} · {{ r.scope === 'people' ? 'for ' + (r.audienceIds || []).map(memberName).filter(Boolean).join(', ') : 'everyone' }}</span></div>
          <span class="chip" :style="statusStyle(r.status)" style="padding:3px 10px;">{{ r.status }}</span>
          <button class="chip" aria-label="edit" :disabled="busy" @click="editOffer(r)"><i class="ti ti-edit" aria-hidden="true"></i></button>
          <button class="chip" aria-label="remove" :disabled="busy" @click="run(() => api.archiveReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>
      </template>
    </template>

    <!-- ============ RECEIPTS ============ -->
    <template v-else>
      <div v-if="!redemptions.length" class="card sub">Nothing bought yet — redeem a reward from the Store.</div>
      <div v-for="rd in redemptions" :key="rd.id" class="card row" style="justify-content:space-between;padding:11px 14px;">
        <span>{{ rd.name }}</span>
        <span class="chip" :style="statusStyle(rd.status)">{{ rd.status === 'requested' ? 'pending' : rd.status }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.reward-switch {
  display: flex; align-items: center; gap: 7px; position: relative;
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: 'Quicksand', sans-serif; font-size: 18px; font-weight: 600; color: var(--ink);
}
.reward-menu {
  position: absolute; top: 32px; left: 0; z-index: 21;
  background: var(--card); border: 1px solid var(--line); border-radius: 14px;
  padding: 6px; min-width: 170px; box-shadow: 0 8px 22px rgba(74, 63, 53, 0.14);
}
.reward-menu button {
  display: flex; align-items: center; width: 100%; text-align: left;
  background: none; border: none; cursor: pointer; padding: 10px 12px;
  border-radius: 10px; font-family: inherit; font-size: 14px; color: var(--ink);
}
.badge-dot {
  position: absolute; top: -5px; right: -5px;
  min-width: 17px; height: 17px; padding: 0 4px;
  background: var(--terra); color: #fff;
  border-radius: 999px; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
</style>
