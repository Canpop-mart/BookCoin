<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';

const router = useRouter();
const lists = ref([]);
const loading = ref(true);
const open = ref({});
const busy = ref(null);
const added = ref({});

const showCreate = ref(false);
const cForm = ref({ name: '', description: '', visibility: 'public' });
const addingTo = ref(null);              // id of the list we're adding a book to
const bookForm = ref({ title: '', author: '', cover: '' });

async function load() {
  try { lists.value = await api.lists(); } finally { loading.value = false; }
}
onMounted(load);

const myLists = computed(() => lists.value.filter((l) => l.mine));
const browseLists = computed(() => lists.value.filter((l) => !l.mine));

function toggle(id) { open.value[id] = !open.value[id]; }

async function addToWant(b) {
  if (added.value[b.id] || busy.value === b.id) return;
  busy.value = b.id;
  try { await api.addBook({ title: b.title, author: b.author, status: 'want' }); added.value[b.id] = true; }
  catch { /* a duplicate or hiccup shouldn't nag */ } finally { busy.value = null; }
}

async function createList() {
  if (!cForm.value.name.trim()) return;
  busy.value = 'create';
  try {
    const r = await api.createList({ name: cForm.value.name.trim(), description: cForm.value.description.trim(), visibility: cForm.value.visibility });
    cForm.value = { name: '', description: '', visibility: 'public' };
    showCreate.value = false;
    await load();
    open.value[r.id] = true; // drop them straight into the new list to add books
    addingTo.value = r.id;
  } finally { busy.value = null; }
}

async function toggleVisibility(l) {
  busy.value = l.id;
  try { await api.updateList(l.id, { visibility: l.visibility === 'public' ? 'private' : 'public' }); await load(); }
  finally { busy.value = null; }
}

async function deleteList(l) {
  if (!confirm(`Delete “${l.name}”? This can't be undone.`)) return;
  busy.value = l.id;
  try { await api.deleteList(l.id); open.value[l.id] = false; await load(); }
  finally { busy.value = null; }
}

function startAddBook(l) { addingTo.value = l.id; bookForm.value = { title: '', author: '', cover: '' }; }
function fillBookForm(b) { bookForm.value = { title: b.title, author: b.author || '', cover: b.cover || '' }; }
async function addBook(l) {
  if (!bookForm.value.title.trim()) return;
  busy.value = 'addbook';
  try {
    await api.addListBook(l.id, { title: bookForm.value.title.trim(), author: bookForm.value.author.trim(), cover: bookForm.value.cover });
    bookForm.value = { title: '', author: '', cover: '' };
    await load();
  } finally { busy.value = null; }
}
async function removeBook(l, b) {
  busy.value = b.id;
  try { await api.removeListBook(l.id, b.id); await load(); }
  finally { busy.value = null; }
}
</script>

