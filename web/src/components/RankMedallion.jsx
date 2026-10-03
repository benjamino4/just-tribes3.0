// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/RankMedallion.jsx
// PURPOSE: Live rank display. Nine tiers. Updates as rank changes.
// DEPENDS ON: store.jsx
// ═══════════════════════════════════════════════════════════════════
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';

export default function RankMedallion({ user, size = 32, showLabel = false }) {
  const M = useMotionConfig();
  if (!user) return null;
  const rating = Number(user.rank_rating || 1000);
  const tier = user.rank_tier || tierFromRating(rating);

  return (
    <motion.span
      className="rank-medallion"
      key={tier.slug}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={M.buoyant}
      title={`${tier.title} · ${rating}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle at 30% 25%, ${tier.color_hex}44, ${tier.color_hex}11)`,
        border: `1.5px solid ${tier.color_hex}`,
        boxShadow: `0 0 12px ${tier.color_hex}44, inset 0 1px 0 rgba(255,255,255,0.12)`,
        color: tier.color_hex,
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: size <= 24 ? 10 : 12
      }}
    >
      {tier.emoji || rating}
    </motion.span>
  );
}

function tierFromRating(rating) {
  if (rating >= 2500) return { slug: 'eternal',  name: 'Eternal',  title: 'Eternal Flame',   color_hex: '#fff3d0', emoji: '🔥' };
  if (rating >= 2200) return { slug: 'obsidian', name: 'Obsidian', title: 'Obsidian King',   color_hex: '#2a2735', emoji: '⚫' };
  if (rating >= 2000) return { slug: 'gold',     name: 'Gold',     title: 'Gold Warlord',    color_hex: '#efc168', emoji: '🟡' };
  if (rating >= 1800) return { slug: 'silver',   name: 'Silver',   title: 'Silver Chieftain',color_hex: '#c9d4e0', emoji: '⚪' };
  if (rating >= 1600) return { slug: 'copper',   name: 'Copper',   title: 'Copper Chief',    color_hex: '#c08a4a', emoji: '🟠' };
  if (rating >= 1400) return { slug: 'jade',     name: 'Jade',     title: 'Jade Warrior',    color_hex: '#55a882', emoji: '💚' };
  if (rating >= 1200) return { slug: 'stone',    name: 'Stone',    title: 'Stone Setter',    color_hex: '#6a6a72', emoji: '⬛' };
  if (rating >= 1000) return { slug: 'flint',    name: 'Flint',    title: 'Flint Knapper',   color_hex: '#8899aa', emoji: '🪨' };
  return { slug: 'bone', name: 'Bone', title: 'Bone Carver', color_hex: '#b0a080', emoji: '🦴' };
}