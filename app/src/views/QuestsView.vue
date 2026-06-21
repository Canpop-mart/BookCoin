<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api';
import { store } from '../store';
import { claimableQuests } from '../data';

const router = useRouter();
const quests = ref([]);
const members = ref([]);
const busy = ref(null);
const toast = ref('');
const burst = ref(false);
const view = ref('quests');

async function load() {
  [quests.value, members.value] = await Promise.all([api.quests(), api.members()]);
  store.setQuestsReady(claimableQuests(quests.value)); // keep the nav badge fresh
}
onMounted(load);

const ICON = { minutes: 'ti-clock', sessions: 'ti-book', genres: 'ti-compass', mediums: 'ti-books', streak: 'ti-flame' };
const open = (q) => !['claimed', 'approved', 'pending'].includes(q.claimStatus);

const regular = computed(() => quests.value.filter((q) => q.kind !== 'bounty'));
const auto = computed(() => regular.value.filter((q) => q.type !== 'manual'));
const manual = computed(() => regular.value.filter((q) => q.type === 'manual'));

// --- bounties ---
const bounties = computed(() => quests.value.filter((q) => q.kind === 'bounty'));
const myBounties = computed(() => bounties.value.filter((q) => q.mine));
const forMe = computed(() => bounties.value.filter((q) => !q.mine));
const EFFORTS = [['light', 'Light', 100], ['standard', 'Standard', 200], ['epic', 'Epic', 350]];
const measurable = (q) => ['minutes', 'sessions', 'genres'].includes(q.type); // legacy bounties only
const showBounty = ref(false);
const otherMembers = computed(() => members.value.filter((m) => m.id !== store.member.id));
const bForm = reactive({ title: '', description: '', effort: 'standard', scope: 'everyone', audience: [] });
const bPrice = computed(() => (EFFORTS.find((e) => e[0] === bForm.effort) || EFFORTS[1])[2]);
function toggleAud(id) { const i = bForm.audience.indexOf(id); if (i === -1) bForm.audience.push(id); else bForm.audience.splice(i, 1); }
async function submitBounty() {
  if (!bForm.title.trim()) { toast.value = 'Give it a title'; return; }
  if (bForm.scope === 'people' && !bForm.audience.length) { toast.value = 'Pick who it\'s for, or choose Everyone'; return; }
  busy.value = 'bounty'; toast.value = '';
  try {
    await api.createBounty({ title: bForm.title.trim(), description: bForm.description.trim(), effort: bForm.effort, audience: bForm.scope === 'people' ? bForm.audience : [] });
    Object.assign(bForm, { title: '', description: '', effort: 'standard', scope: 'everyone', audience: [] });
    showBounty.value = false; toast.value = 'Bounty posted!'; await load();
  } catch (e) { toast.value = e.message; } finally { busy.value = null; }
}
async function cancelBounty(q) {
  if (!confirm(`Take down “${q.title}”?`)) return;
  busy.value = q.id; try { await api.cancelBounty(q.id); await load(); } finally { busy.value = null; }
}
const forLabel = (q) => (q.forNames && q.forNames.length ? 'for ' + q.forNames.join(', ') : 'open to everyone');

const ready = computed(() => auto.value.filter((q) => open(q) && q.complete));
const inProgress = computed(() => auto.value.filter((q) => open(q) && !q.complete && q.progress > 0));
const notStarted = computed(() => auto.value.filter((q) => open(q) && q.progress === 0));
const questsDone = computed(() => auto.value.filter((q) => !open(q)));

const challengesOpen = computed(() => manual.value.filter(open));
const challengesDone = computed(() => manual.value.filter((q) => !open(q)));

