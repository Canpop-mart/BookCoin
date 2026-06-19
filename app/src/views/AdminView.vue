<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { usd } from '../data';

const router = useRouter();
const allowed = ref(true);
const tab = ref('approvals');
const toast = ref('');

const members = ref([]);
const quests = ref([]);
const rewards = ref([]);
const redemptions = ref([]);
const claims = ref([]);
const lists = ref([]);
const genres = ref([]);
const households = ref([]);

const COLORS = ['#E0785A', '#8FA97C', '#D99A2B', '#C58BA6', '#7BA6C4', '#B07CC6', '#6FB0A0', '#D98C6A'];
const mForm = reactive({ id: null, name: '', pin: '', role: 'member', goalHours: 15, color: '', householdId: null });
const hForm = reactive({ id: null, name: '', color: '#E0785A' });
const qForm = reactive({ id: null, title: '', description: '', type: 'minutes', target: 60, rewardCoins: 100, period: 'month', requiresApproval: false });
const rForm = reactive({ id: null, name: '', description: '', costCoins: 200, tier: 'low', stock: '', ownerCut: 0 });
const lForm = reactive({ id: null, name: '', description: '' });
const bookInput = reactive({});
const bookEdit = reactive({});
const gForm = reactive({ name: '' });

const QTYPES = [['minutes', 'Minutes read'], ['sessions', 'Sessions logged'], ['genres', 'Genres read'], ['mediums', 'Formats read'], ['streak', 'Day streak'], ['manual', 'Manual / bounty']];
const pendingRewards = computed(() => rewards.value.filter((r) => r.status === 'pending'));
const liveRewards = computed(() => rewards.value.filter((r) => r.status !== 'pending'));
const pendingCount = computed(() => claims.value.length + pendingRewards.value.length);
const TABS = [['approvals', 'Approvals'], ['members', 'Members'], ['households', 'Households'], ['quests', 'Quests'], ['rewards', 'Rewards'], ['lists', 'Lists'], ['genres', 'Genres']];

const householdName = (id) => households.value.find((h) => h.id === id)?.name || '';

async function load() {
  try {
    [members.value, quests.value, rewards.value, redemptions.value, claims.value, lists.value, genres.value, households.value] = await Promise.all([
      api.admin.members(), api.admin.quests(), api.admin.rewards(), api.admin.redemptions(), api.admin.claims(), api.lists(), api.admin.genres(), api.households(),
    ]);
    for (const l of lists.value) if (!bookInput[l.id]) bookInput[l.id] = { title: '', author: '' };
  } catch (e) {
    if (/admin/i.test(e.message)) allowed.value = false;
  }
}
onMounted(load);

async function act(fn) { try { await fn(); await load(); } catch (e) { toast.value = e.message; } }

async function createGenre() {
  if (!gForm.name.trim()) return;
  await act(() => api.admin.createGenre({ name: gForm.name.trim() }));
  toast.value = 'Genre added'; gForm.name = '';
}
function removeGenre(g) {
  if (!confirm(`Remove the "${g.name}" genre? Existing logs keep their tags.`)) return;
  act(() => api.admin.deleteGenre(g.id));
}

// --- households ---
function resetHousehold() { Object.assign(hForm, { id: null, name: '', color: '#E0785A' }); }
function editHousehold(h) { Object.assign(hForm, { id: h.id, name: h.name, color: h.color }); }
async function saveHousehold() {
  if (!hForm.name.trim()) { toast.value = 'Name is required'; return; }
  const body = { name: hForm.name.trim(), color: hForm.color };
  await act(() => hForm.id ? api.admin.updateHousehold(hForm.id, body) : api.admin.createHousehold(body));
  toast.value = hForm.id ? 'Household saved' : 'Household added';
  resetHousehold();
}
function removeHousehold(h) {
  if (!confirm(`Delete the "${h.name}" household?`)) return;
  act(() => api.admin.deleteHousehold(h.id));
}
const membersOf = (hid) => members.value.filter((m) => m.householdId === hid);

