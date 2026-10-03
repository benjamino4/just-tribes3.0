import { q } from './db.js';
import { CFG } from './config.js';
import { emit } from './events.js';

function weekKey(d = new Date()) {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = (day + 7 - (CFG.seat_recalc_day || 0)) % 7;
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().slice(0, 10);
}

export async function getTierFor(rating) {
  const tiers = (await q(
    'SELECT * FROM rank_tiers WHERE active=true AND min_rating <= $1 AND (max_rating IS NULL OR max_rating >= $1) LIMIT 1',
    [rating]
  )).rows[0];
  if (tiers) return tiers;
  // Fallback defaults
  const defaults = [
    { slug: 'bone', name: 'Bone', title: 'Bone Carver', min_rating: 0, color_hex: '#8e9aaa', emoji: '🦴' },
    { slug: 'flint', name: 'Flint', title: 'Flint Knapper', min_rating: 1000, color_hex: '#7ea3c4', emoji: '🪨' },
    { slug: 'stone', name: 'Stone', title: 'Stone Setter', min_rating: 1200, color_hex: '#5a6675', emoji: '⛰️' },
    { slug: 'jade', name: 'Jade', title: 'Jade Warrior', min_rating: 1400, color_hex: '#55a882', emoji: '💚' },
    { slug: 'copper', name: 'Copper', title: 'Copper Chief', min_rating: 1600, color_hex: '#c49040', emoji: '🟠' },
    { slug: 'silver', name: 'Silver', title: 'Silver Chieftain', min_rating: 1800, color_hex: '#c9d4e0', emoji: '⚪' },
    { slug: 'gold', name: 'Gold', title: 'Gold Warlord', min_rating: 2000, color_hex: '#f7a259', emoji: '🏆' },
    { slug: 'obsidian', name: 'Obsidian', title: 'Obsidian King', min_rating: 2200, color_hex: '#1f1d28', emoji: '🖤' },
    { slug: 'eternal', name: 'Eternal', title: 'Eternal Flame', min_rating: 2500, color_hex: '#ffe9b8', emoji: '🔥' }
  ];
  let chosen = defaults[0];
  for (const t of defaults) if (rating >= t.min_rating) chosen = t;
  return chosen;
}

export async function seedRankTiers() {
  const count = (await q('SELECT count(*)::int AS n FROM rank_tiers')).rows[0].n;
  if (count > 0) return;
  const defaults = [
    ['bone', 'Bone', 'Bone Carver', 0, 999, '#8e9aaa', '🦴', 10],
    ['flint', 'Flint', 'Flint Knapper', 1000, 1199, '#7ea3c4', '🪨', 20],
    ['stone', 'Stone', 'Stone Setter', 1200, 1399, '#5a6675', '⛰️', 30],
    ['jade', 'Jade', 'Jade Warrior', 1400, 1599, '#55a882', '💚', 40],
    ['copper', 'Copper', 'Copper Chief', 1600, 1799, '#c49040', '🟠', 50],
    ['silver', 'Silver', 'Silver Chieftain', 1800, 1999, '#c9d4e0', '⚪', 60],
    ['gold', 'Gold', 'Gold Warlord', 2000, 2199, '#f7a259', '🏆', 70],
    ['obsidian', 'Obsidian', 'Obsidian King', 2200, 2499, '#1f1d28', '🖤', 80],
    ['eternal', 'Eternal', 'Eternal Flame', 2500, null, '#ffe9b8', '🔥', 90]
  ];
  for (const [slug, name, title, min, max, color, emoji, order] of defaults) {
    await q(
      `INSERT INTO rank_tiers (slug, name, title, min_rating, max_rating, color_hex, emoji, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (slug) DO NOTHING`,
      [slug, name, title, min, max, color, emoji, order]
    );
  }
}

export async function adjustRank(userId, delta, reason) {
  const before = (await q('SELECT rank_rating FROM users WHERE id=$1', [userId])).rows[0];
  if (!before) return null;
  const after = Math.max(0, Number(before.rank_rating || 1000) + delta);
  await q(
    'UPDATE users SET rank_rating=$1, rank_games=rank_games+1, rank_wins=rank_wins+$2 WHERE id=$3',
    [after, delta > 0 ? 1 : 0, userId]
  );
  await q(
    'INSERT INTO rank_history (user_id, rank_before, rank_after, reason) VALUES ($1,$2,$3,$4)',
    [userId, before.rank_rating, after, reason]
  );
  const oldTier = await getTierFor(before.rank_rating);
  const newTier = await getTierFor(after);
  const tierChanged = oldTier.slug !== newTier.slug;
  return {
    before: Number(before.rank_rating), after,
    oldTier, newTier, tierChanged, delta
  };
}

