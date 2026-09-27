// TRIBES-FILE: web/src/components/Button.jsx
// PHASE: 2 — Identity & shell
// Tactile button. Ripple at the pointer origin + spring scale.
// variant: '' | 'primary' | 'ghost'
// size:    '' | 'lg'

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
    haptic(hKind);
    onClick?.(e);
  }, [hKind, onClick]);

  return (
    <motion.button
      ref={ref}
      className={`btn ${variant} ${size} ${block ? 'block' : ''}`}
      whileTap={{ scale: 0.955 }}
      transition={M.tactile}
      onClick={handleClick}
      {...rest}
    >
      {children}
    </motion.button>
  );
}