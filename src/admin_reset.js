// ---------------------------------------------------------------------------
// TRIBES — Reset + backup logic (Batch 3 Part 2).
// All destructive operations live here, isolated from the rest of admin.js.
// Every operation writes an audit entry BEFORE running.
// ---------------------------------------------------------------------------
import { q } from './db.js';

async function audit(adminId, action, detail){
  try{ await q(`INSERT INTO audit(admin_id,action,detail) VALUES ($1,$2,$3)`,
    [adminId||null, action, detail||'']); }catch(e){}
}

// ---------- PREVIEW ----------
// Returns counts of everything that will be affected by a progression reset
// or a factory reset. Used by the admin UI to show "This will affect N users".
export async function previewReset(){
  const users = (await q('SELECT count(*)::int n FROM users')).rows[0].n;
  const usersWithProg = (await q(
    'SELECT count(*)::int n FROM users WHERE ember > 500 OR loyalty > 0 OR tribe_id IS NOT NULL'
  )).rows[0].n;
  const tribes = (await q('SELECT count(*)::int n FROM tribes')).rows[0].n;
  const activeWars = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0].n;
  const totalWars = (await q('SELECT count(*)::int n FROM wars')).rows[0].n;
  const chronicles = (await q('SELECT count(*)::int n FROM war_chronicles')).rows[0].n;
  const kivaMsgs = (await q('SELECT count(*)::int n FROM kiva_messages')).rows[0].n;
  const codes = (await q('SELECT count(*)::int n FROM codes')).rows[0].n;
  const payments = (await q('SELECT count(*)::int n FROM payments')).rows[0].n;
  const seasons = (await q('SELECT count(*)::int n FROM seasons')).rows[0].n;
  const cosmetics = (await q('SELECT count(*)::int n FROM user_cosmetics')).rows[0].n;
  const badges = (await q('SELECT count(*)::int n FROM user_badges')).rows[0].n;

  return {
    users, usersWithProgress: usersWithProg,
    tribes, activeWars, totalWars, chronicles,
    kivaMessages: kivaMsgs, codes, payments, seasons,
    cosmeticsOwned: cosmetics, badgesOwned: badges,
  };
}

// ---------- BACKUP ----------
// Returns a full JSON dump of the current game state. The caller can save it
// or stream it. Nothing is written to the DB in this function.
export async function backupToJSON(adminId){
  const dump = {
    _meta: {
      generated_at: new Date().toISOString(),
      admin_id: adminId || null,
      version: 'batch3-2a',
    },
    users: (await q(
      `SELECT id, username, first_name, role, ember, stars, loyalty, streak,
              last_checkin, ash_ready_at, ash_count, ton_address, tribe_id,
              name_color, avatar_glow, trials_state, created_at,
              banned, ban_reason
         FROM users`
    )).rows,
    tribes: (await q(
      `SELECT id, name, name_id, hue, motto, crest, banner, palette, level,
              treasury, created_by, members, loyalty_total, donated_total,
              members_total, ash_total, quests_total, checkins_total,
              relics_total, shares_total, wins, losses, created_at
         FROM tribes`
    )).rows,
    tribe_names: (await q('SELECT id, name, claimed_by_tribe_id, is_seed FROM tribe_names')).rows,
    wars: (await q('SELECT * FROM wars')).rows,
    war_chronicles: (await q('SELECT * FROM war_chronicles')).rows,
    war_fronts: (await q('SELECT * FROM war_fronts')).rows,
    war_momentum: (await q('SELECT * FROM war_momentum')).rows,
    seasons: (await q('SELECT * FROM seasons')).rows,
    season_titles: (await q('SELECT * FROM season_titles')).rows,
    rivalries: (await q('SELECT * FROM rivalries')).rows,
    payments: (await q('SELECT * FROM payments')).rows,
    codes: (await q('SELECT * FROM codes')).rows,
    user_cosmetics: (await q('SELECT * FROM user_cosmetics')).rows,
    user_badges: (await q('SELECT * FROM user_badges')).rows,
    config: (await q('SELECT k, v FROM config')).rows,
    trials: (await q('SELECT * FROM trials')).rows,
  };
  await audit(adminId, 'backup', `users=${dump.users.length} tribes=${dump.tribes.length}`);
  return dump;
}

