import { reactive } from 'vue';

const saved = (() => { try { return JSON.parse(localStorage.getItem('bookcoin') || '{}'); } catch { return {}; } })();

export const store = reactive({
  token: saved.token || null,
  member: saved.member || null,
  serverUrl: saved.serverUrl || '', // '' = same origin (web); set to NAS URL in the app
  draft: null, // in-progress reading session handed from timer -> log
  deliveries: 0, // rewards of mine that someone bought and I owe — drives the Rewards nav badge
  questsReady: 0, // quests/challenges I can claim right now — drives the Quests nav badge
  // running reading timer, persisted so it survives backgrounding / app kill.
  // { startedAt, running, pausedAccumMs, pausedAt, title } — all timestamp-based.
  timer: saved.timer || null,

  save() {
    localStorage.setItem('bookcoin', JSON.stringify({
      token: this.token, member: this.member, serverUrl: this.serverUrl, timer: this.timer,
    }));
  },
  setAuth(token, member) { this.token = token; this.member = member; this.save(); },
  setMember(member) { if (member) { this.member = member; this.save(); } },
  setDeliveries(n) { this.deliveries = n || 0; },
  setQuestsReady(n) { this.questsReady = n || 0; },
  logout() { this.token = null; this.member = null; this.draft = null; this.timer = null; this.save(); },

  // --- reading timer (wall-clock based, so backgrounding never loses time) ---
  startTimer(title = '') {
    this.timer = { startedAt: Date.now(), running: true, pausedAccumMs: 0, pausedAt: null, title };
    this.save();
  },
  pauseTimer() {
    if (this.timer && this.timer.running) { this.timer.pausedAt = Date.now(); this.timer.running = false; this.save(); }
  },
  resumeTimer() {
    if (this.timer && !this.timer.running) {
      this.timer.pausedAccumMs += Date.now() - this.timer.pausedAt;
      this.timer.pausedAt = null; this.timer.running = true; this.save();
    }
  },
  setTimerTitle(t) { if (this.timer) { this.timer.title = t; this.save(); } },
  clearTimer() { this.timer = null; this.save(); },
  elapsedMs() {
    const t = this.timer; if (!t) return 0;
    const end = t.running ? Date.now() : t.pausedAt;
    return Math.max(0, end - t.startedAt - t.pausedAccumMs);
  },
});
