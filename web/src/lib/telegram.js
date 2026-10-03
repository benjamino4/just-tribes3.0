const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#0f141c');
    tg.setBackgroundColor?.('#0f141c');
    tg.enableClosingConfirmation?.();
  } catch {}
}

export function initData() {
  try { return tg?.initData || ''; } catch { return ''; }
}

export function user() {
  try { return tg?.initDataUnsafe?.user || null; } catch { return null; }
}

export function openInvoice(link, callback) {
  if (tg?.openInvoice) tg.openInvoice(link, callback);
  else window.open(link, '_blank');
}