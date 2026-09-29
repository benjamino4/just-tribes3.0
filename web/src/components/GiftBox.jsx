// =====================================================================
// GiftBox — draggable floating gift box.
// =====================================================================
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { useApp } from '../lib/store.jsx';
import { haptic } from '../lib/haptics.js';
import { apiGet, apiPost } from '../lib/api.js';
import { celebrate } from '../lib/celebrate.jsx';
import { toast } from './Toast.jsx';

const POS_KEY = 'tribes.giftbox.pos';
const HIDE_KEY = 'tribes.giftbox.hiddenUntil';

function summarize(summary) {
  if (!Array.isArray(summary) || !summary.length) return 'Enjoy';
  return summary.map((s) => {
    if (s.kind === 'ember') return `+${Number(s.amount).toLocaleString()} Ember`;
    if (s.kind === 'renown') return `+${s.amount} Renown`;
    if (s.kind === 'stars') return `+${s.amount} Stars`;
    if (s.kind === 'relic') return `Relic: ${s.slug}`;
    if (s.kind === 'emoji') return `Emoji: ${s.key}`;
    if (s.kind === 'emoji_set') return `Set: ${s.slug}`;
    if (s.kind === 'shards') return `+${s.amount} Shards`;
    return s.kind;
  }).join(' · ');
}

