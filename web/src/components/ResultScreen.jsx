import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { haptic } from '../lib/haptics.js';

// Lightweight ember/confetti burst for a win — pure CSS transforms, no libs.
function Embers({ win }) {
  const bits = useRef(
    Array.from({ length: win ? 26 : 0 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 320,
      y: -120 - Math.random() * 220,
      r: Math.random() * 360,
      s: 0.6 + Math.random() * 0.9,
      d: Math.random() * 0.3,
      c: ['#f7a259', '#ffd27a', '#ff8a3c', '#ffe9b8'][i % 4],
    }))
  ).current;
  return (
    <div className="res-embers" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: b.s, rotate: 0 }}
          animate={{ x: b.x, y: b.y, opacity: 0, rotate: b.r }}
          transition={{ duration: 1.3 + b.s, delay: b.d, ease: 'easeOut' }}
          style={{ background: b.c }}
        />
      ))}
    </div>
  );
}

function useCountUp(from, to, run, ms = 1100) {
  const [v, setV] = useState(from);
  useEffect(() => {
    if (!run) return;
    let raf, start;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to, run, ms]);
  return v;
}

export default function ResultScreen({ result, opponent, onClose }) {
  const won = !!result?.won;
  const casual = !!result?.casual;
  const rank = result?.rank;
  const [showRank, setShowRank] = useState(false);
  const rating = useCountUp(rank?.before ?? 0, rank?.after ?? 0, showRank, 1200);

  useEffect(() => {
    haptic(won ? 'success' : 'warn');
    const t = setTimeout(() => setShowRank(true), 700);
    return () => clearTimeout(t);
  }, []);

  const tier = rank?.tier || opponent?.tier;
  const delta = rank?.delta ?? 0;

  return (
    <motion.div className={`res-wrap ${won ? 'win' : 'lose'}`}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="res-glow" aria-hidden />
      <Embers win={won} />

      <motion.div className="res-banner"
        initial={{ scale: 0.4, y: -30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}>
        <span className="res-ribbon">{won ? '🔥' : '💨'}</span>
        <h1 className="res-title">{won ? 'VICTORY' : 'DEFEAT'}</h1>
        {casual && <span className="res-sub">Friendly match</span>}
      </motion.div>

      <motion.div className="res-score"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}>
        <div className="res-score-side">
          <span className="res-score-label">You</span>
          <b>{result?.score ?? 0}</b>
        </div>
        <span className="res-score-dash">—</span>
        <div className="res-score-side">
          <span className="res-score-label">{result?.opponent_name || opponent?.name || 'Rival'}</span>
          <b>{result?.opponent_score ?? 0}</b>
        </div>
      </motion.div>

      {!casual && rank && (
        <motion.div className="res-rank glass card"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}>
          <AnimatePresence>
            {rank.tier_changed && won && (
              <motion.div className="res-rankup"
                initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 1.2 }}>
                RANK UP!
              </motion.div>
            )}
          </AnimatePresence>
          <div className="row" style={{ gap: 12, alignItems: 'center' }}>
            <motion.span className="res-tier-crest"
              style={{ background: `radial-gradient(circle at 35% 25%, ${tier?.color_hex || '#f7a259'}, #5a3a12 72%)` }}
              animate={rank.tier_changed && won ? { scale: [1, 1.25, 1] } : {}}
              transition={{ delay: 1.2, duration: 0.6 }}>
              {tier?.emoji || '🏆'}
            </motion.span>
            <div className="grow" style={{ textAlign: 'left' }}>
              <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>
                {tier?.title || 'Rank'}
              </div>
              <div className="res-rating-row">
                <b className="tabular res-rating">{rating}</b>
                <motion.span className={`res-delta ${delta >= 0 ? 'up' : 'down'}`}
                  initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 }}>
                  {delta >= 0 ? `+${delta}` : delta}
                </motion.span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <motion.button className="btn primary block res-cta"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        onClick={() => { haptic('select'); onClose?.(); }}>
        Continue
      </motion.button>
    </motion.div>
  );
}
