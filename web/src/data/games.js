// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/data/games.js
// PURPOSE: Game metadata for the client. Name, material, colors.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export const GAME_META = {
  rune_match:    { name: 'Rune Match',    material: 'stone', accent: '#8899aa' },
  stone_stack:   { name: 'Stone Stack',   material: 'clay',  accent: '#c08a4a' },
  fireflies:     { name: 'Fireflies',     material: 'ember', accent: '#ffcf7a' },
  rite_hands:    { name: 'Rite of Hands', material: 'metal', accent: '#cfd0d8' },
  ember_flow:    { name: 'Ember Flow',    material: 'frost', accent: '#7ea3c4' },
  stone_sort:    { name: 'Stone Sort',    material: 'clay',  accent: '#c08a4a' },
  bid_fold:      { name: 'Bid or Fold',   material: 'clay',  accent: '#c08a4a' },
  three_masks:   { name: 'Three Masks',   material: 'bone',  accent: '#f0e6cf' },
  chain_fire:    { name: 'Chain of Fire', material: 'ember', accent: '#ff8324' },
  ember_cascade: { name: 'Ember Cascade', material: 'ember', accent: '#ff8324' },
  rune_line:     { name: 'Rune Line',     material: 'metal', accent: '#cfd0d8' },
  rune_bloom:    { name: 'Rune Bloom',    material: 'frost', accent: '#7ea3c4' }
};

export const RULES = {
  rune_match:    { name: 'Rune Match',    line: 'Swap runes. Match three to clear.',        body: 'Chain matches for combo multipliers.' },
  stone_stack:   { name: 'Stone Stack',   line: 'Stack stones. Do not miss.',               body: 'Tap to drop the swinging stone. Perfect stacks give bonuses.' },
  fireflies:     { name: 'Fireflies',     line: 'Catch every firefly.',                     body: 'Miss 3 and the field goes dark.' },
  rite_hands:    { name: 'Rite of Hands', line: 'Read their pattern. Beat their throw.',     body: 'Best of 5. You see their last 5 throws.' },
  ember_flow:    { name: 'Ember Flow',    line: 'Rotate tiles to guide the fire.',          body: 'Connect source to shrine.' },
  stone_sort:    { name: 'Stone Sort',    line: 'Sort stones into matching piles.',         body: 'Pour from bowl to bowl. Endless levels.' },
  bid_fold:      { name: 'Bid or Fold',   line: 'Bid more than them or fold.',              body: 'First to 5 pot coins wins.' },
  three_masks:   { name: 'Three Masks',   line: 'Guess their mask.',                        body: 'Best of 3 rounds. WAR, TRICK, GUARD.' },
  chain_fire:    { name: 'Chain of Fire', line: 'Keep the chain alive.',                    body: 'Add a torch that connects. Cannot move, you lose.' },
  ember_cascade: { name: 'Ember Cascade', line: 'Rotate falling runes. Complete lines.',     body: 'Line clears give combos.' },
  rune_line:     { name: 'Rune Line',     line: 'Connect every rune in one stroke.',        body: 'No crossing. No lifting.' },
  rune_bloom:    { name: 'Rune Bloom',    line: 'Combine runes to grow them.',              body: 'Slide to merge. Reach the highest tier.' }
};