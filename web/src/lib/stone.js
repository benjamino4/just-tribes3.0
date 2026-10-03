// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/stone.js
// PURPOSE: Generate real stone textures to canvas. Cached per element.
//          Grain + veins + chips. Seeded per surface.
// DEPENDS ON: noise.js
// ═══════════════════════════════════════════════════════════════════
import { fbm, mulberry32 } from './noise.js';

const cache = new Map();

export function makeStoneCanvas(w, h, opts = {}) {
  const key = `${w}x${h}:${opts.seed || 0}:${opts.hue || 'slate'}`;
  if (cache.has(key)) return cache.get(key);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);

  const seed = opts.seed ?? 1;
  const base = opts.base || '#1a1e26';
  const light = opts.light || '#2a2f3a';
  const dark = opts.dark || '#0f1218';
  const hue = opts.hue || 'slate';

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const [br, bg, bb] = hexToRgb(base);
  const [lr, lg, lb] = hexToRgb(light);
  const [dr, dg, db] = hexToRgb(dark);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const coarse = fbm(x / 60, y / 60, 3, seed);
      const mid = fbm(x / 12, y / 12, 2, seed + 100);
      const fine = fbm(x / 3, y / 3, 1, seed + 500);
      const mix = coarse * 0.5 + mid * 0.3 + fine * 0.2;
      let r, g, b;
      if (mix > 0.5) {
        const t = (mix - 0.5) * 2;
        r = br * (1 - t) + lr * t;
        g = bg * (1 - t) + lg * t;
        b = bb * (1 - t) + lb * t;
      } else {
        const t = mix * 2;
        r = dr * (1 - t) + br * t;
        g = dg * (1 - t) + bg * t;
        b = db * (1 - t) + bb * t;
      }
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Veins — thin darker lines
  const rng = mulberry32(seed + 9000);
  const veinCount = Math.max(2, Math.floor((w + h) / 180));
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let v = 0; v < veinCount; v++) {
    ctx.lineWidth = 0.6 + rng() * 1.2;
    ctx.beginPath();
    let px = rng() * w;
    let py = rng() * h;
    ctx.moveTo(px, py);
    const steps = 6 + Math.floor(rng() * 8);
    for (let s = 0; s < steps; s++) {
      px += (rng() - 0.5) * 40;
      py += (rng() - 0.5) * 40;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  // Chips — small polygon cutouts near edges
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  const chipCount = Math.max(1, Math.floor((w + h) / 220));
  for (let i = 0; i < chipCount; i++) {
    const cxp = rng() * w;
    const cyp = rng() < 0.5 ? rng() * h * 0.15 : h - rng() * h * 0.15;
    ctx.beginPath();
    const pts = 4 + Math.floor(rng() * 4);
    for (let p = 0; p < pts; p++) {
      const a = (Math.PI * 2 * p) / pts;
      const rr = 4 + rng() * 8;
      const px = cxp + Math.cos(a) * rr;
      const py = cyp + Math.sin(a) * rr;
      if (p === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  cache.set(key, c);
  return c;
}

function hexToRgb(hex) {
  hex = String(hex).replace('#', '');
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  const n = parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function dataURLFor(w, h, opts = {}) {
  return makeStoneCanvas(w, h, opts).toDataURL('image/png');
}