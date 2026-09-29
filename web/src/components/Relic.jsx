// TRIBES-FILE: web/src/components/Relic.jsx
// PHASE: 4 — Relics
// The relic card primitive. Rarity frames, cursed ripple overlay,
// wielded chip, art fallback chain (svg → image_url → icon_file → inline urn).

import { motion } from 'framer-motion';
import { RARITY_TONE, RARITY_LABEL } from '../data/relics.js';
import { useMotionConfig } from '../lib/motion.js';

function artHtml(r) {
  if (r.svg) return r.svg;
  const src = r.image_url || (r.icon_file ? `/assets/relics/${r.icon_file}` : '');
  if (src) return `<img src="${src}" alt="" loading="lazy" />`;
  return `<svg viewBox="0 0 24 24"><path fill="#c9a06a" d="M8 3h8l-1 3 3 6c1 3-1 8-6 9S5 15 6 12l3-6z"/><path d="M9 3h6" stroke="#8a5e19" stroke-width="1.4"/></svg>`;
}

function RARITY_ORDER_SAFE(r) {
  const s = String(r || 'common');
  return ['common', 'rare', 'epic', 'legendary'].includes(s) ? s : 'common';
}

export default function Relic({ relic, compact, onClick, equipped }) {
  const M = useMotionConfig();
  const rarity = RARITY_ORDER_SAFE(relic.rarity);
  const tone = RARITY_TONE[rarity];
  const cursed = !!relic.cursed;

  return (
    <motion.div
      className={`relic-card rc-${rarity}${cursed ? ' rc-cursed' : ''}`}
      onClick={onClick}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      transition={M.tactile}
      style={{
        position: 'relative',
        width: compact ? 160 : '100%',
        cursor: onClick ? 'pointer' : 'default',
        ['--tone']: tone,
      }}
    >
      <div className="relic-card-art" dangerouslySetInnerHTML={{ __html: artHtml(relic) }} />

      {cursed && (
        <motion.div
          className="relic-cursed-overlay"
          animate={{ opacity: [0.35, 0.65, 0.35] }}
          transition={{ duration: 2.4, repeat: M.drift.repeat || 0 }}
        />
      )}

      <div className="relic-card-body">
        <div className="relic-card-top">
          <span className="relic-card-name">{relic.name}</span>
          <span className="relic-card-rar">{RARITY_LABEL[rarity]}</span>
        </div>

        <div className="relic-card-tags">
          {relic.category && (
            <span className={`relic-tag dom-${relic.category}`}>{relic.category}</span>
          )}
          {cursed && <span className="relic-tag cursed">cursed</span>}
          {equipped && <span className="relic-tag equipped">wielded</span>}
        </div>

        {!compact && relic.description && (
          <p className="relic-card-desc">{relic.description}</p>
        )}

        {!compact && (
          <div className="relic-card-stat">
            <span>{relic.buff_type || 'none'}</span>
            {Number(relic.buff_value) > 0 && (
              <span>{Number(relic.buff_value).toFixed(2)}</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
