function stripDangerous(svg) {
  return svg
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*foreignObject[\s\S]*?<\s*\/\s*foreignObject\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*"(?!data:image\/)[^"]*"/gi, '')
    .replace(/\s(?:xlink:)?href\s*=\s*'(?!data:image\/)[^']*'/gi, '');
}

export function sanitizeSvg(raw) {
  if (typeof raw !== 'string') return null;
  let svg = raw.trim();
  if (!/<\s*svg[\s>]/i.test(svg)) return null;
  if (!/viewBox\s*=/.test(svg)) {
    const w = /width\s*=\s*"(\d+(?:\.\d+)?)"/.exec(svg);
    const h = /height\s*=\s*"(\d+(?:\.\d+)?)"/.exec(svg);
    if (w && h) svg = svg.replace(/<\s*svg/i, `<svg viewBox="0 0 ${w[1]} ${h[1]}"`);
    else svg = svg.replace(/<\s*svg/i, `<svg viewBox="0 0 24 24"`);
  }
  svg = stripDangerous(svg);
  if (svg.length > 200_000) return null;
  return svg;
}

export function isValidKey(key) {
  return typeof key === 'string' && key.length >= 2 && key.length <= 40 &&
    /^[a-z0-9][a-z0-9\-_]*$/.test(key);
}

export function slugifyKey(filename) {
  return String(filename || '')
    .replace(/\.(svg|png|webp|jpe?g)$/i, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

export function isRaster(mime) { return /^image\/(png|jpeg|webp)$/i.test(String(mime || '')); }
export function isSvg(mime, filename) {
  if (/svg/i.test(String(mime || ''))) return true;
  return /\.svg$/i.test(String(filename || ''));
}