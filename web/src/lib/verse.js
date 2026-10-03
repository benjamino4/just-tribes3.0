// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/verse.js
// PURPOSE: Generate contextual startup verses. Never the same twice.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
const VERBS = ['Feed', 'Wake', 'Raise', 'Stoke', 'Tend', 'Guard', 'Forge', 'Hold', 'Hunt', 'Rise',
  'Gather', 'Sing', 'Burn', 'Wait', 'Follow', 'Lead', 'Remember', 'Forget'];
const NOUNS = ['fire', 'tribe', 'ash', 'kin', 'banner', 'blade', 'stone', 'mountain', 'river',
  'forest', 'ember', 'rune', 'winter', 'dawn', 'dusk', 'shadow', 'light', 'war', 'peace',
  'blood', 'bone', 'oath', 'hall', 'hearth', 'drum', 'horn', 'mask', 'spear', 'shield',
  'crown', 'chief', 'warrior'];
const ADJS = ['cold', 'warm', 'old', 'young', 'dark', 'bright', 'sharp', 'dull', 'faint',
  'fierce', 'quiet', 'loud', 'hidden', 'sacred', 'forgotten', 'eternal', 'fleeting'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function template() {
  const r = Math.random();
  if (r < 0.25) return () => `${cap(pick(VERBS))} the ${pick(NOUNS)}.`;
  if (r < 0.45) return () => `${cap(pick(ADJS))} ${pick(NOUNS)}, ${pick(ADJS)} ${pick(NOUNS)}.`;
  if (r < 0.65) return () => `The ${pick(NOUNS)} ${pick(['remembers', 'waits', 'calls', 'burns'])}.`;
  if (r < 0.80) return () => `${cap(pick(VERBS))} from the ${pick(NOUNS)}.`;
  if (r < 0.90) return () => `${cap(pick(NOUNS))} is ${pick(ADJS)}.`;
  return () => `${cap(pick(VERBS))} bright, fade slow.`;
}

function biasFor(state) {
  if (!state) return null;
  if (state.war?.war) return ['blade', 'blood', 'war', 'shield', 'oath'];
  if (state.user?.streak > 7) return ['fire', 'ember', 'hearth', 'eternal'];
  if (!state.tribe) return ['dawn', 'rise', 'mountain', 'shadow'];
  if (state.user?.streak === 0) return ['ash', 'cold', 'waiting', 'silence'];
  return null;
}

export function generateVerse(state) {
  const bias = biasFor(state);
  const tpl = template();
  if (bias && Math.random() < 0.5) {
    const b = bias[Math.floor(Math.random() * bias.length)];
    const r = Math.random();
    if (r < 0.5) return `${cap(pick(VERBS))} the ${b}.`;
    return `The ${b} ${pick(['remembers', 'waits', 'calls', 'burns'])}.`;
  }
  return tpl();
}