export async function applyRankAfterMatch(winnerId, loserId, kind = 'duel') {
  const winDelta = Number(CFG.rank_win_delta) || 25;
  const lossDelta = Number(CFG.rank_loss_delta) || 20;
  const r1 = await adjustRank(winnerId, +winDelta, kind);
  const r2 = await adjustRank(loserId, -lossDelta, kind);
  if (r1?.tierChanged) {
    await emit({
      userId: winnerId, tier: 'island', kind: 'rank_up',
      title: `You are now ${r1.newTier.title}`,
      body: `Welcome to the ${r1.newTier.name} rank`,
      icon: 'crown', severity: 'success',
      action_data: { tier: r1.newTier.slug, rating: r1.after }
    });
  }
  return { winner: r1, loser: r2 };
}

// Adjust ONLY the given player's rating for a match they just finished. Used by
// the ranked-queue flow where each human resolves their OWN duel independently
// (so applying both sides here would double-count). Bots (negative ids / no
// users row) are never touched because adjustRank is a no-op for them.
export async function adjustSelf(userId, won, kind = 'ranked') {
  const winDelta = Number(CFG.rank_win_delta) || 25;
  const lossDelta = Number(CFG.rank_loss_delta) || 20;
  const r = await adjustRank(userId, won ? +winDelta : -lossDelta, kind);
  if (r?.tierChanged && won) {
    await emit({
      userId, tier: 'island', kind: 'rank_up',
      title: `You are now ${r.newTier.title}`,
      body: `Welcome to the ${r.newTier.name} rank`,
      icon: 'crown', severity: 'success',
      action_data: { tier: r.newTier.slug, rating: r.after }
    });
  }
  return r;
}

export async function recalcSeatsForTribe(tribeId) {
  const wk = weekKey();
  const roster = (await q(
    `SELECT id, rank_rating FROM users
     WHERE tribe_id=$1 AND banned=false
     ORDER BY rank_rating DESC, kinship DESC LIMIT 7`,
    [tribeId]
  )).rows;
  const tribe = (await q('SELECT created_by FROM tribes WHERE id=$1', [tribeId])).rows[0];
  if (!tribe) return;
  await q('DELETE FROM seat_assignments WHERE tribe_id=$1 AND week_key=$2', [tribeId, wk]);
  const positions = ['warlord', 'keeper', 'voice', 'smith', 'ember', 'wanderer'];
  let idx = 0;
  for (const member of roster) {
    if (Number(member.id) === Number(tribe.created_by)) continue;
    if (idx >= positions.length) break;
    await q(
      `INSERT INTO seat_assignments (tribe_id, user_id, position, week_key)
       VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [tribeId, member.id, positions[idx], wk]
    );
    idx += 1;
  }
  if (tribe.created_by) {
    await q(
      `INSERT INTO seat_assignments (tribe_id, user_id, position, week_key)
       VALUES ($1,$2,'chief',$3) ON CONFLICT DO NOTHING`,
      [tribeId, tribe.created_by, wk]
    );
  }
}

export async function recalcAllSeats() {
  const tribes = (await q('SELECT id FROM tribes WHERE forgotten=false')).rows;
  for (const t of tribes) {
    try { await recalcSeatsForTribe(t.id); }
    catch (e) { console.warn('[rank] seats', t.id, e.message); }
  }
}

export async function decayInactiveRanks() {
  const days = Number(CFG.rank_decay_days) || 7;
  const amt = Number(CFG.rank_decay_amount) || 15;
  await q(
    `UPDATE users SET rank_rating = GREATEST(0, rank_rating - $1)
     WHERE banned = false
     AND (last_checkin IS NULL OR last_checkin < now() - ($2 || ' days')::interval)`,
    [amt, String(days)]
  );
}

export function seatsForTribe(tribeId) {
  return q(
    `SELECT s.position, s.user_id, u.first_name, u.username, u.rank_rating
     FROM seat_assignments s JOIN users u ON u.id = s.user_id
     WHERE s.tribe_id=$1 AND s.week_key=$2`,
    [tribeId, weekKey()]
  ).then((r) => r.rows);
}

export { weekKey };