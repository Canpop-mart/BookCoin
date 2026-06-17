<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { MEDIUMS, GENRES, fmtDuration } from '../data';

const router = useRouter();
const minutes = ref(store.draft?.minutes ?? 20);
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

const estCoins = computed(() => Math.max(1, Math.round((minutes.value / 60) * 20)));

function toggleGenre(g) {
  const i = genres.value.indexOf(g);
  if (i >= 0) genres.value.splice(i, 1);
  else genres.value.push(g);
}

async function save() {
  error.value = '';
  if (!summary.value.trim()) { error.value = 'Add a few words about what you read'; return; }
  if (!minutes.value || minutes.value < 1) { error.value = 'How long did you read?'; return; }
  saving.value = true;
  try {
    result.value = await api.logSession({
      title: title.value, author: author.value, medium: medium.value, genres: genres.value,
      minutes: minutes.value, pages: pages.value ? Number(pages.value) : null,
      summary: summary.value, quote: quote.value || null,
    });
    store.draft = null;
    setTimeout(() => router.replace('/'), 1900);
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

    <div class="card row" style="background:var(--sage-bg);border-color:transparent;gap:11px;">
      <i class="ti ti-clock" style="font-size:22px;color:var(--sage-d);" aria-hidden="true"></i>
      <div>
        <div style="font-size:19px;font-weight:700;color:var(--sage-d);font-family:'Quicksand';">{{ fmtDuration(minutes) }}</div>
        <div class="sub" style="color:var(--sage-d);">on the board</div>
      </div>
      <input v-model.number="minutes" type="number" min="1" aria-label="minutes"
        style="width:78px;margin-left:auto;text-align:center;" />
    </div>

    <input v-model="title" placeholder="title (optional)" />
    <input v-model="author" placeholder="author (optional)" />

    <div>
      <div class="sub" style="margin-bottom:7px;">format</div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="md in MEDIUMS" :key="md.id" class="chip" :class="{ on: medium === md.id }" @click="medium = md.id">{{ md.label }}</button>
      </div>
    </div>

    <div>
      <div class="sub" style="margin-bottom:7px;">genre <span v-if="genres.length" style="color:var(--gold-d);">· new genre = bonus coins</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:7px;">
        <button v-for="g in GENRES" :key="g" class="chip" :class="{ on: genres.includes(g) }" @click="toggleGenre(g)">{{ g }}</button>
      </div>
    </div>

    <div>
      <div class="sub" style="margin-bottom:7px;">a few words</div>
      <textarea v-model="summary" placeholder="what happened? what did you think?"></textarea>
    </div>

    <div class="row" style="gap:8px;align-items:stretch;">
      <input v-model="pages" type="number" min="0" placeholder="pages (optional)" />
      <input v-model="quote" placeholder="quote (optional)" />
    </div>

    <div class="card row" style="background:var(--gold-bg);border-color:transparent;justify-content:space-between;">
      <div class="sub" style="color:var(--gold-d);">+{{ estCoins }} coins · more for a new genre</div>
      <i class="ti ti-coin" style="color:var(--gold);font-size:22px;" aria-hidden="true"></i>
    </div>

    <p v-if="error" class="sub" style="color:var(--terra-d);">{{ error }}</p>
    <button class="btn" :disabled="saving" @click="save"><i class="ti ti-check" aria-hidden="true"></i> {{ saving ? 'Saving…' : 'Log it' }}</button>
  </div>

  <div v-else class="screen full" style="text-align:center;justify-content:center;align-items:center;gap:16px;">
    <Mascot :size="112" eyes="happy" />
    <div class="h" style="font-size:22px;">Nice reading!</div>
    <div class="card" style="background:var(--gold-bg);border-color:transparent;">
      <div style="font-size:34px;font-weight:700;color:var(--gold-d);font-family:'Quicksand';"><i class="ti ti-coin" aria-hidden="true"></i> +{{ result.coins }}</div>
      <div v-if="result.isNewGenre" class="sub" style="color:var(--gold-d);margin-top:4px;">
        new-genre bonus ×{{ result.multiplier }} <i class="ti ti-sparkles" aria-hidden="true"></i>
      </div>
    </div>
    <div class="sub">added to your coins</div>
  </div>
</template>
