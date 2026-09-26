// Thin wrapper around the Telegram WebApp SDK with safe no-op fallbacks
// so the app also runs in a normal browser during development.
const TG = (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) || null;

export function initTelegram() {
  if (!TG) return;
  try {
    TG.ready();
    TG.expand();
    TG.setHeaderColor && TG.setHeaderColor('#0a0908');
    TG.setBackgroundColor && TG.setBackgroundColor('#07060a');
    TG.enableClosingConfirmation && TG.enableClosingConfirmation();
  } catch (e) {}
}

export function initData() {
  return (TG && TG.initData) || '';
}

export function tgUser() {
  return (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) || null;
}

let lastHaptic = 0;
export function haptic(kind = 'light') {
  if (typeof window !== 'undefined' && window.__hapticsEnabled === false) return;
  const now = Date.now();
  if (now - lastHaptic < 30) return; // debounce
  lastHaptic = now;
  try {
    if (!TG || !TG.HapticFeedback) return;
    const h = TG.HapticFeedback;
    if (kind === 'select') h.selectionChanged();
    else if (kind === 'heavy') h.impactOccurred('heavy');
    else if (kind === 'medium') h.impactOccurred('medium');
    else if (kind === 'success') h.notificationOccurred('success');
    else if (kind === 'error') h.notificationOccurred('error');
    else h.impactOccurred('light');
  } catch (e) {}
}

export function openLink(url) {
  try {
    if (TG && TG.openLink) TG.openLink(url);
    else window.open(url, '_blank', 'noopener');
  } catch (e) {}
}

export { TG };
