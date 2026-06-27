// Light wrapper around Capacitor Haptics. No-ops on the web (and anywhere the
// plugin isn't installed), buzzes on the Android build. Accessed via the runtime
// plugin registry so the web bundle never needs the package present.
import { Capacitor } from '@capacitor/core';

function haptics() {
  return Capacitor.isNativePlatform() ? Capacitor.Plugins?.Haptics : null;
}

// a small tap for a deliberate action
export function hapticTap(style = 'LIGHT') {
  const h = haptics();
  if (h) { try { h.impact({ style }); } catch { /* never let a buzz break a flow */ } }
}

// the happy "you earned/finished something" buzz
export function hapticWin() {
  const h = haptics();
  if (h) { try { h.notification({ type: 'SUCCESS' }); } catch { /* ignore */ } }
}
