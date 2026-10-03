// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/Hint.jsx
// PURPOSE: Inline help bubble. Opens a popover with text and a link.
// DEPENDS ON: motion.js
// ═══════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import { Link } from 'react-router-dom';

const HintCtx = createContext(null);

export function HintProvider({ children }) {
  const [openId, setOpenId] = useState(null);
  return <HintCtx.Provider value={{ openId, setOpenId }}>{children}</HintCtx.Provider>;
}

let hintIdSeq = 0;

export default function Hint({ text, slug, tone = 'var(--gold-300)' }) {
  const ctx = useContext(HintCtx);
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = ++hintIdSeq;
  const [pos, setPos] = useState(null);
  const anchorRef = useRef(null);
  const M = useMotionConfig();
  const isOpen = ctx ? ctx.openId === idRef.current : false;

  const computePosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const W = 260, PAD = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top = rect.bottom + 8;
    let left = rect.right - W;
    if (left < PAD) left = PAD;
    if (left + W > vw - PAD) left = vw - W - PAD;
    const estimatedH = 200;
    if (top + estimatedH > vh - PAD) {
      top = rect.top - estimatedH - 8;
      if (top < PAD) top = PAD;
    }
    setPos({ top, left, W });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    computePosition();
    let raf = 0;
    const onScrollOrResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(computePosition); };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, computePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') ctx?.setOpenId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, ctx]);

  const toggle = () => {
    haptic('light');
    if (isOpen) ctx?.setOpenId(null);
    else ctx?.setOpenId(idRef.current);
  };

  return (
    <>
      <span ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <motion.button
          aria-label="Hint"
          onClick={toggle}
          whileTap={{ scale: 0.85 }}
          style={{
            width: 24, height: 24, borderRadius: 999,
            display: 'grid', placeItems: 'center',
            background: 'rgba(255,243,208,.06)',
            border: '1px solid var(--glass-brd)'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" />
          </svg>
        </motion.button>
      </span>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isOpen && pos && (
            <>
              <div onClick={() => ctx?.setOpenId(null)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={M.tactile}
                className="glass strong"
                style={{
                  position: 'fixed', top: pos.top, left: pos.left, width: pos.W,
                  maxWidth: 'calc(100vw - 24px)', zIndex: 901,
                  padding: '12px 14px', borderRadius: 'var(--r-md)',
                  fontSize: 12.5, lineHeight: 1.55, color: 'var(--ink-dim)',
                  borderColor: 'rgba(239,193,104,0.24)'
                }}
              >
                <b style={{ color: 'var(--gold-300)', display: 'block', marginBottom: 4, fontSize: 12, textTransform: 'uppercase' }}>What is this?</b>
                {text}
                {slug && (
                  <div style={{ marginTop: 8 }}>
                    <Link to={`/help/${slug}`} onClick={() => ctx?.setOpenId(null)} style={{ color: 'var(--ember-300)', fontSize: 12, fontWeight: 700 }}>
                      Learn more →
                    </Link>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}