import { create } from 'zustand';

const KEY = 'tribes.settings';
const DEFAULTS = { animations: true, haptics: true, sound: false, reducedData: false };

function read() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch (e) { return { ...DEFAULTS }; }
}

export function applySettings(s) {
  // Animations OFF -> force the reduced-effects tier used across the CSS.
  document.documentElement.setAttribute('data-fx', s.animations ? 'full' : 'reduced');
  window.__hapticsEnabled = s.haptics;
  window.__soundEnabled = s.sound;
  window.__animEnabled = s.animations;
}

export const useSettings = create((set, get) => ({
  ...read(),
  set(patch) {
    const next = { ...get(), ...patch };
    delete next.set;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (e) {}
    applySettings(next);
    set(patch);
  },
}));

// Motion helper: components use this so “animations off” truly disables motion
// (not just visual FX). Returns transition config or an instant one.
export function motionCfg(spring = { type: 'spring', stiffness: 320, damping: 30 }) {
  return typeof window !== 'undefined' && window.__animEnabled === false
    ? { duration: 0 }
    : spring;
}
export function animEnabled() {
  return typeof window === 'undefined' || window.__animEnabled !== false;
}
