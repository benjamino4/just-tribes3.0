export const GAMES = {
  reflex:     { slug: 'reflex',     name: 'Ember Reflex',    archetype: 'reaction',  material: 'ember' },
  cascade:    { slug: 'cascade',    name: 'Cascade',         archetype: 'reaction',  material: 'ember' },
  ancestor:   { slug: 'ancestor',   name: 'Ancestor Memory', archetype: 'memory',    material: 'bone'  },
  rune:       { slug: 'rune',       name: 'Missing Rune',    archetype: 'memory',    material: 'frost' },
  hands:      { slug: 'hands',      name: 'Rite of Hands',   archetype: 'choice',    material: 'metal' },
  bid:        { slug: 'bid',        name: 'Bid or Fold',     archetype: 'choice',    material: 'clay'  },
  chain:      { slug: 'chain',      name: 'Chain of Fire',   archetype: 'sequence',  material: 'ember' },
  masks:      { slug: 'masks',      name: 'Three Masks',     archetype: 'deduction', material: 'bone'  }
};

export const ARCHETYPE_GAMES = {
  reaction:  ['reflex', 'cascade'],
  memory:    ['ancestor', 'rune'],
  choice:    ['hands', 'bid'],
  sequence:  ['chain'],
  deduction: ['masks']
};

export function pickGameForArchetypeWeights(weights) {
  const entries = Object.entries(weights).filter(([, w]) => w > 0);
  if (!entries.length) return 'reflex';
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  let chosen = entries[0][0];
  for (const [arch, w] of entries) {
    roll -= w;
    if (roll <= 0) { chosen = arch; break; }
  }
  const pool = ARCHETYPE_GAMES[chosen] || ['reflex'];
  return pool[Math.floor(Math.random() * pool.length)];
}