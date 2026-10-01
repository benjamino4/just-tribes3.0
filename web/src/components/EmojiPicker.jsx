import { useState } from 'react';
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from './Icon.jsx';
import Button from './Button.jsx';
import Emoji from './Emoji.jsx';
import { toast } from './Toast.jsx';
import { useEmojiRegistry } from '../lib/emojiRegistry.jsx';

export default function EmojiPicker({ open, onClose, onPick }) {
  const M = useMotionConfig();
  const { sets, reload } = useEmojiRegistry();
  const [busy, setBusy] = useState(false);

  async function unlock(slug) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiPost('/api/emoji/unlock', { slug });
      if (r.blessed) toast('Unlocked (blessing)', 'good'); else toast('Unlocked', 'good');
      await reload();
    } catch (e) {
      if (e.data?.need) toast(`Not enough Stars · ${e.data.need}`, 'bad');
      else toast(e.message || 'Could not unlock', 'bad');
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 110,
        background: 'rgba(6,5,8,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center'
      }}
    >
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={M.buoyant}
        onClick={(e) => e.stopPropagation()}
        className="glass strong"
        style={{
          width: '100%', maxWidth: 'var(--maxw)',
          borderRadius: 'var(--r-2xl) var(--r-2xl) 0 0',
          padding: '12px 20px calc(var(--safe-bot) + 22px)',
          maxHeight: '88vh', overflowY: 'auto'
        }}
      >
        <div style={{ width: 52, height: 4, borderRadius: 99, background: 'linear-gradient(90deg, transparent, var(--gold-400), transparent)', margin: '0 auto 16px' }} />
        <h2 className="display" style={{ fontSize: 22, marginBottom: 16 }}>Choose an Emoji</h2>
        {!sets.length && <p className="muted">Loading…</p>}
        {sets.map((s) => (
          <div key={s.slug} style={{ marginBottom: 18 }}>
            <div className="row between" style={{ marginBottom: 10 }}>
              <div className="col" style={{ gap: 1 }}>
                <b style={{ fontSize: 14 }}>{s.name}</b>
                <span className="tiny">{s.description}</span>
              </div>
              {!s.unlocked && (
                <span className="chip gold">
                  <Icon name="star" size={12} /> {s.price}
                </span>
              )}
            </div>
            <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              <div style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 8,
                filter: s.unlocked ? 'none' : 'blur(3px)',
                opacity: s.unlocked ? 1 : 0.5,
                pointerEvents: s.unlocked ? 'auto' : 'none'
              }}>
                {s.emojis.map((key) => (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.85 }}
                    className="emoji-cell"
                    onClick={() => { haptic('select'); onPick?.(key); onClose?.(); }}
                  >
                    <Emoji name={key} size={26} />
                  </motion.button>
                ))}
              </div>
              {!s.unlocked && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Button variant="primary" disabled={busy} onClick={() => unlock(s.slug)}>
                    <Icon name="lock" size={14} /> Unlock · {s.price}
                    <Emoji name="star" size={12} style={{ marginLeft: 4 }} />
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </motion.div>
    </motion.div>
  );
}