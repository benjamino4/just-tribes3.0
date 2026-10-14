/**
 * Given a consensus ranking (best → worst) and the number of options N,
 * award points per rank.
 *
 * N=2 → [100, 40]
 * N=3 → [100, 60, 25]
 * N=4 → [100, 70, 45, 20]
 * N=5 → [100, 75, 55, 35, 15]
 *
 * Base is always 100 for rank 1. Each subsequent rank is scaled so total
 * sum stays roughly proportional, encouraging differentiation.
 */
export function pointsForRank(rankIndex, totalOptions) {
  if (totalOptions <= 0) return 0;
  const base = 100;
  const floor = 15;
  if (totalOptions === 1) return base;
  const step = (base - floor) / (totalOptions - 1);
  return Math.round(base - step * rankIndex);
}

/**
 * Build the full points map for a challenge ranking.
 *
 * `ranking` is the ordered list of option ids (best → worst).
 * `optionPoints` is an optional { [optionId]: number } of ADMIN-SET awards.
 *   - When an option has an explicit admin-set award, that exact number is
 *     paid for picking it (regardless of where it landed in the ranking).
 *   - Options with no admin value fall back to the automatic rank curve.
 * This lets the admin fully determine points per option while still keeping a
 * sensible default for any option they leave blank.
 *
 * Returns { map: { [optionId]: points }, ordered: [{ id, rank, points }] }
 */
export function buildPointsMap(ranking, optionPoints = {}) {
  const ordered = ranking.map((id, i) => {
    const override = optionPoints ? optionPoints[id] : undefined;
    const hasOverride = override !== undefined && override !== null && override !== '' && Number.isFinite(Number(override));
    return {
      id,
      rank: i + 1,
      points: hasOverride ? Math.max(0, Math.round(Number(override))) : pointsForRank(i, ranking.length),
    };
  });
  const map = {};
  ordered.forEach(o => (map[o.id] = o.points));
  return { map, ordered };
}