// ---------- PROGRESSION RESET ----------
// Wipes free-currency progress, membership, active wars, trials, calendar.
// KEEPS: accounts, purchased cosmetics, purchased Stars, tribe names claimed,
//        war chronicles, seasons, payments history, audit log, codes.
export async function resetProgression(adminId){
  await audit(adminId, 'resetProgression', 'starting');

  // 1. Wipe per-user progression
  await q(`
    UPDATE users SET
      ember = 500,
      loyalty = 0,
      streak = 0,
      last_checkin = NULL,
      ash_ready_at = NULL,
      ash_count = 0,
      role = 'Toddler',
      tribe_id = NULL,
      trials_state = '{}'::jsonb,
      name_color = NULL,
      avatar_glow = NULL
  `);
  // Note: stars, ton_address, is_guest, banned are KEPT.

  // 2. Wipe per-tribe progression, keep tribes as entities
  await q(`
    UPDATE tribes SET
      treasury = 0,
      members = 0,
      loyalty_total = 0,
      donated_total = 0,
      members_total = 0,
      ash_total = 0,
      quests_total = 0,
      checkins_total = 0,
      relics_total = 0,
      shares_total = 0,
      wins = 0,
      losses = 0,
      level = 1
  `);

  // 3. Close any active war
  await q(`UPDATE wars SET status='resolved', resolved_at=now() WHERE status='active'`);

  // 4. Wipe calendar state
  await q('UPDATE calendar_state SET day=0, streak_days=0, total_claims=0, last_claim=NULL');

  // 5. End any active bonfire
  await q('UPDATE bonfire_events SET end_at=now() WHERE end_at > now()');

  // 6. Clear any pending push notifications
  await q('DELETE FROM push_queue WHERE sent_at IS NULL');

  await audit(adminId, 'resetProgression', 'complete');
  return { ok: true, at: new Date().toISOString() };
}

// ---------- FACTORY RESET ----------
// Wipes everything except user rows and tribe names. Users keep their
// Telegram identities so they don't have to re-register.
export async function factoryReset(adminId){
  await audit(adminId, 'factoryReset', 'starting');

  // 1. Truncate dependent tables in dependency order
  //    Using individual TRUNCATEs since some tables have FKs.
  const tables = [
    'war_fronts', 'war_actions', 'war_momentum', 'war_legendary',
    'war_defender_actions', 'war_chronicles', 'rivalries',
    'kiva_reactions', 'kiva_pins', 'kiva_messages', 'kiva_reads',
    'code_redemptions', 'codes',
    'calendar_state',
    'bonfire_events',
    'season_titles', 'seasons',
    'user_cosmetics', 'user_badges',
    'invites', 'invite_redemptions',
    'push_queue',
    'ledger', 'payments', 'audit',
  ];
  for (const t of tables){
    try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); }
    catch(e){ console.warn('[factoryReset] truncate', t, e.message); }
  }

  // 2. Delete wars
  await q('DELETE FROM wars');

  // 3. Wipe user progression but keep the rows
  await q(`
    UPDATE users SET
      tribe_id = NULL,
      ember = 500,
      stars = 0,
      loyalty = 0,
      role = 'Toddler',
      streak = 0,
      last_checkin = NULL,
      ash_ready_at = NULL,
      ash_count = 0,
      name_color = NULL,
      avatar_glow = NULL,
      trials_state = '{}'::jsonb,
      banned = false,
      ban_reason = NULL
  `);
  // Delete guest accounts entirely (they're ephemeral test users)
  await q('DELETE FROM users WHERE is_guest = true');

  // 4. Wipe all tribes EXCEPT keep the tribe_names pool with claimed ids reset
  await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
  await q('DELETE FROM tribes');

  // 5. Remove any config overrides so admins start from DEFAULTS
  //    (Comment this out if you want to keep tuned economy values.)
  // await q("DELETE FROM config WHERE k NOT IN ('tribe_level_names','tribe_level_caps','tribe_level_costs')");

  await audit(adminId, 'factoryReset', 'complete');
  return { ok: true, at: new Date().toISOString() };
}
export async function listTables(){
  const r = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name`
  );
  return r.rows.map(x => x.table_name);
}