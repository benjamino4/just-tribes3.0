import { motion, AnimatePresence } from 'framer-motion';
import Emoji from './Emoji.jsx';

const RULES = {
  reflex:   { name: 'Ember Reflex',    demo: 'reaction', line: 'Tap the fire as soon as it lights.', body: 'Five rounds. Faster reactions score higher.' },
  cascade:  { name: 'Cascade',         demo: 'reaction', line: 'Tap the lights in the order they appeared.', body: 'Wrong tap restarts the round.' },
  ancestor: { name: 'Ancestor Memory', demo: 'memory',   line: 'Repeat the emoji sequence.', body: 'The sequence grows each round.' },
  rune:     { name: 'Missing Rune',    demo: 'memory',   line: 'Name the missing rune.', body: 'A ring pulses, one is removed, you pick.' },
  hands:    { name: 'Rite of Hands',   demo: 'choice',   line: 'Read their pattern, beat their throw.', body: 'Best of 5. You see the last 5 throws.' },
  bid:      { name: 'Bid or Fold',     demo: 'choice',   line: 'Bid more than them or fold.', body: 'First to 5 coins wins.' },
  chain:    { name: 'Chain of Fire',   demo: 'sequence', line: 'Keep the chain alive.', body: 'If you cannot move, you lose.' },
  masks:    { name: 'Three Masks',     demo: 'deduction',line: 'Guess their mask.', body: 'Best of 3 rounds.' }
};

export default function RulesOverlay({ slug, open, onClose }) {
  const r = RULES[slug] || RULES.reflex;
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
            <Emoji name="reaction-fire" size={64} />
          </div>
          <h3 className="display" style={{ fontSize: 20, marginBottom: 6 }}>{r.name}</h3>
          <p style={{ fontSize: 14, marginBottom: 8 }}>{r.line}</p>
          <p className="tiny" style={{ marginBottom: 20 }}>{r.body}</p>
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: 14, borderRadius: 999,
              background: 'linear-gradient(180deg, var(--ember-400), var(--ember-600))',
              color: '#1a0b02', fontWeight: 800, fontSize: 15,
              border: '1px solid rgba(255,131,36,.55)', boxShadow: 'var(--sh-ember)'
            }}
          >Got it</button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}