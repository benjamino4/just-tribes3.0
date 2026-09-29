// TRIBES-FILE: web/src/data/relics.js
// PHASE: 4 — Relics
// Client-side constants mirrored from the server catalog for pre-load UI.

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_TONE = {
  common:    '#8f8577',
  rare:      '#5f92d4',
  epic:      '#a26cd1',
  legendary: '#efc168',
};

export const RARITY_LABEL = {
  common:    'Common',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
};

export const ANIM_PRESETS = {
  ember:     { primary: '#ff8324', secondary: '#8f3402', duration: 1600 },
  cursed:    { primary: '#a26cd1', secondary: '#4c1d95', duration: 2200 },
  shards:    { primary: '#5f92d4', secondary: '#1f3c62', duration: 1400 },
  goldburst: { primary: '#efc168', secondary: '#8a5e19', duration: 1800 },
  molten:    { primary: '#efc168', secondary: '#0b0a10', duration: 5200 },
};

export const FUSE_COST = 3;
