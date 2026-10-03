// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/configs.js
// PURPOSE: The 12 games. Each is a config. Reuses one of 5 archetype
//          engines. Adding a game = adding a line.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export const GAMES = {
  rune_match:    { slug: 'rune_match',    name: 'Rune Match',    archetype: 'match3',     engine: 'match3',     material: 'stone' },
  stone_stack:   { slug: 'stone_stack',   name: 'Stone Stack',   archetype: 'stacker',    engine: 'stacker',    material: 'clay' },
  fireflies:     { slug: 'fireflies',     name: 'Fireflies',     archetype: 'catcher',    engine: 'catcher',    material: 'ember' },
  rite_hands:    { slug: 'rite_hands',    name: 'Rite of Hands', archetype: 'choice',     engine: 'choice',     material: 'metal' },
  ember_flow:    { slug: 'ember_flow',    name: 'Ember Flow',    archetype: 'pathpuzzle', engine: 'pathpuzzle', material: 'frost' },
  stone_sort:    { slug: 'stone_sort',    name: 'Stone Sort',    archetype: 'sorter',     engine: 'sorter',     material: 'clay' },
  bid_fold:      { slug: 'bid_fold',      name: 'Bid or Fold',   archetype: 'choice',     engine: 'choice',     material: 'clay' },
  three_masks:   { slug: 'three_masks',   name: 'Three Masks',   archetype: 'deduction',  engine: 'deduction',  material: 'bone' },
  chain_fire:    { slug: 'chain_fire',    name: 'Chain of Fire', archetype: 'sequence',   engine: 'sequence',   material: 'ember' },
  ember_cascade: { slug: 'ember_cascade', name: 'Ember Cascade', archetype: 'falling',    engine: 'falling',    material: 'ember' },
  rune_line:     { slug: 'rune_line',     name: 'Rune Line',     archetype: 'one_stroke', engine: 'one_stroke', material: 'metal' },
  rune_bloom:    { slug: 'rune_bloom',    name: 'Rune Bloom',    archetype: 'bloom',      engine: 'bloom',      material: 'frost' }
};

export const ARCHETYPE_GAMES = {
  match3:     ['rune_match'],
  stacker:    ['stone_stack'],
  catcher:    ['fireflies'],
  choice:     ['rite_hands', 'bid_fold'],
  pathpuzzle: ['ember_flow'],
  sorter:     ['stone_sort'],
  deduction:  ['three_masks'],
  sequence:   ['chain_fire'],
  falling:    ['ember_cascade'],
  one_stroke: ['rune_line'],
  bloom:      ['rune_bloom']
};

// Legacy archetype buckets for scoring — some games map to broader families
export const SCORING_ARCHETYPE = {
  match3:     'reaction',
  stacker:    'reaction',
  catcher:    'reaction',
  choice:     'choice',
  pathpuzzle: 'sequence',
  sorter:     'memory',
  deduction:  'deduction',
  sequence:   'sequence',
  falling:    'reaction',
  one_stroke: 'memory',
  bloom:      'sequence'
};

export function pickGameForArchetypeWeights(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) return 'rune_match';
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  let chosen = entries[0][0];
  for (const [arch, w] of entries) {
    roll -= w;
    if (roll <= 0) { chosen = arch; break; }
  }
  const pool = ARCHETYPE_GAMES[chosen] || ['rune_match'];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickGameForTerrain(terrain, weightsByArch) {
  // weightsByArch is like { reaction: 60, choice: 25, ... }
  // Map to engine-level weights via SCORING_ARCHETYPE reverse
  const engineWeights = {};
  for (const [engine, arch] of Object.entries(SCORING_ARCHETYPE)) {
    engineWeights[engine] = (engineWeights[engine] || 0) + (weightsByArch[arch] || 0);
  }
  return pickGameForArchetypeWeights(engineWeights);
}