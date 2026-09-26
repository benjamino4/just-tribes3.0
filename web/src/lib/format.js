export const fmt = (n) => {
  n = Number(n) || 0;
  const s = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e9) return s + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return s + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return s + (n / 1e3).toFixed(1) + 'k';
  return s + Math.floor(n).toLocaleString();
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function timeLeft(ms) {
  if (ms <= 0) return 'ready';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
