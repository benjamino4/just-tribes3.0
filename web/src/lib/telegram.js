const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#0a0908');
    tg.setBackgroundColor?.('#07060a');
    tg.enableClosingConfirmation?.();
  } catch {}
}

export function initData() {
  try { return tg?.initData || ''; } catch { return ''; }
}

export function user() {
  try { return tg?.initDataUnsafe?.user || null; } catch { return null; }
}

export function isInsideTelegram() { return !!initData(); }