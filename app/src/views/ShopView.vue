<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';

const data = ref(null);
const redemptions = ref([]);
const busy = ref(null);
const toast = ref('');
const burst = ref(false);

async function load() {
  [data.value, redemptions.value] = await Promise.all([api.rewards(), api.myRedemptions()]);
}
onMounted(load);

const tier = {
  low: { bg: 'var(--sage-bg)', fg: 'var(--sage-d)' },
  mid: { bg: 'var(--gold-bg)', fg: 'var(--gold-d)' },
  high: { bg: 'var(--blush-bg)', fg: 'var(--blush-d)' },
};

async function redeem(r) {
  if (data.value.balance < r.costCoins) return;
  busy.value = r.id; toast.value = '';
  try {
    await api.redeemReward(r.id);
    toast.value = `${r.name} reserved — an admin will hand it over`;
    burst.value = true;
    setTimeout(() => { burst.value = false; }, 1300);
    await load();
  } catch (e) {
    toast.value = e.message;
  } finally {
    busy.value = null;
  }
}

const statusStyle = (s) => s === 'fulfilled'
  ? { background: 'var(--sage-bg)', color: 'var(--sage-d)' }
  : s === 'cancelled'
    ? { background: 'var(--chip)', color: 'var(--chip-ink)' }
    : { background: 'var(--gold-bg)', color: 'var(--gold-d)' };
</script>

<template>
  <div class="screen" v-if="data">
    <CoinBurst v-if="burst" />
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-gift" style="color:var(--terra);" aria-hidden="true"></i> Reward shop</div>
      <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> <CoinCount :value="data.balance" /></span>
    </div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
      <div v-for="r in data.rewards" :key="r.id" class="card row" style="gap:12px;">
        <div style="flex:1;">
          <div class="row" style="gap:8px;">
            <span style="font-weight:600;">{{ r.name }}</span>
            <span class="chip" :style="{ background: tier[r.tier].bg, color: tier[r.tier].fg, padding: '3px 10px' }">{{ r.tier }}</span>
          </div>
          <div class="sub">{{ r.description }}</div>
          <div v-if="r.stock != null" class="sub" style="margin-top:2px;">{{ r.stock }} left</div>
        </div>
        <button class="btn" style="width:auto;padding:11px 15px;"
          :disabled="busy === r.id || data.balance < r.costCoins || (r.stock != null && r.stock <= 0)"
          @click="redeem(r)">
          <i class="ti ti-coin" aria-hidden="true"></i> {{ r.costCoins }}
        </button>
      </div>
    </div>

    <template v-if="redemptions.length">
      <div class="sub" style="margin-top:6px;">your rewards</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:7px;">
        <div v-for="rd in redemptions" :key="rd.id" class="card row" style="justify-content:space-between;padding:11px 14px;">
          <span>{{ rd.name }}</span>
          <span class="chip" :style="statusStyle(rd.status)">{{ rd.status === 'requested' ? 'pending' : rd.status }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
