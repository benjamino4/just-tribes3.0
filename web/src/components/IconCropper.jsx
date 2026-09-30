// TRIBES-FILE: web/src/components/IconCropper.jsx
// PHASE: 4 — Rise of the Eternal Flame (monetization)
//
// Circular image cropper built on a raw <canvas>. The Chief imports an image,
// drags to reposition and zooms to frame it inside a live circular mask, then
// saves — the component exports a 256\u00d7256 circle-masked PNG/WebP data URL that
// is stored as the tribe icon. All drawing + hit-testing is hand-rolled 2D
// canvas code (no image library).

import { useEffect, useRef, useState, useCallback } from 'react';

const D = 264;          // on-canvas editor size (CSS px)
const OUT = 256;         // exported icon size (px)
const PAD = 10;          // gap between canvas edge and crop circle

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

export default function IconCropper({ initial, onCropped, onCancel, busy }) {
  const cvs = useRef(null);
  const imgRef = useRef(null);
  const drag = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  const R = D / 2 - PAD;
  const cx = D / 2, cy = D / 2;

  const baseScale = useCallback((img) => Math.max((R * 2) / img.width, (R * 2) / img.height), [R]);

  const clampPan = useCallback((p, img, z) => {
    if (!img) return p;
    const s = baseScale(img) * z;
    const iw = img.width * s, ih = img.height * s;
    const mx = Math.max(0, iw / 2 - R);
    const my = Math.max(0, ih / 2 - R);
    return { x: clamp(p.x, -mx, mx), y: clamp(p.y, -my, my) };
  }, [R, baseScale]);

  const draw = useCallback(() => {
    const c = cvs.current; if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (c.width !== D * dpr) { c.width = D * dpr; c.height = D * dpr; }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, D, D);

    // backdrop
    const bg = ctx.createLinearGradient(0, 0, 0, D);
    bg.addColorStop(0, '#1a0f0a'); bg.addColorStop(1, '#0b0708');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, D, D);

    const img = imgRef.current;
    if (img) {
      const s = baseScale(img) * zoom;
      const iw = img.width * s, ih = img.height * s;
      ctx.drawImage(img, cx - iw / 2 + pan.x, cy - ih / 2 + pan.y, iw, ih);
    } else {
      ctx.fillStyle = '#a97e57';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('Import an image \u2192', cx, cy);
    }

    // dim outside the crop circle
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,8,0.66)';
    ctx.beginPath();
    ctx.rect(0, 0, D, D);
    ctx.arc(cx, cy, R, 0, Math.PI * 2, true);   // even-odd cut-out
    ctx.fill('evenodd');
    ctx.restore();

    // glowing ring
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ff9a2a';
    ctx.shadowColor = 'rgba(255,140,40,0.7)'; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
  }, [zoom, pan, cx, cy, R, baseScale]);

  useEffect(() => { draw(); }, [draw]);

  // load initial (existing icon) if provided
  useEffect(() => {
    if (!initial) return;
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => { imgRef.current = im; setZoom(1); setPan({ x: 0, y: 0 }); setReady(true); draw(); };
    im.src = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => {
      imgRef.current = im; setZoom(1); setPan({ x: 0, y: 0 }); setReady(true);
      URL.revokeObjectURL(url); draw();
    };
    im.src = url;
  }

  function onDown(e) {
    if (!imgRef.current) return;
    const p = 'touches' in e ? e.touches[0] : e;
    drag.current = { x: p.clientX, y: p.clientY, pan };
  }
  function onMove(e) {
    if (!drag.current) return;
    const p = 'touches' in e ? e.touches[0] : e;
    const next = { x: drag.current.pan.x + (p.clientX - drag.current.x), y: drag.current.pan.y + (p.clientY - drag.current.y) };
    setPan(clampPan(next, imgRef.current, zoom));
  }
  function onUp() { drag.current = null; }

  function changeZoom(z) {
    setZoom(z);
    setPan((p) => clampPan(p, imgRef.current, z));
  }

  function exportIcon() {
    const img = imgRef.current; if (!img) return;
    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    const g = out.getContext('2d');
    g.save();
    g.beginPath(); g.arc(OUT / 2, OUT / 2, OUT / 2, 0, Math.PI * 2); g.clip();
    const f = OUT / (R * 2);              // editor-circle px -> output px
    const s = baseScale(img) * zoom * f;
    const iw = img.width * s, ih = img.height * s;
    g.drawImage(img, OUT / 2 - iw / 2 + pan.x * f, OUT / 2 - ih / 2 + pan.y * f, iw, ih);
    g.restore();
    let url;
    try { url = out.toDataURL('image/webp', 0.85); } catch { url = ''; }
    if (!url || url.indexOf('image/webp') === -1) url = out.toDataURL('image/png');
    onCropped(url);
  }

  return (
    <div className="ic-wrap">
      <canvas
        ref={cvs}
        className="ic-canvas"
        style={{ width: D, height: D, touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />
      {ready && (
        <label className="ic-zoom">
          <span>Zoom</span>
          <input type="range" min="1" max="4" step="0.01" value={zoom}
            onChange={(e) => changeZoom(Number(e.target.value))} />
        </label>
      )}
      <div className="ic-actions">
        <label className="ic-btn ghost">
          {ready ? 'Change image' : 'Import image'}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickFile} />
        </label>
        {onCancel && <button className="ic-btn ghost" onClick={onCancel}>Cancel</button>}
        <button className="ic-btn primary" disabled={!ready || busy} onClick={exportIcon}>
          {busy ? 'Saving\u2026' : 'Save icon'}
        </button>
      </div>
      <p className="ic-hint">Drag to reposition \u00b7 pinch or slide to zoom \u00b7 crops to a circle.</p>
    </div>
  );
}