export default function GiftBox() {
  const M = useMotionConfig();
  const { data } = useApp();
  const [pos, setPos] = useState(() => {
    try { return JSON.parse(localStorage.getItem(POS_KEY) || 'null') || { x: -1, y: -1 }; }
    catch { return { x: -1, y: -1 }; }
  });
  const [hidden, setHidden] = useState(() => {
    const until = Number(localStorage.getItem(HIDE_KEY) || 0);
    return until > Date.now();
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState([]);
  const dragControls = useDragControls();
  const lastTapRef = useRef(0);

  useEffect(() => {
    if (!data?.user) return;
    (async () => {
      try {
        const r = await apiGet('/api/gift/pending');
        setPending(r.pending || []);
      } catch {}
    })();
  }, [data?.user?.id, sheetOpen]);

  if (hidden) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const initialPos = pos.x < 0 ? { x: vw - 84, y: vh - 220 } : pos;

  function onDragEnd(_, info) {
    const snapLeft = info.point.x < vw / 2;
    const x = snapLeft ? 12 : vw - 72;
    const y = Math.max(80, Math.min(vh - 120, info.point.y));
    setPos({ x, y });
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x, y })); } catch {}
    haptic('light');
  }

  function onTap() {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      haptic('medium');
      setSheetOpen(true);
      lastTapRef.current = 0;
      return;
    }
    lastTapRef.current = now;
    setTimeout(() => {
      if (lastTapRef.current === now) {
        setSheetOpen(true);
        lastTapRef.current = 0;
      }
    }, 320);
  }

  function hideFor24h() {
    const until = Date.now() + 24 * 3600 * 1000;
    try { localStorage.setItem(HIDE_KEY, String(until)); } catch {}
    setHidden(true);
    toast('Gift box hidden for 24h', 'info');
  }

  async function redeem(codeStr) {
    const c = (codeStr || code).trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    try {
      const r = await apiPost('/api/gift/redeem', { code: c });
      setSheetOpen(false);
      setCode('');
      celebrate({
        kind: 'gift',
        title: 'Gift received',
        subtitle: r.gift?.name || `Code ${c}`,
        emoji: 'reaction-fire',
        tone: 'gold',
        reward: summarize(r.summary),
      });
    } catch (e) {
      toast(e.message || 'Could not redeem', 'bad');
    } finally {
      setBusy(false);
    }
  }

  const hasPending = pending.length > 0;

  return (
    <>
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        dragConstraints={{ left: 12, right: vw - 72, top: 80, bottom: vh - 120 }}
        onDragEnd={onDragEnd}
        onClick={onTap}
        onContextMenu={(e) => { e.preventDefault(); hideFor24h(); }}
        initial={initialPos}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        style={{
          position: 'fixed',
          width: 60, height: 60,
          zIndex: 180,
          cursor: 'grab',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        <motion.div
          animate={hasPending ? { y: [0, -6, 0] } : { y: [0, -3, 0] }}
          transition={{ duration: hasPending ? 1.6 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: '100%', height: '100%',
            filter: hasPending
              ? 'drop-shadow(0 8px 20px rgba(239,193,104,0.55))'
              : 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
          }}
        >
          <GiftIcon hasPending={hasPending} />
        </motion.div>

        {hasPending && (
          <motion.span
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{
              position: 'absolute', top: -2, right: -2,
              minWidth: 18, height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--ember-500)',
              color: '#1a0b02',
              fontSize: 10,
              fontWeight: 800,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 0 12px var(--ember-400)',
              border: '1.5px solid var(--bone-50)',
            }}
          >
            {pending.length}
          </motion.span>
        )}
      </motion.div>

      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheetOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 190,
              background: 'rgba(6,5,8,0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={M.ember}
              onClick={(e) => e.stopPropagation()}
              className="glass strong"
              style={{
                width: '100%', maxWidth: 400,
                padding: 26,
                borderRadius: 'var(--r-2xl)',
                textAlign: 'center',
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <GiftIcon hasPending={hasPending} size={90} />
              </div>

              <h2 className="display" style={{ fontSize: 24, marginBottom: 6 }}>
                Say the words to claim
              </h2>
              <p className="tiny" style={{ marginBottom: 22 }}>
                Enter a gift code or tap a pending gift below.
              </p>

              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 16))}
                onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }}
                placeholder="FIRE42"
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: 'rgba(6,5,8,.55)',
                  border: '1.5px solid var(--glass-brd)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 20,
                  letterSpacing: '0.16em',
                  textAlign: 'center',
                  color: 'var(--bone-50)',
                  textTransform: 'uppercase',
                  outline: 'none',
                }}
              />

              <button
                onClick={() => redeem()}
                disabled={busy || code.trim().length < 4}
                style={{
                  marginTop: 16,
                  width: '100%',
                  padding: 14,
                  borderRadius: 999,
                  background: 'linear-gradient(180deg, var(--ember-400), var(--ember-600))',
                  color: '#1a0b02',
                  fontWeight: 700,
                  fontSize: 15,
                  border: '1px solid rgba(255,131,36,0.55)',
                  boxShadow: 'var(--sh-ember)',
                  opacity: (busy || code.trim().length < 4) ? 0.5 : 1,
                  cursor: 'pointer',
                }}
              >
                {busy ? 'Claiming…' : 'Redeem'}
              </button>

              {hasPending && (
                <div style={{ marginTop: 22, textAlign: 'left' }}>
                  <b className="tiny" style={{
                    display: 'block', marginBottom: 10,
                    textTransform: 'uppercase', letterSpacing: '0.10em',
                  }}>
                    Pending gifts
                  </b>
                  {pending.map((p) => (
                    <div key={p.code} className="row between" style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(255,243,208,.04)',
                      border: '1px solid rgba(239,193,104,.22)',
                      marginBottom: 8,
                    }}>
                      <div className="col" style={{ gap: 2 }}>
                        <b style={{ fontSize: 13 }}>{p.note || p.code}</b>
                        <span className="tiny mono" style={{ color: 'var(--gold-300)' }}>{p.code}</span>
                      </div>
                      <button
                        onClick={() => redeem(p.code)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 999,
                          background: 'linear-gradient(180deg, var(--gold-300), var(--gold-500))',
                          color: '#1f1403',
                          fontWeight: 700,
                          fontSize: 12,
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        Claim
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function GiftIcon({ hasPending, size = 60 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="gb1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8324" />
          <stop offset="1" stopColor="#8f3402" />
        </linearGradient>
        <linearGradient id="gb2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#efc168" />
          <stop offset="1" stopColor="#8a5e19" />
        </linearGradient>
      </defs>
      <rect x="8" y="24" width="48" height="34" rx="4" fill="url(#gb1)" stroke="#0b0a10" strokeWidth="1.5" />
      <motion.g
        animate={{ y: [0, -1.5, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <rect x="4" y="16" width="56" height="12" rx="3" fill="url(#gb2)" stroke="#0b0a10" strokeWidth="1.5" />
        <ellipse cx="24" cy="12" rx="7" ry="5" fill="url(#gb2)" />
        <ellipse cx="40" cy="12" rx="7" ry="5" fill="url(#gb2)" />
        <circle cx="32" cy="12" r="3.5" fill="#fff3d0" />
      </motion.g>
      <rect x="30" y="24" width="4" height="34" fill="#efc168" opacity="0.85" />
      <motion.g
        animate={{ scaleY: [1, 1, 0.15, 1, 1] }}
        transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.4, 0.45, 0.5, 1] }}
        style={{ transformOrigin: 'center' }}
      >
        <circle cx="24" cy="40" r="2.6" fill="#0b0a10" />
        <circle cx="40" cy="40" r="2.6" fill="#0b0a10" />
        <circle cx="25" cy="39" r="0.9" fill="#fff3d0" />
        <circle cx="41" cy="39" r="0.9" fill="#fff3d0" />
      </motion.g>
      <motion.path
        d="M25 48 Q32 53 39 48"
        stroke="#0b0a10"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        animate={{ d: ['M25 48 Q32 53 39 48', 'M25 47 Q32 54 39 47', 'M25 48 Q32 53 39 48'] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </svg>
  );
}