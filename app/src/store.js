import { reactive } from 'vue';

const saved = (() => { try { return JSON.parse(localStorage.getItem('bookcoin') || '{}'); } catch { return {}; } })();

export const store = reactive({
  token: saved.token || null,
  member: saved.member || null,
  serverUrl: saved.serverUrl || '', // '' = same origin (web); set to NAS URL in the app
  draft: null, // in-progress reading session handed from timer -> log

  save() {
    localStorage.setItem('bookcoin', JSON.stringify({
      token: this.token, member: this.member, serverUrl: this.serverUrl,
    }));
  },
  setAuth(token, member) { this.token = token; this.member = member; this.save(); },
  logout() { this.token = null; this.member = null; this.draft = null; this.save(); },
});
