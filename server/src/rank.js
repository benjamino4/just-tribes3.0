// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/rank.js
// PURPOSE: The rank ladder. Nine tiers (Bone → Eternal Flame).
//          Weekly seat assignment. Decay for inactive players.
// DEPENDS ON: db.js, config.js, events.js, economy.js
// ═══════════════════════════════════════════════════════════════════
import { q } from './db.js';
import { CFG } from './config.js';
import { emit } from './events.js';

export async function tierFor(rating) {
  const r = (await q(
    `SELECT slug, name, title, min_rating, max_rating, color_hex, emoji
       FROM rank_tiers WHERE active=true AND min_rating <= $1
        AND (max_rating IS NULL OR max_rating >= $1)
      ORDER BY min_rating DESC LIMIT 1`, [rating]
  )).rows[0];
  return r || { slug: 'bone', name: 'Bone', title: 'Bone Carver', color_hex: '#b0a080', emoji: '🦴' };
}

export async function listTiers() {
  return (await q(
    'SELECT slug, name, title, min_rating, max_rating, color_hex, emoji FROM rank_tiers WHERE active=true ORDER BY sort_order'
  )).rows;
}

function weekKey(d = new Date()) {
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = utc.getUTCDay();
  const diff = (day + 7 - (CFG.seat_recalc_day || 0)) % 7;
  utc.setUTCDate(utc.getUTCDate() - diff);
  return utc.toISOString().slice(0, 10);
}

export async function adjustRank(userId, delta, reason) {
  const before = (await q('SELECT rank_rating FROM users WHERE id=$1', [userId])).rows[0];
  if (!before) return null;
  const beforeRating = Number(before.rank_rating || 1000);
  const after = Math.max(0, beforeRating + delta);
  await q(
    'UPDATE users SET rank_rating=$1, rank_games=rank_games+1, rank_wins=rank_wins+$2 WHERE id=$3',
    [after, delta > 0 ? 1 : 0, userId]
  );
  await q(
    'INSERT INTO rank_history (user_id, rank_before, rank_after, reason) VALUES ($1,$2,$3,$4)',
    [userId, beforeRating, after, reason]
  );

  const tierBefore = await tierFor(beforeRating);
  const tierAfter = await tierFor(after);

  if (tierBefore.slug !== tierAfter.slug) {
    const up = (tierAfter.min_rating || 0) > (tierBefore.min_rating || 0);
    await emit({
      userId, tier: 'island', kind: 'rank_change',
      title: up ? `Risen to ${tierAfter.title}` : `Descended to ${tierAfter.title}`,
      body: `Rank ${after}`,
      icon: up ? 'crown' : 'bolt',
      severity: up ? 'success' : 'warn',
      sticky: up,
      action_kind: 'profile',
      action_data: { tier_from: tierBefore.slug, tier_to: tierAfter.slug, rating: after, up }
    });
  }

  return { before: beforeRating, after, tier_before: tierBefore, tier_after: tierAfter };
}

export async function applyRankAfterMatch(winnerId, loserId, kind = 'duel') {
  const winDelta = Number(CFG.rank_win_delta) || 25;
  const lossDelta = Number(CFG.rank_loss_delta) || 20;
  const r1 = await adjustRank(winnerId, +winDelta, kind);
  const r2 = await adjustRank(loserId, -lossDelta, kind);
  return { winner: r1, loser: r2 };
}

export async function recalcSeatsForTribe(tribeId) {
  const wk = weekKey();
  const roster = (await q(
    `SELECT id, rank_rating FROM users
      WHERE tribe_id=$1 AND banned=false
      ORDER BY rank_rating DESC, kinship DESC
      LIMIT 7`,
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
    const pos = positions[idx];
    await q(
      `INSERT INTO seat_assignments (tribe_id, user_id, position, week_key)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`,
      [tribeId, member.id, pos, wk]
    );
    await emit({
      userId: member.id, tier: 'island', kind: 'seat',
      title: `You are now ${pos[0].toUpperCase()}${pos.slice(1)}`,
      body: 'Your tribe raised you to a seat.',
      icon: 'crown', severity: 'tribe',
      action_kind: 'tribe',
    });
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
  try {
    await q(
      `UPDATE users
          SET rank_rating = GREATEST(0, rank_rating - $1)
        WHERE banned = false
          AND (last_checkin IS NULL OR last_checkin < now() - ($2 || ' days')::interval)`,
      [amt, String(days)]
    );
  } catch (e) { console.warn('[rank] decay', e.message); }
}

export async function seatsForTribe(tribeId) {
  const rows = (await q(
    `SELECT s.position, s.user_id, u.first_name, u.username, u.rank_rating
       FROM seat_assignments s
       JOIN users u ON u.id = s.user_id
      WHERE s.tribe_id=$1 AND s.week_key=$2`,
    [tribeId, weekKey()]
  )).rows;
  return rows;
}

export { weekKey };