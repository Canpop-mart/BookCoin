<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const lists = ref([]);
const loading = ref(true);

onMounted(async () => {
  try { lists.value = await api.lists(); } finally { loading.value = false; }
});
</script>

<template>
  <div class="screen">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-books" style="color:var(--terra);" aria-hidden="true"></i> Reading lists</div>
      <button class="chip" @click="router.push('/quests')"><i class="ti ti-arrow-left" aria-hidden="true"></i></button>
    </div>
    <p class="sub">Curated picks to inspire your next read.</p>

    <div v-if="!loading && !lists.length" class="card sub">No reading lists yet.</div>

    <div v-for="l in lists" :key="l.id" class="stagger card" style="display:flex;flex-direction:column;gap:11px;">
      <div>
        <div style="font-weight:600;font-size:16px;">{{ l.name }}</div>
        <div class="sub" v-if="l.description">{{ l.description }}</div>
      </div>
      <div v-for="b in l.books" :key="b.id" class="row" style="gap:11px;">
        <span class="av" style="width:30px;height:30px;background:#EFE0F0;color:#6E5E94;"><i class="ti ti-book" aria-hidden="true"></i></span>
        <div style="flex:1;">
          <div style="font-weight:600;font-size:14px;">{{ b.title }}</div>
          <div class="sub" v-if="b.author">{{ b.author }}</div>
        </div>
      </div>
      <div v-if="!l.books.length" class="sub">No books in this list yet.</div>
    </div>
  </div>
</template>
