// TRIBES-FILE: web/src/data/relics.js
// PHASE: 4 — Relics
// Client-side constants mirrored from the server catalog for pre-load UI.

export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_TONE = {
  common:    '#9fb0c4',
  rare:      '#7cc4ff',
  epic:      '#c39bff',
  legendary: '#ffd27a',
};

export const RARITY_LABEL = {
  common:    'Common',
  rare:      'Rare',
  epic:      'Epic',
  legendary: 'Legendary',
};

export const DOMAIN_GLYPH = {
  fire: '🔥',
  bone: '🦴',
  sun:  '☀️',
  moon: '🌙',
  ash:  '⚡',
};

export const ANIM_PRESETS = {
  ember:     { primary: '#ff9f45', secondary: '#c53a05', duration: 1600 },
  cursed:    { primary: '#8b5cf6', secondary: '#4c1d95', duration: 2200 },
  shards:    { primary: '#7cc4ff', secondary: '#2a5080', duration: 1400 },
  goldburst: { primary: '#ffd27a', secondary: '#c88a2a', duration: 1800 },
};

export const FUSE_COST = 3;