function resetMember() { Object.assign(mForm, { id: null, name: '', pin: '', role: 'member', goalHours: 15, color: '', householdId: households.value[0]?.id ?? null }); }
function editMember(m) {
  Object.assign(mForm, { id: m.id, name: m.name, pin: '', role: m.role, goalHours: Math.round(m.monthlyGoalMinutes / 60 * 2) / 2, color: m.color, householdId: m.householdId ?? null });
}
async function saveMember() {
  if (!mForm.name.trim()) { toast.value = 'Name is required'; return; }
  if (!mForm.id && !mForm.pin) { toast.value = 'Set a PIN'; return; }
  const wasSelf = mForm.id === store.member.id;
  const body = { name: mForm.name.trim(), role: mForm.role, monthlyGoalMinutes: Math.round(mForm.goalHours * 60), color: mForm.color || undefined, householdId: mForm.householdId ?? undefined };
  if (mForm.pin) body.pin = mForm.pin;
  try {
    if (mForm.id) await api.admin.updateMember(mForm.id, body);
    else await api.admin.createMember(body);
    toast.value = mForm.id ? 'Member saved' : 'Member added';
    resetMember();
    await load();
    if (wasSelf) { try { store.setMember((await api.me()).member); } catch {} }
  } catch (e) { toast.value = e.message; }
}
function removeMember(m) {
  if (!confirm(`Delete ${m.name}? This also removes their reading history and coins.`)) return;
  act(() => api.admin.deleteMember(m.id));
}

function resetQuest() { Object.assign(qForm, { id: null, title: '', description: '', type: 'minutes', target: 60, rewardCoins: 100, period: 'month', requiresApproval: false }); }
function editQuest(q) {
  Object.assign(qForm, { id: q.id, title: q.title, description: q.description || '', type: q.type, target: q.target, rewardCoins: q.reward_coins, period: q.period, requiresApproval: !!q.requires_approval });
}
async function saveQuest() {
  if (!qForm.title.trim()) { toast.value = 'Title required'; return; }
  const editing = qForm.id;
  await act(() => editing ? api.admin.updateQuest(editing, { ...qForm }) : api.admin.createQuest({ ...qForm }));
  toast.value = editing ? 'Quest saved' : 'Quest created'; resetQuest();
}

function resetReward() { Object.assign(rForm, { id: null, name: '', description: '', costCoins: 200, tier: 'low', stock: '', ownerCut: 0 }); }
function editReward(r) {
  Object.assign(rForm, { id: r.id, name: r.name, description: r.description || '', costCoins: r.costCoins, tier: r.tier, stock: r.stock ?? '', ownerCut: r.ownerCut });
}
async function saveReward() {
  if (!rForm.name.trim()) { toast.value = 'Name required'; return; }
  const editing = rForm.id;
  await act(() => editing ? api.admin.updateReward(editing, { ...rForm }) : api.createReward({ ...rForm }));
  toast.value = editing ? 'Reward saved' : 'Reward added'; resetReward();
}

function resetList() { Object.assign(lForm, { id: null, name: '', description: '' }); }
function editList(l) { Object.assign(lForm, { id: l.id, name: l.name, description: l.description || '' }); }
async function saveList() {
  if (!lForm.name.trim()) { toast.value = 'Name required'; return; }
  const editing = lForm.id;
  await act(() => editing ? api.admin.updateList(editing, { ...lForm }) : api.admin.createList({ ...lForm }));
  toast.value = editing ? 'List saved' : 'List created'; resetList();
}
function removeList(l) {
  if (!confirm(`Delete the "${l.name}" list and its books?`)) return;
  act(() => api.admin.deleteList(l.id));
}
function editBook(l, b) { bookInput[l.id] = { title: b.title, author: b.author || '' }; bookEdit[l.id] = b.id; }
function cancelBook(l) { bookInput[l.id] = { title: '', author: '' }; bookEdit[l.id] = null; }
async function addBook(l) {
  const bi = bookInput[l.id];
  if (!bi || !bi.title.trim()) return;
  const editing = bookEdit[l.id];
  await act(() => editing ? api.admin.updateBook(editing, { title: bi.title.trim(), author: bi.author }) : api.admin.addBook(l.id, { title: bi.title.trim(), author: bi.author }));
  bi.title = ''; bi.author = ''; bookEdit[l.id] = null;
}
</script>

