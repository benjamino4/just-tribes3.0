import { motion } from 'framer-motion';

export default function RankMedallion({ tier, rating, size = 80 }) {
  const color = tier?.color_hex || '#c9d4e0';
  return (
    <motion.div
      className="rank-medallion"
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 25%, ${color}, #0f141c 70%)`,
        border: `2px solid ${color}`,
        boxShadow: `0 0 30px ${color}66, inset 0 2px 4px rgba(255,255,255,0.2)`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative'
      }}
    >
      <div style={{ fontSize: size * 0.35 }}>{tier?.emoji || '🔥'}</div>
      <div style={{
        fontSize: size * 0.15, fontWeight: 800,
        color: '#c9d4e0', fontFamily: 'var(--font-mono)',
        marginTop: 2
      }}>#{rating}</div>
    </motion.div>
  );
}