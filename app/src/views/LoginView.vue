<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';

const router = useRouter();
const members = ref([]);
const selected = ref(null);
const pin = ref('');
const error = ref('');
const loading = ref(false);

onMounted(async () => {
  try { members.value = await api.members(); }
  catch { error.value = 'Cannot reach the server yet'; }
});

function pick(m) { selected.value = m; pin.value = ''; error.value = ''; }

async function submit() {
  if (!selected.value || loading.value) return;
  loading.value = true; error.value = '';
  try {
    const { token, member } = await api.login(selected.value.id, pin.value);
    store.setAuth(token, member);
    router.push('/');
  } catch {
    error.value = 'That PIN didn’t match';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="screen full" style="justify-content:center;align-items:center;text-align:center;gap:12px;">
    <MascotBird :size="96" />
    <h1 style="font-size:27px;">BookCoin</h1>
    <p class="sub" style="margin-top:-6px;">welcome to the family reading nook</p>

    <div v-if="!selected" style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;width:100%;margin-top:10px;">
      <button v-for="m in members" :key="m.id" class="card"
        style="cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:9px;"
        @click="pick(m)">
        <span class="av" style="width:42px;height:42px;font-size:15px;" :style="{ background: m.color }">{{ m.initials }}</span>
        <span style="font-weight:600;">{{ m.name }}</span>
      </button>
    </div>

    <div v-else class="card" style="width:100%;display:flex;flex-direction:column;gap:13px;align-items:center;">
      <span class="av" style="width:48px;height:48px;font-size:16px;" :style="{ background: selected.color }">{{ selected.initials }}</span>
      <div style="font-weight:600;">Hi {{ selected.name }}!</div>
      <input v-model="pin" type="password" inputmode="numeric" placeholder="Enter your PIN"
        style="text-align:center;letter-spacing:5px;" @keyup.enter="submit" />
      <button class="btn" :disabled="loading" @click="submit">{{ loading ? '…' : 'Open my nook' }}</button>
      <button class="chip" @click="selected = null"><i class="ti ti-arrow-left" aria-hidden="true"></i> someone else</button>
    </div>

    <p v-if="error" class="sub" style="color:var(--terra-d);">{{ error }}</p>
    <p class="sub" style="margin-top:10px;opacity:.65;">first time? the default PIN is 1234</p>
  </div>
</template>
