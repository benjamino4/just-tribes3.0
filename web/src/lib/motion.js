import { useReducedMotion } from 'framer-motion';

export const SPRING = {
  feather: { type: 'spring', stiffness: 700, damping: 40, mass: 0.6 },
  tactile: { type: 'spring', stiffness: 480, damping: 34, mass: 1 },
  buoyant: { type: 'spring', stiffness: 320, damping: 30, mass: 1.1 },
  ember:   { type: 'spring', stiffness: 180, damping: 22, mass: 1.4, restDelta: 0.001 },
  drift:   { duration: 6, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }
};

export const EASE = {
  ember: [0.34, 1.3, 0.5, 1],
  heat:  [0.2, 0.8, 0.2, 1],
  soft:  [0.4, 0, 0.2, 1],
  snap:  [0.22, 1, 0.36, 1]
};

export function useMotionConfig() {
  const prefersReduced = useReducedMotion();
  const forcedReduced =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-fx') === 'reduced';
  const reduced = prefersReduced || forcedReduced;
  if (!reduced) return SPRING;
  const off = { duration: 0 };
  return { feather: off, tactile: off, buoyant: off, ember: off, drift: { duration: 0, repeat: 0 } };
}

export const V = {
  page:  { initial: { opacity: 0, y: 16, scale: 0.985 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: -10, scale: 0.99 } },
  item:  { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 } },
  toast: { initial: { opacity: 0, y: 24, scale: 0.9 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 10, scale: 0.95 } },
  hero:  { initial: { opacity: 0, scale: 0.6, rotate: -8 }, animate: { opacity: 1, scale: 1, rotate: 0 }, exit: { opacity: 0, scale: 0.8, rotate: 4 } },
  fade:  { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
};

export function staggerParent(stagger = 0.05, delayChildren = 0) {
  return { animate: { transition: { staggerChildren: stagger, delayChildren } } };
}