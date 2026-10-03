// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/index.js
// PURPOSE: The dispatcher. Score any game by slug.
// DEPENDS ON: configs.js, all engines
// ═══════════════════════════════════════════════════════════════════
import { GAMES, ARCHETYPE_GAMES, SCORING_ARCHETYPE, pickGameForArchetypeWeights, pickGameForTerrain } from './configs.js';
import { reactionScore } from './reaction.js';
import { memoryScore } from './memory.js';
import { choiceScore } from './choice.js';
import { sequenceScore } from './sequence.js';
import { deductionScore } from './deduction.js';
import { match3Score } from './match3.js';
import { stackerScore } from './stacker.js';
import { catcherScore } from './catcher.js';
import { sorterScore } from './sorter.js';
import { pathPuzzleScore } from './pathpuzzle.js';
import { oneStrokeScore } from './one-stroke.js';
import { fallingScore } from './falling.js';
import { bloomScore } from './bloom.js';
import { jumperScore } from './jumper.js';
import { memoryFlipScore } from './memory-flip.js';
import { echoScore } from './echo.js';

export { GAMES, ARCHETYPE_GAMES, SCORING_ARCHETYPE, pickGameForArchetypeWeights, pickGameForTerrain };

export function scoreGame(gameSlug, payload) {
  const game = GAMES[gameSlug];
  if (!game) throw new Error('unknown game: ' + gameSlug);
  switch (game.archetype) {
    case 'reaction':   return reactionScore(gameSlug, payload);
    case 'memory':     return memoryScore(gameSlug, payload);
    case 'choice':     return choiceScore(gameSlug, payload);
    case 'sequence':   return sequenceScore(gameSlug, payload);
    case 'deduction':  return deductionScore(gameSlug, payload);
    case 'match3':     return match3Score(gameSlug, payload);
    case 'stacker':    return stackerScore(gameSlug, payload);
    case 'catcher':    return catcherScore(gameSlug, payload);
    case 'sorter':     return sorterScore(gameSlug, payload);
    case 'pathpuzzle': return pathPuzzleScore(gameSlug, payload);
    case 'one_stroke': return oneStrokeScore(gameSlug, payload);
    case 'falling':    return fallingScore(gameSlug, payload);
    case 'bloom':      return bloomScore(gameSlug, payload);
    case 'jumper':     return jumperScore(gameSlug, payload);
    case 'memory_flip':return memoryFlipScore(gameSlug, payload);
    case 'echo':       return echoScore(gameSlug, payload);
    default:           return 0;
  }
}