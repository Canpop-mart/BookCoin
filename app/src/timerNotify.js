// Ongoing "reading in progress" notification in the phone's notification drawer,
// so users can leave the app and still see / return to their running timer.
// Android only (no-op on web). A live-ticking chronometer would need a native
// foreground service; this v1 is a static ongoing notification + tap-to-return.
import { Capacitor } from '@capacitor/core';

const ID = 1;
let LN = null;

async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!LN) LN = (await import('@capacitor/local-notifications')).LocalNotifications;
  return LN;
}

export async function showReadingNotification(paused = false) {
  const p = await plugin(); if (!p) return;
  try {
    let perm = await p.checkPermissions();
    if (perm.display !== 'granted') perm = await p.requestPermissions();
    if (perm.display !== 'granted') return;
    await p.schedule({
      notifications: [{
        id: ID,
        title: paused ? 'Reading paused' : 'Reading in progress',
        body: paused ? 'Tap to resume your session' : 'Tap to return — your time is still counting',
        ongoing: !paused,    // non-swipeable while actively reading
        autoCancel: false,
      }],
    });
  } catch { /* notifications are best-effort */ }
}

export async function clearReadingNotification() {
  const p = await plugin(); if (!p) return;
  try { await p.cancel({ notifications: [{ id: ID }] }); } catch { /* ignore */ }
}

export async function onNotificationTap(handler) {
  const p = await plugin(); if (!p) return;
  try { await p.addListener('localNotificationActionPerformed', handler); } catch { /* ignore */ }
}
