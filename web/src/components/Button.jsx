// =====================================================================
// Button — Obsidian Glass v3
// 4 variants (primary / gold / ghost / danger). Press ripple from
// click coords. Haptic on click.
// =====================================================================
import { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';

export default function Button({
  children,
  variant = '',
  size = '',
  block,
  haptic: hKind = 'medium',
  onClick,
  ...rest
}) {
  const M = useMotionConfig();
  const ref = useRef(null);

  const handleClick = useCallback((e) => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const x = ((e.clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width;
      const y = ((e.clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height;
      ref.current.style.setProperty('--press-x', `${x * 100}%`);
      ref.current.style.setProperty('--press-y', `${y * 100}%`);
    }
    haptic(hKind);
    onClick?.(e);
  }, [hKind, onClick]);

  return (
    <motion.button
      ref={ref}
      className={`btn ${variant} ${size} ${block ? 'block' : ''}`}
      whileTap={{ scale: 0.965 }}
      transition={M.tactile}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </motion.button>
  );
}