// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/RulesOverlay.jsx
// PURPOSE: First-time rules. Shows before a game. Never shows twice.
// DEPENDS ON: RULES data, Emoji
// ═══════════════════════════════════════════════════════════════════
import { motion, AnimatePresence } from 'framer-motion';
import Emoji from './Emoji.jsx';
import { RULES as ALL_RULES } from '../data/games.js';

const ICON_FOR = {
  rune_match: 'relic-vase',
  stone_stack: 'dom-bone',
  fireflies: 'flame_flicker',
  rite_hands: 'reaction-swords',
  ember_flow: 'rune_draw',
  stone_sort: 'dom-ash',
  bid_fold: 'flame_flicker',
  three_masks: 'eye_blink',
  chain_fire: 'flame_flicker',
  ember_cascade: 'flame_flicker',
  rune_line: 'rune_draw',
  rune_bloom: 'halo_glow'
};

export default function RulesOverlay({ slug, open, onClose }) {
  const r = ALL_RULES[slug] || ALL_RULES.rune_match;
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(6,5,8,.82)', backdropFilter: 'blur(8px)',
          display: 'grid', placeItems: 'center', padding: 24
        }}
      >
        <motion.div
          initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="glass strong"
          style={{ padding: 26, borderRadius: 'var(--r-2xl)', width: 320, maxWidth: '92vw', textAlign: 'center' }}
        >
          <div style={{ marginBottom: 14 }}>
            <Emoji name={ICON_FOR[slug] || 'flame_flicker'} size={64} />
          </div>
          <h3 className="display" style={{ fontSize: 20, marginBottom: 6 }}>{r.name}</h3>
          <p style={{ fontSize: 14, marginBottom: 8 }}>{r.line}</p>
          <p className="tiny" style={{ marginBottom: 20 }}>{r.body}</p>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: 14, borderRadius: 999,
              background: 'linear-gradient(180deg, var(--ember-300), var(--ember-500))',
              color: '#1a0b02', fontWeight: 800, fontSize: 15,
              border: '1px solid rgba(255,199,138,.55)', boxShadow: 'var(--sh-ember)'
            }}
          >Got it</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}