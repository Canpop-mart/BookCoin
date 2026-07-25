<script setup>
// Tells you when the server has been upgraded past the version you're running.
// The app bakes in its own version at build time; the server reports its own at
// /api/version. When the server is newer, a newer release exists (all three
// package.json bump together at release), so there's something to get.
//   - In the APK: link to the release page to download the new build.
//   - On the web: reload, which pulls the fresh bundle from the same server.
import { ref, onMounted, onUnmounted } from 'vue';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { api } from '../api';

const RELEASES_URL = 'https://github.com/Canpop-mart/BookCoin/releases/latest';
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

const native = Capacitor.isNativePlatform();
const latest = ref('');
const show = ref(false);
let resumeHandle = null;

const parts = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
function isNewer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

async function check() {
  try {
    const { version } = await api.version();
    if (version && isNewer(version, APP_VERSION) && localStorage.getItem('bookcoin_update_dismissed') !== version) {
      latest.value = version;
      show.value = true;
    }
  } catch { /* an older server without /version, or offline: just say nothing */ }
}

function dismiss() {
  if (latest.value) localStorage.setItem('bookcoin_update_dismissed', latest.value);
  show.value = false;
}
function reload() { location.reload(); }

onMounted(async () => {
  check();
  // re-check when the app returns to the foreground (a deploy while it was away)
  if (native) resumeHandle = await CapacitorApp.addListener('resume', check);
});
onUnmounted(() => { resumeHandle?.remove?.(); });
</script>

<template>
  <transition name="drop">
    <div v-if="show" class="upd">
      <i class="ti ti-rocket" aria-hidden="true"></i>
      <span class="upd-text">A new version is ready <span class="upd-ver">v{{ latest }}</span></span>
      <a v-if="native" class="upd-btn" :href="RELEASES_URL" target="_blank" rel="noopener">Get it</a>
      <button v-else class="upd-btn" @click="reload">Reload</button>
      <button class="upd-x" aria-label="Dismiss" @click="dismiss"><i class="ti ti-x" aria-hidden="true"></i></button>
    </div>
  </transition>
</template>

<style scoped>
.upd {
  position: fixed; top: 0; left: 0; right: 0; z-index: 60;
  display: flex; align-items: center; gap: 9px;
  padding: 10px 12px;
  padding-top: calc(10px + env(safe-area-inset-top));
  background: var(--gold-bg); border-bottom: 1px solid #EBD49B; color: var(--gold-d);
  font-family: 'Nunito', sans-serif; font-size: 13.5px;
  box-shadow: 0 4px 14px rgba(74, 63, 53, .14);
}
.upd > .ti-rocket { font-size: 17px; flex-shrink: 0; }
.upd-text { flex: 1; min-width: 0; font-weight: 600; }
.upd-ver { opacity: .8; font-weight: 700; }
.upd-btn {
  flex-shrink: 0; border: none; cursor: pointer; text-decoration: none;
  background: var(--gold-d); color: #fff; font: inherit; font-weight: 700;
  padding: 5px 13px; border-radius: 999px;
}
.upd-x {
  flex-shrink: 0; border: none; background: none; cursor: pointer;
  color: var(--gold-d); font-size: 16px; display: inline-flex; padding: 2px;
}
.drop-enter-active, .drop-leave-active { transition: transform .3s ease, opacity .3s ease; }
.drop-enter-from, .drop-leave-to { transform: translateY(-100%); opacity: 0; }
</style>
