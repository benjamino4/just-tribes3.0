import { useCallback, useEffect, useRef, useState } from 'react';
import { Endpoints, ApiError } from '../lib/api.js';
import { toast } from './Toast.jsx';
import { useApp } from '../lib/store.jsx';

const POS_KEY = 'tribes.giftbox.pos';
const OPEN_KEY = 'tribes.giftbox.open';

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function loadPos() {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) { const p = JSON.parse(raw); if (typeof p.x === 'number' && typeof p.y === 'number') return p; }
  } catch {}
  // Default: bottom-right, above the tab bar.
  const w = typeof window !== 'undefined' ? window.innerWidth : 390;
  const h = typeof window !== 'undefined' ? window.innerHeight : 780;
  return { x: w - 76, y: h - 190 };
}

export default function GiftBox() {
  const { reload } = useApp();
  const [pos, setPos] = useState(loadPos);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
  });
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const dragRef = useRef(null);
  const movedRef = useRef(false);

  // Persist position / open state.
  useEffect(() => { try { localStorage.setItem(POS_KEY, JSON.stringify(pos)); } catch {} }, [pos]);
  useEffect(() => { try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {} }, [open]);

  // Keep the box on-screen if the viewport changes.
  useEffect(() => {
    function onResize() {
      setPos((p) => ({
        x: clamp(p.x, 8, window.innerWidth - 60),
        y: clamp(p.y, 8, window.innerHeight - 60)
      }));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e) => {
    // Only the drag handle starts a drag.
    const el = e.currentTarget;
    el.setPointerCapture?.(e.pointerId);
    movedRef.current = false;
    const startX = e.clientX;
    const startY = e.clientY;
    const origin = { ...pos };
    const size = dragRef.current ? dragRef.current.getBoundingClientRect() : { width: 56, height: 56 };

    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) movedRef.current = true;
      setPos({
        x: clamp(origin.x + dx, 8, window.innerWidth - size.width - 8),
        y: clamp(origin.y + dy, 8, window.innerHeight - size.height - 8)
      });
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, [pos]);

  function toggle() {
    // Don't toggle if the pointer was actually dragging.
    if (movedRef.current) { movedRef.current = false; return; }
    setOpen((o) => !o);
  }

  async function doPreview() {
    const c = code.trim();
    if (!c) return;
    setBusy(true); setPreview(null);
    try {
      const j = await Endpoints.giftPreview(c);
      const d = j.data || j;
      setPreview(d);
      if (!d.valid) toast(reasonText(d.reason), 'warn');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not check code', 'error');
    } finally { setBusy(false); }
  }

  async function doRedeem() {
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    try {
      const j = await Endpoints.giftRedeem(c);
      const d = j.data || j;
      toast(`\u2705 Redeemed: +${(d.amount || 0).toLocaleString()} ${d.kind}`, 'success');
      setCode(''); setPreview(null);
      reload();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Could not redeem code', 'error');
    } finally { setBusy(false); }
  }

  function reasonText(r) {
    switch (r) {
      case 'not_found': return 'No such code';
      case 'revoked': return 'This code is no longer active';
      case 'exhausted': return 'This code has been fully claimed';
      case 'already_used': return 'You already used this code';
      case 'empty': return 'Enter a code first';
      default: return 'Invalid code';
    }
  }

  return (
    <div
      ref={dragRef}
      className="giftbox"
      style={{ left: pos.x, top: pos.y }}
      role="dialog"
      aria-label="Gift code"
    >
      {open && (
        <div className="giftbox-panel glass">
          <div className="giftbox-head" onPointerDown={onPointerDown}>
            <span className="giftbox-grip" aria-hidden="true">{'\u2630'}</span>
            <span className="giftbox-title">{'\uD83C\uDF81 Gift Code'}</span>
            <button className="giftbox-x" onClick={() => setOpen(false)} aria-label="Close">{'\u00D7'}</button>
          </div>
          <div className="giftbox-body">
            <input
              className="giftbox-input"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setPreview(null); }}
              placeholder="ENTER CODE"
              maxLength={32}
              autoCapitalize="characters"
              spellCheck={false}
            />
            {preview && preview.valid && (
              <div className="giftbox-hint ok">{'Valid \u00b7 grants '}{(preview.amount || 0).toLocaleString()} {preview.kind}</div>
            )}
            <div className="giftbox-actions">
              <button className="btn ghost" onClick={doPreview} disabled={busy || !code.trim()}>Check</button>
              <button className="btn primary" onClick={doRedeem} disabled={busy || !code.trim()}>Redeem</button>
            </div>
          </div>
        </div>
      )}
      <button
        className="giftbox-fab"
        onPointerDown={onPointerDown}
        onClick={toggle}
        aria-label={open ? 'Collapse gift code box' : 'Open gift code box'}
        title="Gift code"
      >
        {open ? '\u2630' : '\uD83C\uDF81'}
      </button>
    </div>
  );
}
