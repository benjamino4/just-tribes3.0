// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/reaction.js
// PURPOSE: Score reaction-style games. Average of times.
// DEPENDS ON: lib/pyscore.js
// ═══════════════════════════════════════════════════════════════════
import { reflexScoreLocal } from '../lib/pyscore.js';

export function reactionScore(_slug, payload) {
  const times = Array.isArray(payload?.times) ? payload.times : [];
  return reflexScoreLocal(times);
}