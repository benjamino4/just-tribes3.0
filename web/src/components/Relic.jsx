// TRIBES-FILE: web/src/components/Relic.jsx
// PHASE: 4 — Relics
// The relic card primitive. Rarity frames, cursed ripple overlay,
// wielded chip, art fallback chain (svg → image_url → icon_file → glyph).

import { motion } from 'framer-motion';
import { RARITY_TONE, RARITY_LABEL, DOMAIN_GLYPH } from '../data/relics.js';
import { useMotionConfig } from '../lib/motion.js';
import Icon from './Icon.jsx';

function artHtml(r) {
  if (r.svg) return r.svg;
  const src = r.image_url || (r.icon_file ? `/assets/relics/${r.icon_file}` : '');
  if (src) return `<img src="${src}" alt="" loading="lazy" />`;
  return `<span class="relic-card-glyph">${DOMAIN_GLYPH[r.domain] || '🏺'}</span>`;
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
          animate={{
            opacity: [0.35, 0.65, 0.35],
          }}
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

function RARITY_ORDER_SAFE(r) {
  const s = String(r || 'common');
  return ['common', 'rare', 'epic', 'legendary'].includes(s) ? s : 'common';
}