<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const quests = ref([]);
const busy = ref(null);
const toast = ref('');
const burst = ref(false);

async function load() { quests.value = await api.quests(); }
onMounted(load);

const ICON = { minutes: 'ti-clock', sessions: 'ti-book', genres: 'ti-compass', mediums: 'ti-books', streak: 'ti-flame', manual: 'ti-wand' };

const open = (q) => !['claimed', 'approved', 'pending'].includes(q.claimStatus);
const ready = computed(() => quests.value.filter((q) => open(q) && q.type !== 'manual' && q.complete));
const challenges = computed(() => quests.value.filter((q) => open(q) && q.type === 'manual'));
const inProgress = computed(() => quests.value.filter((q) => open(q) && q.type !== 'manual' && !q.complete && q.progress > 0));
const notStarted = computed(() => quests.value.filter((q) => open(q) && q.type !== 'manual' && q.progress === 0));
const done = computed(() => quests.value.filter((q) => !open(q)));

async function claim(q) {
  busy.value = q.id; toast.value = '';
  try {
    const r = await api.claimQuest(q.id);
    if (r.status === 'pending') {
      toast.value = 'Submitted for approval';
    } else {
      toast.value = `+${r.coins} coins!`;
      burst.value = true;
      setTimeout(() => { burst.value = false; }, 1300);
    }
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
    <CoinBurst v-if="burst" />
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-wand" style="color:var(--terra);" aria-hidden="true"></i> Quests</div>
      <button class="chip" @click="router.push('/lists')"><i class="ti ti-books" aria-hidden="true"></i> Reading lists</button>
    </div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <template v-if="ready.length">
      <div class="sub">Ready to claim</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="q in ready" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:11px;background:#FFF7F3;border-color:#F2D2C5;">
          <div class="row" style="gap:11px;align-items:flex-start;">
            <span class="av" style="width:38px;height:38px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
            <div style="flex:1;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">{{ q.description }}</div></div>
            <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
          </div>
          <button class="btn" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-coin" aria-hidden="true"></i> Claim +{{ q.rewardCoins }}</button>
        </div>
      </div>
    </template>

    <template v-if="challenges.length">
      <div class="sub" style="margin-top:4px;">Challenges</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="q in challenges" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:11px;">
          <div class="row" style="gap:11px;align-items:flex-start;">
            <span class="av" style="width:38px;height:38px;background:#EFE0F0;color:#6E5E94;"><i class="ti ti-wand" aria-hidden="true"></i></span>
            <div style="flex:1;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">{{ q.description }}</div></div>
            <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
          </div>
          <button class="btn" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-flag" aria-hidden="true"></i> Mark complete<span v-if="q.requiresApproval"> · needs approval</span></button>
        </div>
      </div>
    </template>

    <template v-if="inProgress.length">
      <div class="sub" style="margin-top:4px;">In progress</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
        <div v-for="q in inProgress" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:9px;padding:13px 15px;">
          <div class="row" style="gap:10px;">
            <span class="av" style="width:30px;height:30px;font-size:13px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
            <span style="font-weight:600;flex:1;">{{ q.title }}</span>
            <span class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
          </div>
          <div class="row" style="gap:11px;">
            <div class="bar" style="flex:1;"><span :style="{ width: Math.min(100, q.progress / q.target * 100) + '%' }"></span></div>
            <span class="sub" style="white-space:nowrap;">{{ q.progress }} / {{ q.target }}</span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="notStarted.length">
      <div class="sub" style="margin-top:4px;">Not started</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
        <div v-for="q in notStarted" :key="q.id" class="card row" style="gap:11px;padding:13px 15px;">
          <span class="av" style="width:30px;height:30px;font-size:13px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
          <div style="flex:1;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">{{ q.description }}</div></div>
          <span class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
        </div>
      </div>
    </template>

    <template v-if="done.length">
      <div class="sub" style="margin-top:4px;">Completed</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:7px;">
        <div v-for="q in done" :key="q.id" class="card row" style="padding:10px 14px;opacity:.72;">
          <span style="flex:1;font-weight:600;">{{ q.title }}</span>
          <span v-if="q.claimStatus === 'pending'" class="chip" style="padding:4px 10px;"><i class="ti ti-hourglass" aria-hidden="true"></i> Pending</span>
          <span v-else class="chip" style="padding:4px 10px;background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i> +{{ q.rewardCoins }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
