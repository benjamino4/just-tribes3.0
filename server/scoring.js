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
 * Returns { [optionId]: points, ordered: [{ id, rank, points }] }
 */
export function buildPointsMap(ranking) {
  const ordered = ranking.map((id, i) => ({
    id,
    rank: i + 1,
    points: pointsForRank(i, ranking.length),
  }));
  const map = {};
  ordered.forEach(o => (map[o.id] = o.points));
  return { map, ordered };
}