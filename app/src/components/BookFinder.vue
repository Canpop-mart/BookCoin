<script setup>
// Find a book by name or by the barcode on its back, and hand the details
// (title, author, cover, ISBN) to whatever form is using this.
//
// Lookups go through our own server, which holds the Hardcover token. If the
// server has no token this renders nothing at all and the form it sits in
// carries on as a plain set of text fields.
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { api } from '../api';
import { cameraAvailable, startScanner } from '../scanner';

const emit = defineEmits(['pick']);

// Asked once per session, not once per form.
let enabledCache = null;
const enabled = ref(false);

const q = ref('');
const results = ref([]);
const searched = ref(false);
const loading = ref(false);
const error = ref('');

const scanning = ref(false);
const scanNote = ref('');
const video = ref(null);
let stopScan = null;
let debounce = null;

onMounted(async () => {
  if (enabledCache === null) {
    enabledCache = await api.lookupStatus().then((r) => !!r.enabled).catch(() => false);
  }
  enabled.value = enabledCache;
});
onUnmounted(() => { clearTimeout(debounce); stopScan?.(); });

watch(q, (v) => {
  clearTimeout(debounce);
  error.value = '';
  if (v.trim().length < 2) { results.value = []; searched.value = false; return; }
  debounce = setTimeout(search, 400);
});

async function search() {
  const term = q.value.trim();
  if (term.length < 2) return;
  loading.value = true;
  error.value = '';
  try {
    results.value = (await api.lookupSearch(term)).results || [];
    searched.value = true;
  } catch (e) {
    error.value = e.message || 'Search failed';
    results.value = [];
  } finally { loading.value = false; }
}

function choose(b) {
  emit('pick', { title: b.title, author: b.author || '', cover: b.cover || '', isbn: b.isbn || '', blurb: b.blurb || '' });
  q.value = ''; results.value = []; searched.value = false;
}

async function openScanner() {
  scanning.value = true;
  scanNote.value = '';
  await nextTick();
  try {
    stopScan = await startScanner(video.value, onCode, (msg) => { scanNote.value = msg; });
  } catch {
    scanNote.value = 'No camera access. Check the permission and try again.';
  }
}

function closeScanner() {
  stopScan?.();
  stopScan = null;
  scanning.value = false;
}

async function onCode(isbn) {
  scanNote.value = 'Looking it up…';
  try {
    const { result } = await api.lookupIsbn(isbn);
    if (result) { closeScanner(); choose(result); return; }
    scanNote.value = `No match for ${isbn}. Try searching by name.`;
  } catch (e) {
    scanNote.value = e.message || 'Lookup failed';
  }
  stopScan = null;
  scanning.value = false;
}
</script>

<template>
  <div v-if="enabled" style="display:flex;flex-direction:column;gap:8px;">
    <div class="row" style="gap:7px;position:relative;">
      <i class="ti ti-search" style="position:absolute;left:13px;color:var(--ink2);font-size:16px;" aria-hidden="true"></i>
      <input v-model="q" placeholder="Find a book by name" aria-label="Find a book by name"
             style="flex:1;padding-left:36px;" @keyup.enter="search" />
      <button v-if="cameraAvailable()" class="chip" style="flex-shrink:0;" @click="openScanner">
        <i class="ti ti-scan" aria-hidden="true"></i> Scan
      </button>
      <InfoBubble text="Search by name, or scan the barcode on the back of a book to fill in its details and cover." />
    </div>

    <div v-if="loading" class="sub" style="padding-left:2px;">Searching…</div>
    <div v-else-if="error" class="sub" style="color:var(--terra);padding-left:2px;">{{ error }}</div>
    <div v-else-if="searched && !results.length" class="sub" style="padding-left:2px;">
      Nothing found. Type the details in below instead.
    </div>

    <div v-if="results.length" class="results">
      <button v-for="(b, i) in results" :key="i" class="hit" @click="choose(b)">
        <img v-if="b.cover" :src="b.cover" alt="" loading="lazy" class="hit-cover" @error="b.cover = ''" />
        <span v-else class="hit-cover hit-blank"><i class="ti ti-book" aria-hidden="true"></i></span>
        <span style="flex:1;min-width:0;text-align:left;">
          <span class="hit-title">{{ b.title }}</span>
          <span class="sub" style="display:block;">{{ [b.author, b.year].filter(Boolean).join(' · ') }}</span>
        </span>
        <i class="ti ti-plus" style="color:var(--sage-d);flex-shrink:0;" aria-hidden="true"></i>
      </button>
    </div>

    <teleport to="body">
      <div v-if="scanning" class="scan-layer">
        <video ref="video" class="scan-video" muted playsinline></video>
        <div class="scan-frame"></div>
        <div class="scan-bar">
          <span>{{ scanNote || 'Point the camera at the barcode' }}</span>
          <button class="btn soft" @click="closeScanner"><i class="ti ti-x" aria-hidden="true"></i> Cancel</button>
        </div>
      </div>
    </teleport>
  </div>
</template>

<style scoped>
.results { display: flex; flex-direction: column; gap: 6px; max-height: 292px; overflow-y: auto; }
.hit {
  display: flex; align-items: center; gap: 11px;
  background: var(--card); border: 1px solid var(--line); border-radius: 13px;
  padding: 7px 11px 7px 8px; cursor: pointer; font: inherit; color: inherit; text-align: left;
}
.hit:hover { border-color: var(--sage); background: var(--sage-bg); }
.hit-cover {
  width: 34px; height: 48px; flex-shrink: 0; object-fit: cover;
  border-radius: 3px 5px 5px 3px; box-shadow: 0 1px 3px rgba(0, 0, 0, .22);
}
.hit-blank {
  display: flex; align-items: center; justify-content: center;
  background: #EAE0D2; color: #8A7660;
}
.hit-title {
  display: block; font-weight: 600; font-size: 14px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.scan-layer { position: fixed; inset: 0; z-index: 90; background: #000; }
.scan-video { width: 100%; height: 100%; object-fit: cover; }
.scan-frame {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  width: min(74vw, 320px); height: 128px;
  border: 2px solid rgba(255, 255, 255, .9); border-radius: 12px;
  box-shadow: 0 0 0 2000px rgba(0, 0, 0, .45);
}
.scan-bar {
  position: absolute; left: 0; right: 0; bottom: 0;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  padding: 18px 18px calc(24px + env(safe-area-inset-bottom));
  color: #fff; font-family: 'Nunito', sans-serif; font-size: 14px; text-align: center;
}
.scan-bar .btn { max-width: 220px; }
</style>