<template>
  <div class="screen">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-books" style="color:var(--terra);" aria-hidden="true"></i> Library</div>
      <button class="chip" aria-label="Close" @click="router.push('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>
    <div class="row" style="gap:7px;">
      <button class="chip" style="flex:1;justify-content:center;" @click="router.push('/shelf')"><i class="ti ti-books" aria-hidden="true"></i> My shelf</button>
      <button class="chip on" style="flex:1;justify-content:center;"><i class="ti ti-list-search" aria-hidden="true"></i> Reading lists</button>
    </div>

    <button v-if="!showCreate" class="chip" style="align-self:flex-start;" @click="showCreate = true"><i class="ti ti-plus" aria-hidden="true"></i> New list</button>

    <div v-if="showCreate" class="card pop-in" style="display:flex;flex-direction:column;gap:9px;">
      <input v-model="cForm.name" placeholder="List name (e.g. Summer reads)" />
      <input v-model="cForm.description" placeholder="Description (optional)" />
      <div class="row" style="gap:8px;">
        <button type="button" class="chip" :class="{ on: cForm.visibility === 'public' }" style="flex:1;justify-content:center;" @click="cForm.visibility = 'public'"><i class="ti ti-world" aria-hidden="true"></i> Public</button>
        <button type="button" class="chip" :class="{ on: cForm.visibility === 'private' }" style="flex:1;justify-content:center;" @click="cForm.visibility = 'private'"><i class="ti ti-lock" aria-hidden="true"></i> Private</button>
      </div>
      <div class="row" style="gap:8px;">
        <button class="btn" :disabled="busy === 'create' || !cForm.name.trim()" @click="createList"><i class="ti ti-check" aria-hidden="true"></i> Create list</button>
        <button class="chip" @click="showCreate = false">Cancel</button>
      </div>
    </div>

    <div v-if="loading" class="card sub">Loading…</div>

    <!-- YOUR LISTS -->
    <template v-if="myLists.length">
      <div class="sub"><i class="ti ti-user" aria-hidden="true"></i> Your lists</div>
      <div class="stagger" style="display:flex;flex-direction:column;gap:10px;">
        <div v-for="l in myLists" :key="l.id" class="card" style="padding:0;overflow:hidden;">
          <button @click="toggle(l.id)" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;cursor:pointer;padding:13px 15px;text-align:left;font-family:inherit;">
            <span class="av" style="width:40px;height:40px;background:var(--sage-bg);color:var(--sage-d);flex-shrink:0;"><i class="ti ti-books" style="font-size:20px;" aria-hidden="true"></i></span>
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;color:var(--ink);">{{ l.name }}</div>
              <div class="sub">{{ l.books.length }} book{{ l.books.length === 1 ? '' : 's' }} · <i :class="l.visibility === 'public' ? 'ti ti-world' : 'ti ti-lock'" aria-hidden="true"></i> {{ l.visibility === 'public' ? 'Public' : 'Private' }}</div>
            </div>
            <i class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;" :style="{ transform: open[l.id] ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
          </button>
          <div v-if="open[l.id]" style="padding:12px 15px 14px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);">
            <div v-if="l.description" class="sub" style="margin-top:-2px;">{{ l.description }}</div>
            <div v-for="b in l.books" :key="b.id" class="row" style="gap:10px;">
              <img v-if="b.cover" :src="b.cover" alt="" loading="lazy" style="width:24px;height:33px;object-fit:cover;border-radius:2px 4px 4px 2px;box-shadow:0 1px 3px rgba(0,0,0,.2);flex-shrink:0;" @error="b.cover = ''" />
              <i v-else class="ti ti-book" style="color:var(--terra);font-size:16px;flex-shrink:0;" aria-hidden="true"></i>
              <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;">{{ b.title }}</div><div class="sub" v-if="b.author">{{ b.author }}</div></div>
              <button class="chip" aria-label="remove book" :disabled="busy === b.id" style="padding:5px 9px;flex-shrink:0;" @click="removeBook(l, b)"><i class="ti ti-x" aria-hidden="true"></i></button>
            </div>
            <div v-if="addingTo === l.id" style="display:flex;flex-direction:column;gap:8px;">
              <BookFinder @pick="fillBookForm" />
              <div class="row" style="gap:6px;">
                <input v-model="bookForm.title" placeholder="Title" style="flex:1;min-width:0;" @keyup.enter="addBook(l)" />
                <input v-model="bookForm.author" placeholder="Author" style="max-width:34%;" @keyup.enter="addBook(l)" />
                <button class="chip" aria-label="add" :disabled="busy === 'addbook' || !bookForm.title.trim()" style="background:var(--sage-bg);color:var(--sage-d);flex-shrink:0;" @click="addBook(l)"><i class="ti ti-check" aria-hidden="true"></i></button>
              </div>
            </div>
            <button v-else class="chip" style="align-self:flex-start;" @click="startAddBook(l)"><i class="ti ti-plus" aria-hidden="true"></i> Add a book</button>
            <div class="row" style="gap:8px;border-top:1px solid var(--line);padding-top:10px;">
              <button class="chip" :disabled="busy === l.id" @click="toggleVisibility(l)"><i :class="l.visibility === 'public' ? 'ti ti-lock' : 'ti ti-world'" aria-hidden="true"></i> Make {{ l.visibility === 'public' ? 'private' : 'public' }}</button>
              <button class="chip" style="color:var(--terra-d);margin-left:auto;" :disabled="busy === l.id" @click="deleteList(l)"><i class="ti ti-trash" aria-hidden="true"></i> Delete</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- BROWSE: curated + everyone's public lists -->
    <div class="sub" style="margin-top:4px;"><i class="ti ti-compass" aria-hidden="true"></i> Browse</div>
    <div v-if="!loading && !browseLists.length" class="card sub">No public lists to browse yet. Make one above and set it public.</div>
    <div class="stagger" style="display:flex;flex-direction:column;gap:10px;">
      <div v-for="l in browseLists" :key="l.id" class="card" style="padding:0;overflow:hidden;">
        <button @click="toggle(l.id)" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;cursor:pointer;padding:13px 15px;text-align:left;font-family:inherit;">
          <span class="av" style="width:40px;height:40px;background:#EFE0F0;color:#6E5E94;flex-shrink:0;"><i class="ti ti-books" style="font-size:20px;" aria-hidden="true"></i></span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;color:var(--ink);">{{ l.name }}</div>
            <div class="sub">{{ l.books.length }} book{{ l.books.length === 1 ? '' : 's' }}<span v-if="!l.curated"> · by {{ l.ownerName }}</span></div>
          </div>
          <i class="ti ti-chevron-down" style="color:var(--ink2);transition:transform .2s ease;" :style="{ transform: open[l.id] ? 'rotate(180deg)' : 'none' }" aria-hidden="true"></i>
        </button>
        <div v-if="open[l.id]" style="padding:12px 15px 14px;display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);">
          <div v-if="l.description" class="sub" style="margin-top:-2px;">{{ l.description }}</div>
          <div v-for="b in l.books" :key="b.id" class="row" style="gap:10px;">
            <i class="ti ti-book" style="color:var(--terra);font-size:16px;flex-shrink:0;" aria-hidden="true"></i>
            <div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;">{{ b.title }}</div><div class="sub" v-if="b.author">{{ b.author }}</div></div>
            <button class="chip" :disabled="busy === b.id" style="padding:5px 9px;flex-shrink:0;"
              :style="added[b.id] ? { background: 'var(--sage-bg)', color: 'var(--sage-d)' } : {}"
              :aria-label="added[b.id] ? 'on your want-to-read shelf' : 'add to want to read'"
              :title="added[b.id] ? 'On your want-to-read shelf' : 'Add to want to read'" @click="addToWant(b)">
              <i :class="added[b.id] ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i>
            </button>
          </div>
          <div v-if="!l.books.length" class="sub">No books in this list yet.</div>
        </div>
      </div>
    </div>
  </div>
</template>
