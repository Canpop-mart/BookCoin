import { reactive } from 'vue';

const saved = (() => { try { return JSON.parse(localStorage.getItem('bookcoin') || '{}'); } catch { return {}; } })();

export const store = reactive({
  token: saved.token || null,
  member: saved.member || null,
  serverUrl: saved.serverUrl || '', // '' = same origin (web); set to NAS URL in the app
  // finished-but-unsaved session handed from timer -> log; persisted so a reload
  // or app kill between finishing and saving doesn't lose the sitting
  draft: saved.draft || null,
  deliveries: 0, // rewards of mine that someone bought and I owe — drives the Rewards nav badge
  questsReady: 0, // quests/challenges I can claim right now — drives the Quests nav badge
  finishResult: null, // transient coin result handed from the log screen to the finish screen
  // running reading timer, persisted so it survives backgrounding / app kill.
  // { startedAt, running, pausedAccumMs, pausedAt, title } — all timestamp-based.
  timer: saved.timer || null,

  save() {
    localStorage.setItem('bookcoin', JSON.stringify({
      token: this.token, member: this.member, serverUrl: this.serverUrl, timer: this.timer, draft: this.draft,
    }));
  },
  setDraft(d) { this.draft = d; this.save(); },
  // rebuild a running timer from the draft, for "back to timer" when Done was hit
  // by mistake. The last segment is the lap that was on the clock; earlier ones
  // are the banked laps. Returns false if the draft can't be resumed.
  resumeFromDraft() {
    const d = this.draft;
    if (!d || !Array.isArray(d.segments) || !d.segments.length) return false;
    const segs = d.segments.slice();
    const last = segs.pop();
    this.timer = {
      startedAt: Date.now() - Math.max(0, (last.seconds || 0)) * 1000,
      running: true, pausedAccumMs: 0, pausedAt: null,
      title: last.title || '', segments: segs, quote: last.quote || '',
      cover: d.cover || '', bookId: d.bookId || null,
    };
    this.draft = null;
    this.save();
    return true;
  },
  setAuth(token, member) { this.token = token; this.member = member; this.save(); },
  setMember(member) { if (member) { this.member = member; this.save(); } },
  setDeliveries(n) { this.deliveries = n || 0; },
  setQuestsReady(n) { this.questsReady = n || 0; },
  setFinishResult(r) { this.finishResult = r; },
  takeFinishResult() { const r = this.finishResult; this.finishResult = null; return r; },
  logout() { this.token = null; this.member = null; this.draft = null; this.timer = null; this.save(); },

  // --- reading timer (wall-clock based, so backgrounding never loses time) ---
  // meta.cover / meta.bookId tie the session to a book picked from the shelf
  startTimer(title = '', meta = {}) {
    this.timer = {
      startedAt: Date.now(), running: true, pausedAccumMs: 0, pausedAt: null,
      title, segments: [], cover: meta.cover || '', bookId: meta.bookId || null, quote: '',
    };
    this.save();
  },
  // bank what's on the clock and start a fresh lap, for when you switch books mid-sitting
  splitTimer() {
    if (!this.timer) return;
    const seconds = Math.max(1, Math.round(this.elapsedMs() / 1000));
    // bank the lap with its quote so switching books never loses what you jotted
    this.timer.segments = [...(this.timer.segments || []), { seconds, title: this.timer.title || '', quote: this.timer.quote || '' }];
    this.timer.startedAt = Date.now();
    this.timer.pausedAccumMs = 0;
    this.timer.pausedAt = this.timer.running ? null : Date.now();
    // a new lap is a different (unlabeled) book, so drop the previous book's tag
    this.timer.title = '';
    this.timer.cover = '';
    this.timer.bookId = null;
    this.timer.quote = '';
    this.save();
  },
  // jot / edit a quote for the lap on the clock, mid-session
  setTimerQuote(q) { if (this.timer) { this.timer.quote = q; this.save(); } },
  // drop a banked lap (e.g. an accidental split) without leaving the timer, and
  // give its time back to the running clock so the sitting's total is unchanged
  removeSegment(i) {
    if (!this.timer || !Array.isArray(this.timer.segments)) return;
    const [removed] = this.timer.segments.splice(i, 1);
    const secs = Math.max(0, Math.round(removed?.seconds || 0));
    this.timer.startedAt -= secs * 1000; // moving the start back lengthens elapsed by that much
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
