<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const lists = ref([]);
const loading = ref(true);
const open = ref({});

onMounted(async () => {
  try { lists.value = await api.lists(); } finally { loading.value = false; }
});
function toggle(id) { open.value[id] = !open.value[id]; }
</script>

<template>
  <div class="screen">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-books" style="color:var(--terra);" aria-hidden="true"></i> Reading lists</div>
      <button class="chip" @click="router.push('/quests')"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
    </div>
    <p class="sub" style="margin-top:-4px;">Curated picks to inspire your next read — tap a list to open it.</p>

    <div v-if="!loading && !lists.length" class="card sub">No reading lists yet.</div>

    <div class="stagger" style="display:flex;flex-direction:column;gap:10px;">
      <div v-for="l in lists" :key="l.id" class="card" style="padding:0;overflow:hidden;">
        <button @click="toggle(l.id)"
          style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;cursor:pointer;padding:13px 15px;text-align:left;font-family:inherit;">
          <span class="av" style="width:40px;height:40px;background:#EFE0F0;color:#6E5E94;flex-shrink:0;"><i class="ti ti-books" style="font-size:20px;" aria-hidden="true"></i></span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--ink);">{{ l.name }}</div>
            <div class="sub">{{ l.books.length }} book{{ l.books.length === 1 ? '' : 's' }}</div>
          </div>
          <i class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;" :style="{ transform: open[l.id] ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
        </button>
        <div v-if="open[l.id]" style="padding:12px 15px 14px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);">
          <div v-if="l.description" class="sub" style="margin-top:-2px;">{{ l.description }}</div>
          <div v-for="b in l.books" :key="b.id" class="row" style="gap:10px;">
            <i class="ti ti-book" style="color:var(--terra);font-size:16px;flex-shrink:0;" aria-hidden="true"></i>
            <div style="min-width:0;"><div style="font-weight:600;font-size:14px;">{{ b.title }}</div><div class="sub" v-if="b.author">{{ b.author }}</div></div>
          </div>
          <div v-if="!l.books.length" class="sub">No books in this list yet.</div>
        </div>
      </div>
    </div>
  </div>
</template>