async function claim(q) {
  busy.value = q.id; toast.value = '';
  try {
    const r = await api.claimQuest(q.id);
    if (r.status === 'pending') {
      toast.value = 'Submitted for approval';
    } else {
      toast.value = `+${r.coins} coins!`;
      burst.value = true;
      setTimeout(() => { burst.value = false; }, 1300);
    }
    await load();
  } catch (e) {
    toast.value = e.message;
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="screen">
    <CoinBurst v-if="burst" />
    <div class="h"><i class="ti ti-wand" style="color:var(--terra);" aria-hidden="true"></i> Quests</div>
    <p v-if="toast" class="sub pop-in" style="text-align:center;color:var(--gold-d);">{{ toast }}</p>

    <div class="row" style="gap:7px;">
      <button class="chip" :class="{ on: view === 'quests' }" style="flex:1;justify-content:center;" @click="view = 'quests'">Quests</button>
      <button class="chip" :class="{ on: view === 'challenges' }" style="flex:1;justify-content:center;" @click="view = 'challenges'">Challenges<span v-if="challengesOpen.length"> ({{ challengesOpen.length }})</span></button>
      <button class="chip" :class="{ on: view === 'bounties' }" style="flex:1;justify-content:center;" @click="view = 'bounties'">Bounties<span v-if="forMe.filter(open).length"> ({{ forMe.filter(open).length }})</span></button>
    </div>

    <!-- ============ QUESTS (auto-tracked) ============ -->
    <template v-if="view === 'quests'">
      <p class="sub" style="margin-top:-2px;">Goals that fill in automatically as you read.</p>
      <div v-if="!auto.length" class="card sub">No quests yet.</div>

      <template v-if="ready.length">
        <div class="sub">Ready to claim</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:11px;">
          <div v-for="q in ready" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:11px;background:#FFF7F3;border-color:#F2D2C5;">
            <div class="row" style="gap:11px;align-items:flex-start;">
              <span class="av" style="width:38px;height:38px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
              <div style="flex:1;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">{{ q.description }}</div></div>
              <span class="chip" style="background:var(--gold-bg);color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
            </div>
            <button class="btn" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-coin" aria-hidden="true"></i> Claim +{{ q.rewardCoins }}</button>
          </div>
        </div>
      </template>

      <template v-if="inProgress.length">
        <div class="sub" style="margin-top:4px;">In progress</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
          <div v-for="q in inProgress" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:9px;padding:13px 15px;">
            <div class="row" style="gap:10px;">
              <span class="av" style="width:30px;height:30px;font-size:13px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
              <span style="font-weight:600;flex:1;">{{ q.title }}</span>
              <span class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
            </div>
            <div class="row" style="gap:11px;">
              <div class="bar" style="flex:1;"><span :style="{ width: Math.min(100, q.progress / q.target * 100) + '%' }"></span></div>
              <span class="sub" style="white-space:nowrap;">{{ q.progress }} / {{ q.target }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-if="notStarted.length">
        <div class="sub" style="margin-top:4px;">Not started</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:9px;">
          <div v-for="q in notStarted" :key="q.id" class="card row" style="gap:11px;padding:13px 15px;">
            <span class="av" style="width:30px;height:30px;font-size:13px;background:#EFE0F0;color:#6E5E94;"><i :class="['ti', ICON[q.type]]" aria-hidden="true"></i></span>
            <div style="flex:1;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">{{ q.description }}</div></div>
            <span class="sub" style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
          </div>
        </div>
      </template>

      <template v-if="questsDone.length">
        <div class="sub" style="margin-top:4px;">Completed</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:7px;">
          <div v-for="q in questsDone" :key="q.id" class="card row" style="padding:10px 14px;opacity:.72;">
            <span style="flex:1;font-weight:600;">{{ q.title }}</span>
            <span class="chip" style="padding:4px 10px;background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i> +{{ q.rewardCoins }}</span>
          </div>
        </div>
      </template>
    </template>

    <!-- ============ CHALLENGES (manual) ============ -->
    <template v-else-if="view === 'challenges'">
      <p class="sub" style="margin-top:-2px;">Real-world tasks — do them, then mark them complete.</p>
      <div class="row" style="gap:16px;justify-content:center;margin-top:-4px;">
        <span class="sub"><i class="ti ti-flag" style="color:var(--terra-d);" aria-hidden="true"></i> do it yourself</span>
        <span class="sub"><i class="ti ti-shield-check" style="color:var(--terra-d);" aria-hidden="true"></i> needs approval</span>
      </div>
      <div v-if="!manual.length" class="card sub">No challenges yet.</div>

      <div v-if="challengesOpen.length" class="stagger" style="display:flex;flex-direction:column;gap:11px;">
        <div v-for="q in challengesOpen" :key="q.id" class="card" style="display:flex;gap:12px;align-items:center;">
          <span class="av" style="width:40px;height:40px;background:#FBE0D2;color:var(--terra-d);flex-shrink:0;" :title="q.requiresApproval ? 'Needs admin approval' : 'Mark it done yourself'"><i :class="q.requiresApproval ? 'ti ti-shield-check' : 'ti ti-flag'" style="font-size:20px;" aria-hidden="true"></i></span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">{{ q.title }}</div>
            <div class="sub">{{ q.description }}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px;flex-shrink:0;">
            <div style="font-weight:700;font-family:'Quicksand';color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ q.rewardCoins }}</div>
            <button class="btn" style="width:auto;padding:8px 15px;font-size:14px;" :disabled="busy === q.id" @click="claim(q)"><i class="ti ti-check" aria-hidden="true"></i> Mark done</button>
          </div>
        </div>
      </div>

      <template v-if="challengesDone.length">
        <div class="sub" style="margin-top:4px;">Done</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:7px;">
          <div v-for="q in challengesDone" :key="q.id" class="card row" style="padding:10px 14px;opacity:.72;">
            <span style="flex:1;font-weight:600;">{{ q.title }}</span>
            <span v-if="q.claimStatus === 'pending'" class="chip" style="padding:4px 10px;"><i class="ti ti-hourglass" aria-hidden="true"></i> Pending</span>
            <span v-else class="chip" style="padding:4px 10px;background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i> +{{ q.rewardCoins }}</span>
          </div>
        </div>
      </template>
    </template>

    <!-- ============ BOUNTIES (member-posted) ============ -->
    <template v-else>
      <p class="sub" style="margin-top:-2px;">Challenge someone (or everyone) to read a book or series. You pick the effort — the coins follow.</p>
      <button class="chip" style="align-self:flex-start;" @click="showBounty = !showBounty"><i class="ti ti-plus" aria-hidden="true"></i> Post a bounty</button>

      <div v-if="showBounty" class="card" style="display:flex;flex-direction:column;gap:9px;">
        <input v-model="bForm.title" placeholder="Which book or series? (e.g. Project Hail Mary)" />
        <input v-model="bForm.description" placeholder="Details (optional)" />
        <div>
          <div class="sub" style="margin-bottom:6px;">How big a read is it?</div>
          <div class="row" style="gap:8px;">
            <button v-for="[id, label, coins] in EFFORTS" :key="id" type="button" class="chip" :class="{ on: bForm.effort === id }" style="flex:1;flex-direction:column;justify-content:center;gap:1px;padding:8px 4px;" @click="bForm.effort = id">
              <span>{{ label }}</span><span class="sub" style="font-size:11px;"><i class="ti ti-coin" aria-hidden="true"></i> {{ coins }}</span>
            </button>
          </div>
        </div>
        <div>
          <div class="sub" style="margin-bottom:6px;">Who's it for?</div>
          <div class="row" style="gap:8px;">
            <button type="button" class="chip" :class="{ on: bForm.scope === 'everyone' }" style="flex:1;justify-content:center;" @click="bForm.scope = 'everyone'"><i class="ti ti-users" aria-hidden="true"></i> Everyone</button>
            <button type="button" class="chip" :class="{ on: bForm.scope === 'people' }" style="flex:1;justify-content:center;" @click="bForm.scope = 'people'"><i class="ti ti-user-check" aria-hidden="true"></i> Specific people</button>
          </div>
          <div v-if="bForm.scope === 'people'" class="row" style="gap:7px;flex-wrap:wrap;margin-top:8px;">
            <button v-for="m in otherMembers" :key="m.id" type="button" class="chip" :class="{ on: bForm.audience.includes(m.id) }" style="gap:6px;" @click="toggleAud(m.id)"><Avatar :member="m" :size="18" /> {{ m.name }}</button>
          </div>
        </div>
        <div class="sub">Whoever reads it earns <strong style="color:var(--gold-d);"><i class="ti ti-coin" aria-hidden="true"></i> {{ bPrice }}</strong> once an admin confirms it.</div>
        <button class="btn" :disabled="busy === 'bounty'" @click="submitBounty"><i class="ti ti-check" aria-hidden="true"></i> Post bounty</button>
      </div>

      <!-- for me -->
      <template v-if="forMe.length">
        <div class="sub" style="margin-top:2px;"><i class="ti ti-target" style="color:var(--terra);" aria-hidden="true"></i> For you</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:10px;">
          <div v-for="q in forMe" :key="q.id" class="card" style="display:flex;flex-direction:column;gap:9px;" :style="open(q) && q.complete ? { background: '#FFF7F3', borderColor: '#F2D2C5' } : {}">
            <div class="row" style="gap:10px;align-items:flex-start;">
              <span class="av" style="width:34px;height:34px;background:#FBE0D2;color:var(--terra-d);flex-shrink:0;"><i class="ti ti-flag-2" aria-hidden="true"></i></span>
              <div style="flex:1;min-width:0;"><div style="font-weight:600;">{{ q.title }}</div><div class="sub">from {{ q.posterName }}<span v-if="q.description"> · {{ q.description }}</span></div></div>
              <span class="sub" style="color:var(--gold-d);white-space:nowrap;"><i class="ti ti-coin" style="color:var(--gold);" aria-hidden="true"></i> {{ q.rewardCoins }}</span>
            </div>
            <template v-if="open(q)">
              <div v-if="measurable(q) && !q.complete" class="row" style="gap:10px;">
                <div class="bar" style="flex:1;"><span :style="{ width: Math.min(100, q.progress / q.target * 100) + '%' }"></span></div>
                <span class="sub" style="white-space:nowrap;">{{ q.progress }} / {{ q.target }}</span>
              </div>
              <button v-else class="btn" :disabled="busy === q.id" @click="claim(q)">
                <i :class="measurable(q) ? 'ti ti-coin' : 'ti ti-book'" aria-hidden="true"></i> {{ measurable(q) ? 'Claim +' + q.rewardCoins : "I've read it" }}
              </button>
            </template>
            <span v-else-if="q.claimStatus === 'pending'" class="chip" style="align-self:flex-start;"><i class="ti ti-hourglass" aria-hidden="true"></i> Waiting for admin</span>
            <span v-else class="chip" style="align-self:flex-start;background:var(--sage-bg);color:var(--sage-d);"><i class="ti ti-check" aria-hidden="true"></i> Claimed +{{ q.rewardCoins }}</span>
          </div>
        </div>
      </template>

      <!-- posted by me -->
      <template v-if="myBounties.length">
        <div class="sub" style="margin-top:4px;">Posted by you</div>
        <div class="stagger" style="display:flex;flex-direction:column;gap:8px;">
          <div v-for="q in myBounties" :key="q.id" class="card row" style="padding:11px 14px;gap:8px;">
            <div style="flex:1;min-width:0;"><span style="font-weight:600;">{{ q.title }}</span> <span class="sub">{{ q.rewardCoins }} · {{ forLabel(q) }}</span></div>
            <button class="chip" aria-label="take down" :disabled="busy === q.id" @click="cancelBounty(q)"><i class="ti ti-trash" aria-hidden="true"></i></button>
          </div>
        </div>
      </template>

      <div v-if="!bounties.length && !showBounty" class="card sub" style="text-align:center;">No bounties yet — post one to challenge someone.</div>
    </template>
  </div>
</template>
