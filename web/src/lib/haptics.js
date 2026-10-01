let last = 0;

export function haptic(kind = 'light') {
  if (typeof window !== 'undefined' && window.__hapticsEnabled === false) return;
  const now = Date.now();
  if (now - last < 30) return;
  last = now;
  try {
    const h = window.Telegram?.WebApp?.HapticFeedback;
    if (!h) return;
    switch (kind) {
      case 'select':  h.selectionChanged(); break;
      case 'heavy':   h.impactOccurred('heavy'); break;
      case 'medium':  h.impactOccurred('medium'); break;
      case 'success': h.notificationOccurred('success'); break;
      case 'error':   h.notificationOccurred('error'); break;
      default:        h.impactOccurred('light');
    }
  } catch {}
}