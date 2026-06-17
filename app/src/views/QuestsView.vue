<script setup>
import { ref, onMounted } from 'vue';
import { api } from '../api';

const quests = ref([]);
const busy = ref(null);
const toast = ref('');

async function load() { quests.value = await api.quests(); }
onMounted(load);

const ICON = { minutes: 'ti-clock', sessions: 'ti-book', genres: 'ti-compass', mediums: 'ti-books', streak: 'ti-flame', manual: 'ti-wand' };
const UNIT = { minutes: 'min', sessions: 'sessions', genres: 'genres', mediums: 'formats', streak: 'days' };

async function claim(q) {
  busy.value = q.id; toast.value = '';
  try {
    const r = await api.claimQuest(q.id);
    toast.value = r.status === 'pending' ? 'Sent to an admin for approval' : `+${r.coins} coins!`;
    await load();
  } catch (e) {
    toast.value = e.message;
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="screen">
    <div class="h"><i class="ti ti-wand" style="color:var(--terra);" aria-hidden="true"></i> Quests</div>
    <p v-if="toast" class="sub" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <div v-for="q in quests" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:10px;"
      :style="(q.claimStatus === 'claimed' || q.claimStatus === 'approved') ? { opacity: .65 } : {}">
      <div class="row" style="gap:11px;align-items:flex-start;">
        <span class="av" style="width:36px;height:36px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
        <div style="flex:1;">
          <div style="font-weight:600;">{{ q.title }}</div>
          <div class="sub">{{ q.description }}</div>
        </div>
        <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
      </div>

      <div v-if="q.type !== 'manual'">
        <div class="bar"><span :style="{ width: Math.min(100, q.progress / q.target * 100) + '%', background: q.complete ? 'var(--terra)' : 'var(--sage)' }"></span></div>
        <div class="sub" style="margin-top:5px;">{{ q.progress }} / {{ q.target }} {{ UNIT[q.type] }}</div>
      </div>

      <button v-if="q.claimStatus === 'claimed' || q.claimStatus === 'approved'" class="chip" style="align-self:flex-start;background:var(--sage-bg);color:var(--sage-d);" disabled><i class="ti ti-check" aria-hidden="true"></i> claimed</button>
      <button v-else-if="q.claimStatus === 'pending'" class="chip" style="align-self:flex-start;" disabled><i class="ti ti-hourglass" aria-hidden="true"></i> waiting for approval</button>
      <button v-else-if="q.type === 'manual'" class="btn" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-flag" aria-hidden="true"></i> I did this<span v-if="q.requiresApproval"> · needs approval</span></button>
      <button v-else-if="q.complete" class="btn" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-coin" aria-hidden="true"></i> Claim +{{ q.rewardCoins }}</button>
      <button v-else class="chip" style="align-self:flex-start;" disabled>keep going…</button>
    </div>
  </div>
</template>
