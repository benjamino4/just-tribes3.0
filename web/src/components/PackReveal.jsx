// TRIBES-FILE: web/src/components/PackReveal.jsx
// PHASE: 4 — Relics
// The flagship 5-phase pack reveal.
//   Phase 1 (0–800ms)   Offering — pack descends, glows
//   Phase 2 (800–1600)  Break    — shake, chains snap, screen darkens
//   Phase 3 (1600–2600) Reveal   — shatter particles, card flies toward camera
//   Phase 4 (2600–3400) Settle   — card rotates into place, rarity flourish
//   Phase 5 (3400+)     Offer    — Claim / Share buttons
// Presets: ember | cursed | shards | goldburst (matches DB `anim_preset`).

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RARITY_TONE, RARITY_LABEL, ANIM_PRESETS } from '../data/relics.js';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import Button from './Button.jsx';
import Emoji from './Emoji.jsx';

const PHASES = { IDLE: 0, OFFER: 1, BREAK: 2, REVEAL: 3, SETTLE: 4, OFFER_FINAL: 5 };

export default function PackReveal({ open, relic, rarity, preset = 'ember', onClaim, onShare, onClose }) {
  const M = useMotionConfig();
  const [phase, setPhase] = useState(PHASES.IDLE);
  const p = ANIM_PRESETS[preset] || ANIM_PRESETS.ember;
  const tone = RARITY_TONE[rarity] || p.primary;

  useEffect(() => {
    if (!open) { setPhase(PHASES.IDLE); return; }
    setPhase(PHASES.OFFER);
    const t1 = setTimeout(() => { setPhase(PHASES.BREAK); haptic('heavy'); }, 800);
    const t2 = setTimeout(() => { setPhase(PHASES.REVEAL); haptic('heavy'); }, 1600);
    const t3 = setTimeout(() => { setPhase(PHASES.SETTLE); haptic('success'); }, 2600);
    const t4 = setTimeout(() => setPhase(PHASES.OFFER_FINAL), 3400);
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, [open]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={phase === PHASES.OFFER_FINAL ? onClose : undefined}
        style={{
          position: 'fixed', inset: 0, zIndex: 130,
          background: 'radial-gradient(circle at 50% 45%, rgba(6,5,8,.72), rgba(6,5,8,.96))',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'grid', placeItems: 'center',
          padding: 20,
        }}
      >
        {/* spotlight */}
        <motion.div
          animate={{ opacity: phase >= PHASES.BREAK ? 0.85 : 0.35 }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute', width: 420, height: 420,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${p.primary}44, transparent 65%)`,
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', width: 320, textAlign: 'center' }}>

          {/* ---------- phases 1–2: the pack itself ---------- */}
          <AnimatePresence mode="wait">
            {phase < PHASES.REVEAL && (
              <motion.div
                key="pack"
                initial={{ y: -60, opacity: 0, scale: 0.6 }}
                animate={{
                  y: 0, opacity: 1, scale: 1,
                  rotate: phase === PHASES.BREAK ? [-6, 6, -6, 6, 0] : 0,
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={phase === PHASES.BREAK ? { duration: 1.5 } : M.ember}
                style={{
                  width: 160, height: 200, margin: '0 auto',
                  borderRadius: 22,
                  display: 'grid', placeItems: 'center',
                  background: `radial-gradient(circle at 35% 25%, ${p.primary}, ${p.secondary})`,
                  boxShadow: `0 20px 60px ${p.primary}66, inset 0 2px 0 rgba(255,255,255,.3)`,
                }}
              >
                <PackSigil preset={preset} />
                {phase === PHASES.BREAK && <Chains color={p.primary} />}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ---------- phases 3–5: the card ---------- */}
          <AnimatePresence>
            {phase >= PHASES.REVEAL && relic && (
              <>
                <Particles tone={tone} />

                <motion.div
                  key="relic"
                  initial={{ scale: 0.4, rotate: -30, opacity: 0 }}
                  animate={{
                    scale: phase >= PHASES.SETTLE ? 1 : 1.15,
                    rotate: 0,
                    opacity: 1,
                    y: 0,
                  }}
                  transition={M.ember}
                  style={{
                    width: 220, margin: '0 auto',
                    borderRadius: 20,
                    padding: 14,
                    background: `radial-gradient(circle at 30% 25%, ${tone}, ${p.secondary})`,
                    boxShadow: `0 20px 60px ${tone}88, inset 0 2px 0 rgba(255,255,255,.35)`,
                  }}
                >
                  <div style={{
                    width: '100%', aspectRatio: '1 / 1',
                    borderRadius: 14,
                    background: 'rgba(6,5,8,.42)',
                    display: 'grid', placeItems: 'center',
                  }}>
                    {relic.svg ? (
                      <div
                        dangerouslySetInnerHTML={{ __html: relic.svg }}
                        style={{ width: '75%', height: '75%' }}
                      />
                    ) : (
                      <Emoji
                        name={relic.domain ? `dom-${relic.domain}` : 'relic-vase'}
                        size={100}
                      />
                    )}
                  </div>
                </motion.div>

                {/* rarity chip */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, ...M.buoyant }}
                  style={{ marginTop: 20 }}
                >
                  <span style={{
                    display: 'inline-block',
                    fontSize: 11,
                    letterSpacing: '.18em',
                    textTransform: 'uppercase',
                    fontWeight: 800,
                    padding: '6px 14px',
                    borderRadius: 999,
                    color: '#1a0b02',
                    background: `linear-gradient(90deg, ${tone}, ${p.primary})`,
                    boxShadow: `0 6px 22px ${tone}66`,
                  }}>
                    {RARITY_LABEL[rarity] || rarity}
                  </span>
                </motion.div>

                <motion.h2
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, ...M.buoyant }}
                  className="display"
                  style={{ fontSize: 24, marginTop: 14, color: '#fff' }}
                >
                  {relic.name}
                </motion.h2>

                {relic.description && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45, duration: 0.5 }}
                    className="tiny"
                    style={{ marginTop: 6, maxWidth: 280, marginLeft: 'auto', marginRight: 'auto' }}
                  >
                    {relic.description}
                  </motion.p>
                )}

                <AnimatePresence>
                  {phase === PHASES.OFFER_FINAL && (
                    <motion.div
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...M.buoyant, delay: 0.2 }}
                      style={{ marginTop: 24, display: 'flex', gap: 10 }}
                    >
                      <Button variant="ghost" block onClick={onShare}>Share</Button>
                      <Button variant="primary" block onClick={onClaim}>Claim</Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------- pack sigil ---------- */
function PackSigil({ preset }) {
  const map = {
    ember:     'dom-fire',
    cursed:    'curse-key',
    shards:    'ice_crystal',
    goldburst: 'star',
    molten:    'dom-fire',
  };
  return <Emoji name={map[preset] || 'dom-fire'} size={72} />;
}

/* ---------- chains (cursed pack only) ---------- */
function Chains({ color }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: 120 + i * 20, x: (i - 1.5) * 40 }}
          transition={{ duration: 0.8, delay: i * 0.08 }}
          style={{
            position: 'absolute',
            width: 8, height: 40,
            borderRadius: 4,
            background: `linear-gradient(180deg, ${color}, ${color}44)`,
            top: 40 + i * 30,
            left: '50%',
            pointerEvents: 'none',
          }}
        />
      ))}
    </>
  );
}

/* ---------- particles ---------- */
function Particles({ tone }) {
  const M = useMotionConfig();
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    angle: Math.random() * Math.PI * 2,
    dist: 80 + Math.random() * 220,
    size: 3 + Math.random() * 5,
    dur: 0.9 + Math.random() * 0.5,
  }));

  return (
    <div style={{
      position: 'absolute', inset: 0,
      pointerEvents: 'none', overflow: 'hidden',
    }}>
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{
            x: Math.cos(p.angle) * p.dist,
            y: Math.sin(p.angle) * p.dist,
            opacity: 0,
            scale: 0.2,
          }}
          transition={{ duration: p.dur, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute',
            left: '50%', top: '40%',
            width: p.size, height: p.size,
            borderRadius: '50%',
            background: `radial-gradient(circle, #fff, ${tone})`,
            boxShadow: `0 0 10px ${tone}`,
          }}
        />
      ))}
    </div>
  );
}
