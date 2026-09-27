// =====================================================================
// Hint — the glowing bulb popover.
// Now portals to body so it can never be clipped by a parent's
// overflow:hidden or stray off-screen near a row edge.
// Only one Hint can be open at a time via a shared context.
// =====================================================================
import { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';

// Shared "which hint is open" state so only one at a time.
const HintCtx = createContext(null);

export function HintProvider({ children }) {
  const [openId, setOpenId] = useState(null);
  return (
    <HintCtx.Provider value={{ openId, setOpenId }}>{children}</HintCtx.Provider>
  );
}

let hintIdSeq = 0;

export default function Hint({ text, tone = '#e8b866' }) {
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
    const W = 260;
    const PAD = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Prefer below-right, flip when not enough room
    let top = rect.bottom + 8;
    let left = rect.right - W;
    if (left < PAD) left = PAD;
    if (left + W > vw - PAD) left = vw - W - PAD;

    // If not enough space below, flip above
    const estimatedH = 160;
    if (top + estimatedH > vh - PAD) {
      top = rect.top - estimatedH - 8;
      if (top < PAD) top = PAD;
    }

    setPos({ top, left, W });
  }, []);

  // Recompute when opening, on scroll, and on resize
  useEffect(() => {
    if (!isOpen) return;
    computePosition();

    let raf = 0;
    const onScrollOrResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(computePosition);
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [isOpen, computePosition]);

  // ESC dismiss
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') ctx?.setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, ctx]);

  const toggle = () => {
    haptic('light');
    if (isOpen) ctx?.setOpenId(null);
    else ctx?.setOpenId(idRef.current);
  };

  const close = () => ctx?.setOpenId(null);

  return (
    <>
      <span ref={anchorRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <motion.button
          aria-label="Hint"
          onClick={toggle}
          whileTap={{ scale: 0.85 }}
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            display: 'grid',
            placeItems: 'center',
            background: 'rgba(255,255,255,.06)',
            border: '1px solid var(--glass-brd)',
          }}
        >
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={tone}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{
              filter: [
                `drop-shadow(0 0 0px ${tone})`,
                `drop-shadow(0 0 5px ${tone})`,
                `drop-shadow(0 0 0px ${tone})`,
              ],
            }}
            transition={{ duration: 2, repeat: M.drift.repeat || 0 }}
          >
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" />
          </motion.svg>
        </motion.button>
      </span>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {isOpen && pos && (
              <>
                {/* click-away layer */}
                <div
                  onClick={close}
                  style={{ position: 'fixed', inset: 0, zIndex: 900 }}
                />
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={M.tactile}
                  className="glass strong"
                  style={{
                    position: 'fixed',
                    top: pos.top,
                    left: pos.left,
                    width: pos.W,
                    maxWidth: 'calc(100vw - 24px)',
                    zIndex: 901,
                    padding: '12px 14px',
                    borderRadius: 'var(--r-md)',
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    color: 'var(--ink-dim)',
                    borderColor: 'rgba(239,193,104,0.24)',
                    boxShadow:
                      '0 20px 50px rgba(0,0,0,.7), 0 0 0 1px rgba(239,193,104,0.10), inset 0 1px 0 var(--glass-hi)',
                  }}
                >
                  <b
                    style={{
                      color: 'var(--gold-300)',
                      display: 'block',
                      marginBottom: 3,
                      fontSize: 12,
                    }}
                  >
                    What is this?
                  </b>
                  {text}
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}