export function fmt(n) {
  n = Number(n) || 0;
  const sign = n < 0 ? '-' : '';
  n = Math.abs(n);
  if (n >= 1e9) return sign + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return sign + (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return sign + (n / 1e3).toFixed(1) + 'k';
  return sign + Math.floor(n).toLocaleString();
}

export function shortTime(ms) {
  if (ms <= 0) return 'ready';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}