<template>
  <div class="screen full">
    <div class="row" style="justify-content:space-between;">
      <div class="h"><i class="ti ti-settings" style="color:var(--terra);" aria-hidden="true"></i> Admin</div>
      <button class="chip" @click="router.push('/')"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>

    <div v-if="!allowed" class="card sub">Admins only.</div>

    <template v-else>
      <div class="row" style="gap:6px;flex-wrap:wrap;">
        <button v-for="t in TABS" :key="t[0]" class="chip" :class="{ on: tab === t[0] }" @click="tab = t[0]">
          {{ t[1] }}<span v-if="t[0] === 'approvals' && pendingCount"> ({{ pendingCount }})</span>
        </button>
      </div>
      <p v-if="toast" class="sub" style="color:var(--sage-d);">{{ toast }}</p>

      <!-- APPROVALS -->
      <template v-if="tab === 'approvals'">
        <div v-if="!pendingCount" class="card sub">Nothing pending.</div>
        <div v-for="c in claims" :key="'c' + c.id" class="card row" style="gap:10px;">
          <Avatar :avatar="c.avatar" :color="c.color" :initials="c.initials" :size="30" />
          <div style="flex:1;"><div style="font-weight:600;">{{ c.member }}</div><div class="sub">challenge: {{ c.title }} · +{{ c.rewardCoins }}</div></div>
          <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.approveClaim(c.id))"><i class="ti ti-check" aria-hidden="true"></i></button>
          <button class="chip" @click="act(() => api.admin.rejectClaim(c.id))"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
        <div v-for="r in pendingRewards" :key="'pr' + r.id" class="card row" style="gap:10px;">
          <span class="av" style="width:30px;height:30px;background:#EFE0F0;color:#6E5E94;"><i class="ti ti-gift" aria-hidden="true"></i></span>
          <div style="flex:1;"><div style="font-weight:600;">{{ r.name }}</div><div class="sub">offer by {{ r.ownerName }} · {{ r.costCoins }} coins · {{ r.ownerCut }}% cut</div></div>
          <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.admin.approveReward(r.id))"><i class="ti ti-check" aria-hidden="true"></i></button>
          <button class="chip" @click="act(() => api.admin.denyReward(r.id))"><i class="ti ti-x" aria-hidden="true"></i></button>
        </div>
      </template>

      <!-- MEMBERS -->
      <template v-if="tab === 'members'">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div v-for="m in members" :key="m.id" class="card row" style="padding:10px 13px;gap:10px;">
            <Avatar :member="m" :size="30" />
            <div style="flex:1;min-width:0;">
              <div><span style="font-weight:600;">{{ m.name }}</span>
              <span v-if="m.role === 'admin'" class="chip" style="padding:2px 9px;margin-left:6px;background:var(--gold-bg);color:var(--gold-d);">admin</span></div>
              <div class="sub" v-if="householdName(m.householdId)"><i class="ti ti-home" aria-hidden="true"></i> {{ householdName(m.householdId) }}</div>
            </div>
            <button class="chip" aria-label="edit" @click="editMember(m)"><i class="ti ti-edit" aria-hidden="true"></i></button>
            <button class="chip" aria-label="delete" @click="removeMember(m)"><i class="ti ti-trash" aria-hidden="true"></i></button>
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">{{ mForm.id ? 'Edit member' : 'Add member' }}</div>
          <input v-model="mForm.name" placeholder="Name" />
          <input v-model="mForm.pin" :placeholder="mForm.id ? 'New PIN (blank = keep)' : 'PIN'" inputmode="numeric" autocomplete="off" />
          <div class="row" style="gap:8px;">
            <select v-model="mForm.role" style="flex:1;"><option value="member">Member</option><option value="admin">Admin</option></select>
            <input v-model.number="mForm.goalHours" type="number" min="0.5" step="0.5" style="width:108px;" placeholder="Goal (h)" />
          </div>
          <label class="sub">Household
            <select v-model.number="mForm.householdId">
              <option v-for="h in households" :key="h.id" :value="h.id">{{ h.name }}</option>
            </select>
          </label>
          <div class="row" style="gap:8px;flex-wrap:wrap;">
            <button v-for="c in COLORS" :key="c" aria-label="colour" @click="mForm.color = c"
              :style="{ background: c, width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', padding: 0, border: mForm.color === c ? '2px solid var(--ink)' : '2px solid transparent' }"></button>
          </div>
          <button class="btn" @click="saveMember"><i class="ti ti-check" aria-hidden="true"></i> {{ mForm.id ? 'Save member' : 'Add member' }}</button>
          <button v-if="mForm.id" class="chip" @click="resetMember">Cancel</button>
        </div>
      </template>

      <!-- HOUSEHOLDS -->
      <template v-if="tab === 'households'">
        <p class="sub">Households just tidy the sign-in screen — everyone shares one leaderboard, and you choose who each reward is for. Handy once you've got a few families; skip it if everyone's one group.</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div v-for="h in households" :key="h.id" class="card" style="display:flex;flex-direction:column;gap:9px;">
            <div class="row" style="gap:10px;">
              <span class="av" :style="{ background: h.color, width: '30px', height: '30px' }"><i class="ti ti-home" aria-hidden="true"></i></span>
              <div style="flex:1;min-width:0;">
                <span style="font-weight:600;">{{ h.name }}</span>
                <span class="sub" style="margin-left:6px;">{{ h.memberCount }} member{{ h.memberCount === 1 ? '' : 's' }}</span>
              </div>
              <button class="chip" aria-label="edit" @click="editHousehold(h)"><i class="ti ti-edit" aria-hidden="true"></i></button>
              <button class="chip" aria-label="delete" @click="removeHousehold(h)"><i class="ti ti-trash" aria-hidden="true"></i></button>
            </div>
            <div v-if="membersOf(h.id).length" class="row" style="gap:6px;flex-wrap:wrap;">
              <span v-for="m in membersOf(h.id)" :key="m.id" class="chip" style="padding:3px 9px;gap:6px;">
                <Avatar :member="m" :size="18" /> {{ m.name }}
              </span>
            </div>
          </div>
        </div>
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">{{ hForm.id ? 'Edit household' : 'Add household' }}</div>
          <input v-model="hForm.name" placeholder="Household name (e.g. The Riveras)" />
          <div class="row" style="gap:8px;flex-wrap:wrap;">
            <button v-for="c in COLORS" :key="c" aria-label="colour" @click="hForm.color = c"
              :style="{ background: c, width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', padding: 0, border: hForm.color === c ? '2px solid var(--ink)' : '2px solid transparent' }"></button>
          </div>
          <button class="btn" @click="saveHousehold"><i class="ti ti-check" aria-hidden="true"></i> {{ hForm.id ? 'Save household' : 'Add household' }}</button>
          <button v-if="hForm.id" class="chip" @click="resetHousehold">Cancel</button>
        </div>
      </template>

      <!-- QUESTS -->
      <template v-if="tab === 'quests'">
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">{{ qForm.id ? 'Edit quest or challenge' : 'Create quest or challenge' }}</div>
          <input v-model="qForm.title" placeholder="Title" />
          <input v-model="qForm.description" placeholder="Description" />
          <div class="row" style="gap:8px;">
            <select v-model="qForm.type" style="flex:1;"><option v-for="t in QTYPES" :key="t[0]" :value="t[0]">{{ t[1] }}</option></select>
            <select v-model="qForm.period" style="width:120px;"><option value="month">Monthly</option><option value="once">One-time</option></select>
          </div>
          <div class="row" style="gap:8px;">
            <input v-model.number="qForm.target" type="number" min="1" placeholder="Target" />
            <input v-model.number="qForm.rewardCoins" type="number" min="0" placeholder="Reward coins" />
          </div>
          <label v-if="qForm.type === 'manual'" class="sub row" style="gap:8px;"><input type="checkbox" v-model="qForm.requiresApproval" style="width:auto;" /> Requires approval</label>
          <button class="btn" @click="saveQuest"><i :class="qForm.id ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i> {{ qForm.id ? 'Save quest' : 'Create' }}</button>
          <button v-if="qForm.id" class="chip" @click="resetQuest">Cancel</button>
        </div>
        <div v-for="q in quests" :key="q.id" class="card row" style="padding:10px 13px;gap:8px;" :style="q.active ? {} : { opacity: .5 }">
          <div style="flex:1;"><span style="font-weight:600;">{{ q.title }}</span> <span class="sub">{{ q.type === 'manual' ? 'challenge' : q.type }} · +{{ q.reward_coins }}</span></div>
          <template v-if="q.active">
            <button class="chip" aria-label="edit" @click="editQuest(q)"><i class="ti ti-edit" aria-hidden="true"></i></button>
            <button class="chip" aria-label="retire" @click="act(() => api.admin.deleteQuest(q.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
          </template>
          <span v-else class="sub">retired</span>
        </div>
      </template>

      <!-- REWARDS -->
      <template v-if="tab === 'rewards'">
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">{{ rForm.id ? 'Edit reward' : 'Create reward (house — goes live immediately)' }}</div>
          <input v-model="rForm.name" placeholder="Name" />
          <input v-model="rForm.description" placeholder="Description" />
          <div class="row" style="gap:8px;">
            <input v-model.number="rForm.costCoins" type="number" min="0" placeholder="Cost" />
            <select v-model="rForm.tier" style="flex:1;"><option value="low">Low</option><option value="mid">Mid</option><option value="high">High</option></select>
          </div>
          <input v-model="rForm.stock" type="number" min="0" placeholder="Stock (blank = unlimited)" />
          <div class="sub" style="margin-top:-2px;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ rForm.costCoins || 0 }} coins ≈ <strong style="color:var(--ink);">{{ usd(rForm.costCoins) }}</strong> <span style="opacity:.7;">(100 coins = $1)</span></div>
          <button class="btn" @click="saveReward"><i :class="rForm.id ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i> {{ rForm.id ? 'Save reward' : 'Create reward' }}</button>
          <button v-if="rForm.id" class="chip" @click="resetReward">Cancel</button>
        </div>

        <div v-for="r in liveRewards" :key="r.id" class="card row" style="padding:10px 13px;gap:8px;">
          <div style="flex:1;"><span style="font-weight:600;">{{ r.name }}</span> <span class="sub">{{ r.costCoins }} (≈{{ usd(r.costCoins) }}) · {{ r.ownerCut }}% · {{ r.ownerName }}</span></div>
          <button class="chip" aria-label="edit" @click="editReward(r)"><i class="ti ti-edit" aria-hidden="true"></i></button>
          <button class="chip" aria-label="archive" @click="act(() => api.admin.deleteReward(r.id))"><i class="ti ti-trash" aria-hidden="true"></i></button>
        </div>

        <template v-if="redemptions.length">
          <div class="sub" style="margin-top:6px;">Pending deliveries (oversight)</div>
          <div v-for="rd in redemptions" :key="'rd' + rd.id" class="card row" style="gap:10px;">
            <Avatar :member="rd" :size="30" />
            <div style="flex:1;"><div style="font-weight:600;">{{ rd.name }}</div><div class="sub">{{ rd.member }} → owner {{ rd.owner }}</div></div>
            <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" @click="act(() => api.fulfillRedemption(rd.id))"><i class="ti ti-check" aria-hidden="true"></i></button>
            <button class="chip" @click="act(() => api.cancelRedemption(rd.id))">refund</button>
          </div>
        </template>
      </template>

      <!-- LISTS -->
      <template v-if="tab === 'lists'">
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">{{ lForm.id ? 'Edit reading list' : 'Create reading list' }}</div>
          <input v-model="lForm.name" placeholder="List name (e.g. Classics)" />
          <input v-model="lForm.description" placeholder="Description (optional)" />
          <button class="btn" @click="saveList"><i :class="lForm.id ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i> {{ lForm.id ? 'Save list' : 'Create list' }}</button>
          <button v-if="lForm.id" class="chip" @click="resetList">Cancel</button>
        </div>
        <div v-for="l in lists" :key="l.id" class="card" style="display:flex;flex-direction:column;gap:10px;">
          <div class="row" style="justify-content:space-between;gap:8px;">
            <div style="flex:1;min-width:0;"><span style="font-weight:600;">{{ l.name }}</span> <span class="sub">{{ l.books.length }} book{{ l.books.length === 1 ? '' : 's' }}</span></div>
            <button class="chip" aria-label="edit list" @click="editList(l)"><i class="ti ti-edit" aria-hidden="true"></i></button>
            <button class="chip" aria-label="delete list" @click="removeList(l)"><i class="ti ti-trash" aria-hidden="true"></i></button>
          </div>
          <div v-for="b in l.books" :key="b.id" class="row" style="gap:8px;font-size:14px;">
            <span style="flex:1;"><span style="font-weight:600;">{{ b.title }}</span><span v-if="b.author" class="sub"> · {{ b.author }}</span></span>
            <button class="chip" style="padding:4px 9px;" aria-label="edit book" @click="editBook(l, b)"><i class="ti ti-edit" aria-hidden="true"></i></button>
            <button class="chip" style="padding:4px 9px;" aria-label="remove book" @click="act(() => api.admin.deleteBook(b.id))"><i class="ti ti-x" aria-hidden="true"></i></button>
          </div>
          <div v-if="bookInput[l.id]" class="row" style="gap:8px;">
            <input v-model="bookInput[l.id].title" :placeholder="bookEdit[l.id] ? 'Edit title' : 'Book title'" style="flex:1;" />
            <input v-model="bookInput[l.id].author" placeholder="Author" style="width:110px;" />
            <button class="chip" style="background:var(--sage-bg);color:var(--sage-d);" :aria-label="bookEdit[l.id] ? 'save book' : 'add book'" @click="addBook(l)"><i :class="bookEdit[l.id] ? 'ti ti-check' : 'ti ti-plus'" aria-hidden="true"></i></button>
            <button v-if="bookEdit[l.id]" class="chip" aria-label="cancel" @click="cancelBook(l)"><i class="ti ti-x" aria-hidden="true"></i></button>
          </div>
        </div>
      </template>

      <!-- GENRES -->
      <template v-if="tab === 'genres'">
        <div class="card" style="display:flex;flex-direction:column;gap:9px;">
          <div class="sub">Add a genre</div>
          <div class="row" style="gap:8px;">
            <input v-model="gForm.name" placeholder="Genre name (e.g. Drama)" style="flex:1;" @keyup.enter="createGenre" />
            <button class="btn" style="width:auto;padding:13px 16px;" @click="createGenre"><i class="ti ti-plus" aria-hidden="true"></i> Add</button>
          </div>
          <div class="sub" style="font-size:12px;">Genres members can tag when logging. Removing one leaves existing logs untouched.</div>
        </div>
        <div class="card" style="display:flex;flex-wrap:wrap;gap:8px;">
          <span v-for="g in genres" :key="g.id" class="chip" style="gap:7px;">
            {{ g.name }}
            <button aria-label="remove genre" @click="removeGenre(g)" style="background:none;border:none;cursor:pointer;color:var(--ink2);padding:0;display:flex;"><i class="ti ti-x" aria-hidden="true"></i></button>
          </span>
          <div v-if="!genres.length" class="sub">No genres yet.</div>
        </div>
      </template>
    </template>
  </div>
</template>
