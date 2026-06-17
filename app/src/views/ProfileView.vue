<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { fmtDuration, MEDIUMS } from '../data';

const route = useRoute();
const router = useRouter();
const data = ref(null);
const id = computed(() => Number(route.params.id) || store.member.id);

async function load() { data.value = await api.profile(id.value); }
onMounted(load);
watch(() => route.params.id, load);

const isMe = computed(() => id.value === store.member.id);
const mediumLabel = (m) => MEDIUMS.find((x) => x.id === m)?.label || m;

async function logout() {
  try { await api.logout(); } catch {}
  store.logout();
  router.push('/login');
}
</script>

<template>
  <div class="screen" v-if="data">
    <div class="row" style="gap:13px;">
      <span class="av" style="width:54px;height:54px;font-size:19px;" :style="{ background: data.member.color }">{{ data.member.initials }}</span>
      <div>
        <div class="h" style="font-size:21px;">{{ data.member.name }}</div>
        <div class="sub"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ data.balance }} coins</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ fmtDuration(data.totals.minutes) }}</div>
        <div class="sub">read</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ data.totals.sessions }}</div>
        <div class="sub">sessions</div>
      </div>
      <div class="card" style="text-align:center;padding:14px 8px;">
        <div style="font-size:19px;font-weight:700;font-family:'Quicksand';">{{ data.totals.pages }}</div>
        <div class="sub">pages</div>
      </div>
    </div>

    <div v-if="data.byMedium.length" class="card">
      <div class="sub" style="margin-bottom:8px;">time by format</div>
      <div v-for="b in data.byMedium" :key="b.medium" class="row" style="justify-content:space-between;font-size:14px;padding:3px 0;">
        <span>{{ mediumLabel(b.medium) }}</span><span class="sub">{{ fmtDuration(b.minutes) }}</span>
      </div>
    </div>

    <div class="sub" style="margin-top:2px;">reading log</div>
    <div v-if="!data.recent.length" class="card sub">Nothing logged yet — get on the board!</div>
    <div v-for="s in data.recent" :key="s.id" class="card">
      <div class="row" style="justify-content:space-between;">
        <span style="font-weight:600;">{{ s.title || 'Untitled' }}</span>
        <span class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> +{{ s.coins }}</span>
      </div>
      <div class="sub" style="margin:2px 0 6px;">
        {{ fmtDuration(s.minutes) }} · {{ mediumLabel(s.medium) }}<span v-if="s.genres?.length"> · {{ s.genres.join(', ') }}</span>
      </div>
      <div v-if="s.summary" style="font-size:14px;line-height:1.5;">{{ s.summary }}</div>
      <div v-if="s.quote" class="sub" style="font-style:italic;margin-top:5px;">“{{ s.quote }}”</div>
    </div>

    <button v-if="isMe" class="btn soft" style="margin-top:8px;" @click="logout"><i class="ti ti-logout" aria-hidden="true"></i> Log out</button>
  </div>
</template>
