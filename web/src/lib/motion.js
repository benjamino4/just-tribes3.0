// =====================================================================
// TRIBES — Motion Bible
// Five semantic springs. Every animation names one of these.
// reducedData / data-fx="reduced" collapses every spring to duration:0
// via useMotionConfig(), so the reduced tier is honoured everywhere.
// =====================================================================

import { useReducedMotion } from 'framer-motion';
import { createContext, useContext } from 'react';

export const SPRING = {
  feather: { type:'spring', stiffness:700, damping:40, mass:0.6 },
  tactile: { type:'spring', stiffness:480, damping:34, mass:1 },
  buoyant: { type:'spring', stiffness:320, damping:30, mass:1.1 },
  ember:   { type:'spring', stiffness:180, damping:22, mass:1.4, restDelta:0.001 },
  drift:   { duration:6, repeat:Infinity, ease:[0.4,0,0.2,1] },
};

export const EASE = {
  ember: [0.34, 1.3, 0.5, 1],
  heat:  [0.2, 0.8, 0.2, 1],
  soft:  [0.4, 0, 0.2, 1],
  snap:  [0.22, 1, 0.36, 1],
};

export function useMotionConfig() {
  const prefersReduced = useReducedMotion();
  const forcedReduced =
    typeof document !== 'undefined' &&
    document.documentElement.getAttribute('data-fx') === 'reduced';
  const reduced = prefersReduced || forcedReduced;
  if (!reduced) return SPRING;
  const off = { duration: 0 };
  return { feather: off, tactile: off, buoyant: off, ember: off, drift: { duration:0, repeat:0 } };
}

export const V = {
  page:  { initial:{ opacity:0, y:16, scale:0.985 }, animate:{ opacity:1, y:0,  scale:1 },   exit:{ opacity:0, y:-10, scale:0.99 } },
  sheet: { initial:{ y:'100%' },                     animate:{ y:0 },                          exit:{ y:'100%' } },
  item:  { initial:{ opacity:0, y:12 },              animate:{ opacity:1, y:0 },               exit:{ opacity:0, y:-8 } },
  toast: { initial:{ opacity:0, y:24, scale:0.9 },   animate:{ opacity:1, y:0, scale:1 },      exit:{ opacity:0, y:10, scale:0.95 } },
  hero:  { initial:{ opacity:0, scale:0.6, rotate:-8 }, animate:{ opacity:1, scale:1, rotate:0 }, exit:{ opacity:0, scale:0.8, rotate:4 } },
  fade:  { initial:{ opacity:0 },                    animate:{ opacity:1 },                    exit:{ opacity:0 } },
};

export function staggerParent(stagger = 0.05, delayChildren = 0) {
  return { animate: { transition: { staggerChildren: stagger, delayChildren } } };
}

const MotionCtx = createContext(SPRING);
export function MotionProvider({ children }) {
  const M = useMotionConfig();
  return <MotionCtx.Provider value={M}>{children}</MotionCtx.Provider>;
}
export function useM() { return useContext(MotionCtx); }

export const SECTION_MOTION = {
  hearth:    { initial:{ opacity:0, y:20, scale:0.97 }, transition:'ember' },
  streak:    { initial:{ opacity:0, y:40 },             transition:'buoyant' },
  ash:       { initial:{ opacity:0, x:-30, y:-12 },     transition:'buoyant' },
  tasks:     { initial:{ opacity:0, x:-14 },            transition:'tactile' },
  trials:    { initial:{ opacity:0, scale:0.9 },        transition:'tactile' },
  spin:      { initial:{ opacity:0, rotate:-60, scale:0.85 }, transition:'ember' },
  kiva:      { initial:{ opacity:0, scaleY:0.6, originY:0 }, transition:'buoyant' },
  pyre:      { initial:{ opacity:0, scale:0.4 },        transition:'ember' },
  war:       { initial:{ opacity:0, y:60 },             transition:'ember' },
  pack:      { initial:{ opacity:0, scale:0.5, rotate:-12 }, transition:'ember' },
};

export const spring = SPRING.tactile;
export const smooth = SPRING.buoyant;
export const gentle = SPRING.ember;

export default { SPRING, EASE, V, SECTION_MOTION, staggerParent };
