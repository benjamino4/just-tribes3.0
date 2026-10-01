import { GAMES, ARCHETYPE_GAMES, pickGameForArchetypeWeights } from './configs.js';
import { reactionScore } from './reaction.js';
import { memoryScore } from './memory.js';
import { choiceScore } from './choice.js';
import { sequenceScore } from './sequence.js';
import { deductionScore } from './deduction.js';

export { GAMES, ARCHETYPE_GAMES, pickGameForArchetypeWeights };

export function scoreGame(gameSlug, payload) {
  const game = GAMES[gameSlug];
  if (!game) throw new Error('unknown game: ' + gameSlug);
  switch (game.archetype) {
    case 'reaction':  return reactionScore(gameSlug, payload);
    case 'memory':    return memoryScore(gameSlug, payload);
    case 'choice':    return choiceScore(gameSlug, payload);
    case 'sequence':  return sequenceScore(gameSlug, payload);
    case 'deduction': return deductionScore(gameSlug, payload);
    default:          return 0;
  }
}