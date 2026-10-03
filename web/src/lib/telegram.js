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

// The launch parameter (?startapp=...) a friend opened the mini-app with. Used
// to auto-join a friendly challenge code shared via a deep link.
export function startParam() {
  try { return tg?.initDataUnsafe?.start_param || ''; } catch { return ''; }
}

// Share a friendly-challenge invite. Prefers a native Telegram share of a deep
// link into this mini-app; falls back to the clipboard / Web Share. The bot
// username + app short-name are read from Vite env so no secrets are hardcoded.
export function shareInvite(code, text) {
  const bot = import.meta.env.VITE_BOT_USERNAME || '';
  const app = import.meta.env.VITE_APP_NAME || '';
  let link = '';
  if (bot && app) link = `https://t.me/${bot}/${app}?startapp=ch_${code}`;
  else if (bot) link = `https://t.me/${bot}?startapp=ch_${code}`;
  const msg = text || `Face me in Tribes — join with code ${code}`;
  try {
    if (link && tg?.openTelegramLink) {
      const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`;
      tg.openTelegramLink(share);
      return { ok: true, link };
    }
  } catch {}
  try {
    if (navigator.share) { navigator.share({ title: 'Tribes challenge', text: msg, url: link || undefined }); return { ok: true, link }; }
  } catch {}
  try { navigator.clipboard?.writeText(link ? `${msg}\n${link}` : msg); return { ok: true, copied: true, link }; } catch {}
  return { ok: false, link };
}