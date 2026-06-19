<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';

const router = useRouter();
const members = ref([]);
const households = ref([]);
const household = ref(null);   // chosen household (step 1)
const selected = ref(null);    // chosen member (step 2)
const pin = ref('');
const error = ref('');
const loading = ref(false);
const showServer = ref(false);
const serverInput = ref(store.serverUrl);

// members grouped under their household (only households that have members)
const grouped = computed(() => {
  const byId = {};
  for (const h of households.value) byId[h.id] = { household: h, members: [] };
  const orphans = [];
  for (const m of members.value) (byId[m.householdId] || { members: orphans }).members.push(m);
  const groups = households.value.map((h) => byId[h.id]).filter((g) => g.members.length);
  if (orphans.length) groups.push({ household: { id: 0, name: 'Everyone', color: '#B8A88F' }, members: orphans });
  return groups;
});
const multiHousehold = computed(() => grouped.value.length > 1);
const householdMembers = computed(() => grouped.value.find((g) => g.household.id === household.value?.id)?.members || []);

onMounted(loadMembers);

async function loadMembers() {
  try {
    const [mem, hh] = await Promise.all([api.members(), api.households().catch(() => [])]);
    members.value = mem;
    households.value = hh;
    // one household → skip the picker and go straight to its members
    household.value = grouped.value.length === 1 ? grouped.value[0].household : null;
    showServer.value = false;
  } catch {
    error.value = "Can't reach the server";
    showServer.value = true;
  }
}

function pickHousehold(h) { household.value = h; selected.value = null; error.value = ''; }
function backToHouseholds() { household.value = null; selected.value = null; }

function connect() {
  store.serverUrl = serverInput.value.trim().replace(/\/+$/, '');
  store.save();
  error.value = '';
  loadMembers();
}

function pick(m) { selected.value = m; pin.value = ''; error.value = ''; }

async function submit() {
  if (!selected.value || loading.value) return;
  loading.value = true; error.value = '';
  try {
    const { token, member } = await api.login(selected.value.id, pin.value);
    store.setAuth(token, member);
    router.push('/');
  } catch {
    error.value = 'Incorrect PIN';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="screen full" style="justify-content:center;align-items:center;text-align:center;gap:12px;">
    <Mascot :size="96" />
    <h1 style="font-size:27px;">BookCoin</h1>
    <p class="sub" style="margin-top:-6px;">Turn reading into rewards</p>

    <div v-if="showServer" class="card" style="width:100%;display:flex;flex-direction:column;gap:11px;">
      <div style="font-weight:600;">Connect to your server</div>
      <input v-model="serverInput" placeholder="https://your-nas:8787" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <button class="btn" @click="connect"><i class="ti ti-plug" aria-hidden="true"></i> Connect</button>
    </div>

    <!-- step 1: pick a household (skipped when there's only one) -->
    <div v-else-if="!household" style="width:100%;display:flex;flex-direction:column;gap:10px;margin-top:10px;">
      <div class="sub" style="margin-bottom:2px;">Choose your household</div>
      <button v-for="g in grouped" :key="g.household.id" class="card row"
        style="cursor:pointer;gap:12px;text-align:left;width:100%;" @click="pickHousehold(g.household)">
        <span class="av" :style="{ background: g.household.color, width: '38px', height: '38px' }"><i class="ti ti-home" style="font-size:18px;" aria-hidden="true"></i></span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;">{{ g.household.name }}</div>
          <div class="sub">{{ g.members.length }} {{ g.members.length === 1 ? 'member' : 'members' }}</div>
        </div>
        <i class="ti ti-chevron-right" style="color:var(--ink2);" aria-hidden="true"></i>
      </button>
    </div>

    <!-- step 2: pick a member within the household -->
    <div v-else-if="!selected" style="width:100%;display:flex;flex-direction:column;gap:12px;margin-top:10px;">
      <button v-if="multiHousehold" class="chip" style="align-self:center;" @click="backToHouseholds">
        <span class="av" :style="{ background: household.color, width: '18px', height: '18px' }"><i class="ti ti-home" style="font-size:10px;" aria-hidden="true"></i></span>
        {{ household.name }} <i class="ti ti-chevron-down" style="font-size:14px;" aria-hidden="true"></i>
      </button>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        <button v-for="m in householdMembers" :key="m.id" class="card"
          style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:9px;"
          @click="pick(m)">
          <Avatar :member="m" :size="42" />
          <span style="font-weight:600;">{{ m.name }}</span>
        </button>
      </div>
    </div>

    <div v-else class="card" style="width:100%;display:flex;flex-direction:column;gap:13px;align-items:center;">
      <Avatar :member="selected" :size="48" />
      <div style="font-weight:600;">Hi {{ selected.name }}!</div>
      <input v-model="pin" type="password" inputmode="numeric" placeholder="Enter your PIN"
        style="text-align:center;letter-spacing:5px;" @keyup.enter="submit" />
      <button class="btn" :disabled="loading" @click="submit">{{ loading ? '…' : 'Continue' }}</button>
      <button class="chip" @click="selected = null"><i class="ti ti-arrow-left" aria-hidden="true"></i> Back</button>
    </div>

    <p v-if="error" class="sub" style="color:var(--terra-d);">{{ error }}</p>
    <p v-if="!showServer && !selected" class="sub" style="margin-top:10px;opacity:.65;">First time? The default PIN is 1234.</p>
    <button class="chip" style="margin-top:4px;opacity:.8;" @click="showServer = !showServer; serverInput = store.serverUrl">
      <i class="ti ti-settings" aria-hidden="true"></i> Server settings
    </button>
  </div>
</template>
