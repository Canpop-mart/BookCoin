<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { MEDIUMS, GENRES, fmtDuration } from '../data';

const router = useRouter();
const draftSec = store.draft?.seconds ?? (store.draft?.minutes != null ? store.draft.minutes * 60 : 1200);
const hours = ref(Math.floor(draftSec / 3600));
const mins = ref(Math.floor((draftSec % 3600) / 60));
const secs = ref(draftSec % 60);
const title = ref(store.draft?.title ?? '');
const author = ref('');
const medium = ref('prose');
const genres = ref([]);
const summary = ref('');
const pages = ref('');
const quote = ref('');
const saving = ref(false);
const error = ref('');
const result = ref(null);
const genreList = ref(GENRES); // fallback; replaced by the admin-managed list below

onMounted(async () => {
  try { const g = await api.genres(); if (Array.isArray(g) && g.length) genreList.value = g; } catch {}
});

const rawSeconds = computed(() => (hours.value || 0) * 3600 + (mins.value || 0) * 60 + (secs.value || 0));
const totalMinutes = computed(() => Math.max(1, Math.round(rawSeconds.value / 60)));

function toggleGenre(g) {
  const i = genres.value.indexOf(g);
  if (i >= 0) genres.value.splice(i, 1);
  else genres.value.push(g);
}

async function save() {
  error.value = '';
  if (!summary.value.trim()) { error.value = 'Add a note about what you read'; return; }
  if (rawSeconds.value < 1) { error.value = 'How long did you read?'; return; }
  saving.value = true;
  try {
    result.value = await api.logSession({
      title: title.value, author: author.value, medium: medium.value, genres: genres.value,
      minutes: totalMinutes.value, pages: pages.value ? Number(pages.value) : null,
      summary: summary.value, quote: quote.value || null,
    });
    store.draft = null;
  } catch (e) {
    error.value = 'Could not save — ' + e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="screen full" v-if="!result">
    <div class="row" style="justify-content:space-between;">
      <span class="h">What did you read?</span>
      <button class="chip" @click="router.replace('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div class="card" style="background:var(--sage-bg);border-color:transparent;">
      <div class="row" style="gap:9px;">
        <i class="ti ti-clock" style="font-size:20px;color:var(--sage-d);" aria-hidden="true"></i>
        <span class="sub" style="color:var(--sage-d);font-weight:600;">Time read</span>
        <span class="sub" style="color:var(--sage-d);margin-left:auto;">{{ fmtDuration(totalMinutes) }}</span>
      </div>
      <div class="row" style="gap:8px;margin-top:10px;">
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="hours" type="number" min="0" max="24" aria-label="hours" style="text-align:center;" />
          <div style="margin-top:4px;">hours</div>
        </label>
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="mins" type="number" min="0" max="59" aria-label="minutes" style="text-align:center;" />
          <div style="margin-top:4px;">minutes</div>
        </label>
        <label class="sub" style="flex:1;text-align:center;color:var(--sage-d);">
          <input v-model.number="secs" type="number" min="0" max="59" aria-label="seconds" style="text-align:center;" />
          <div style="margin-top:4px;">seconds</div>
        </label>
      </div>
    </div>

    <input v-model="title" placeholder="Title (optional)" />
    <input v-model="author" placeholder="Author (optional)" />

    <div>
      <div class="sub" style="margin-bottom:7px;">Format</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="md in MEDIUMS" :key="md.id" class="chip" :class="{ on: medium === md.id }" @click="medium = md.id">{{ md.label }}</button>
      </div>
    </div>

    <div>
      <div class="sub" style="margin-bottom:7px;">Genre <span v-if="genres.length" style="color:var(--gold-d);">· new genres earn a bonus</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="g in genreList" :key="g" class="chip" :class="{ on: genres.includes(g) }" @click="toggleGenre(g)">{{ g }}</button>
      </div>
    </div>

    <div>
      <div class="sub" style="margin-bottom:7px;">Notes</div>
      <textarea v-model="summary" placeholder="What happened? What did you think?"></textarea>
    </div>

    <div class="row" style="gap:8px;align-items:stretch;">
      <input v-model="pages" type="number" min="0" placeholder="Pages (optional)" />
      <input v-model="quote" placeholder="Quote (optional)" />
    </div>

    <p v-if="error" class="sub" style="color:var(--terra-d);">{{ error }}</p>
    <button class="btn" :disabled="saving" @click="save"><i class="ti ti-check" aria-hidden="true"></i> {{ saving ? 'Saving…' : 'Save session' }}</button>
  </div>

  <div v-else class="screen full" style="text-align:center;justify-content:center;align-items:center;gap:15px;">
    <CoinBurst />
    <Mascot :size="104" eyes="happy" mood="cheer" :variant="store.member?.mascot || 'wizard'" />
    <div class="h" style="font-size:22px;">Session logged!</div>
    <div class="card" style="width:100%;display:flex;flex-direction:column;gap:9px;text-align:left;">
      <div class="row" style="justify-content:space-between;">
        <span class="sub"><i class="ti ti-clock" aria-hidden="true"></i> Read {{ fmtDuration(result.minutes) }}</span>
        <span style="font-weight:600;color:var(--gold-d);">+{{ result.base }}</span>
      </div>
      <div v-if="result.isNewGenre" class="row" style="justify-content:space-between;">
        <span class="sub"><i class="ti ti-sparkles" style="color:var(--gold);" aria-hidden="true"></i> New-genre bonus ×{{ result.multiplier }}</span>
        <span style="font-weight:600;color:var(--gold-d);">+{{ result.coins - result.base }}</span>
      </div>
      <div style="height:1px;background:var(--line);margin:1px 0;"></div>
      <div class="row" style="justify-content:space-between;align-items:center;">
        <span style="font-weight:700;">Total earned</span>
        <span style="font-size:24px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> +{{ result.coins }}</span>
      </div>
    </div>
    <div class="sub">New balance · {{ result.balance }} coins</div>
    <button class="btn" style="margin-top:2px;" @click="router.replace('/')"><i class="ti ti-check" aria-hidden="true"></i> Done</button>
  </div>
</template>
