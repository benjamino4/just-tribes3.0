import React, { useState } from 'react';
import { motion } from 'framer-motion';
import Icon from '../../components/Icon.jsx';
import { Button } from '../../components/UI.jsx';
import { haptic } from '../../lib/telegram.js';

// Free 5 emojis + Star-locked sets. Admins can retune prices inline.
export default function EmojiPicker({ cfg, owned, stars, onPick, onUnlock, onEditPrice }) {
  const [admin, setAdmin] = useState(false);
  return (
    <div className="col" style={{ gap: 16 }}>
      <div>
        <span className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>Free</span>
        <div className="emoji-grid">
          {cfg.freeEmojis.map((e) => (
            <motion.button key={e} whileTap={{ scale: 0.8 }} className="emoji-cell" onClick={() => { haptic('select'); onPick(e); }}>{e}</motion.button>
          ))}
        </div>
      </div>

      {cfg.emojiSets.map((set) => {
        const unlocked = owned.includes(set.id);
        return (
          <div key={set.id}>
            <div className="row between">
              <span className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>{set.name}</span>
              {!unlocked && <span className="chip" style={{ color: 'var(--gold)' }}><Icon name="spark" size={12} style={{ color: 'var(--gold)' }} /> {set.price}</span>}
            </div>
            <div style={{ position: 'relative' }}>
              <div className="emoji-grid" style={{ filter: unlocked ? 'none' : 'blur(3px)', opacity: unlocked ? 1 : 0.5, pointerEvents: unlocked ? 'auto' : 'none' }}>
                {set.emojis.map((e) => (
                  <motion.button key={e} whileTap={{ scale: 0.8 }} className="emoji-cell" onClick={() => { haptic('select'); onPick(e); }}>{e}</motion.button>
                ))}
              </div>
              {!unlocked && (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                  <Button variant="primary" onClick={() => onUnlock(set)}><Icon name="lock" size={14} /> Unlock · {set.price} ⭐</Button>
                </div>
              )}
            </div>
            {admin && (
              <div className="row" style={{ gap: 8, marginTop: 8 }}>
                <span className="tiny">Price</span>
                <input type="number" defaultValue={set.price} onChange={(e) => onEditPrice(set.id, Number(e.target.value) || 0)}
                  style={{ width: 90, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }} />
              </div>
            )}
          </div>
        );
      })}

      <button className="tiny" style={{ alignSelf: 'flex-start', color: 'var(--ink-faint)', background: 'none' }} onClick={() => setAdmin((a) => !a)}>{admin ? 'Hide' : 'Admin: edit prices'}</button>
    </div>
  );
}
