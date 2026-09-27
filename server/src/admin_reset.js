// TRIBES-FILE: server/src/admin_reset.js
// PHASE: 7 — Meta & Admin
// Destructive operations. Every one writes an audit row first.

import { q } from './db.js';

async function audit(adminId, action, detail) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail) VALUES ($1,$2,$3)',
      [adminId || null, action, detail || '']
    );
  } catch {}
}

export async function previewReset() {
  const users = (await q('SELECT count(*)::int n FROM users')).rows[0].n;
  const usersWithProg = (await q(
    'SELECT count(*)::int n FROM users WHERE ember > 500 OR renown > 0 OR tribe_id IS NOT NULL'
  )).rows[0].n;
  const tribes = (await q('SELECT count(*)::int n FROM tribes')).rows[0].n;
  const activeWars = (await q(
    "SELECT count(*)::int n FROM wars WHERE status='active'"
  )).rows[0].n;
  const totalWars = (await q('SELECT count(*)::int n FROM wars')).rows[0].n;
  const chronicles = (await q('SELECT count(*)::int n FROM war_chronicles')).rows[0].n;
  const kivaMsgs = (await q('SELECT count(*)::int n FROM kiva_messages')).rows[0].n;
  const codes = (await q('SELECT count(*)::int n FROM codes')).rows[0].n;
  const payments = (await q('SELECT count(*)::int n FROM payments')).rows[0].n;
  const seasons = (await q('SELECT count(*)::int n FROM seasons')).rows[0].n;
  return {
    users,
    usersWithProgress: usersWithProg,
    tribes, activeWars, totalWars, chronicles,
    kivaMessages: kivaMsgs, codes, payments, seasons,
  };
}

export async function backupToJSON(adminId) {
  const dump = {
    _meta: {
      generated_at: new Date().toISOString(),
      admin_id: adminId || null,
      version: 'v4',
    },
    users: (await q('SELECT * FROM users')).rows,
    tribes: (await q('SELECT * FROM tribes')).rows,
    tribe_names: (await q('SELECT * FROM tribe_names')).rows,
    wars: (await q('SELECT * FROM wars')).rows,
    war_chronicles: (await q('SELECT * FROM war_chronicles')).rows,
    war_fronts: (await q('SELECT * FROM war_fronts')).rows,
    seasons: (await q('SELECT * FROM seasons')).rows,
    payments: (await q('SELECT * FROM payments')).rows,
    codes: (await q('SELECT * FROM codes')).rows,
    config: (await q('SELECT k, v FROM config')).rows,
    relics: (await q('SELECT * FROM relics')).rows,
    emoji_sets: (await q('SELECT * FROM emoji_sets')).rows,
  };
  await audit(adminId, 'backup', `users=${dump.users.length} tribes=${dump.tribes.length}`);
  return dump;
}

export async function resetProgression(adminId) {
  await audit(adminId, 'resetProgression', 'starting');

  await q(`
    UPDATE users SET
      ember = 500,
      renown = 0,
      streak = 0,
      last_checkin = NULL,
      ash_ready_at = NULL,
      ash_count = 0,
      role = 'Toddler',
      tribe_id = NULL,
      trials_state = '{}'::jsonb,
      name_color = NULL,
      avatar_glow = NULL,
      equipped_relic_id = NULL,
      cursed_shards = 0,
      relic_paused_json = NULL
  `);

  await q(`
    UPDATE tribes SET
      treasury = 0, members = 0, renown_total = 0,
      donated_total = 0, members_total = 0, ash_total = 0,
      quests_total = 0, checkins_total = 0, relics_total = 0,
      shares_total = 0, wins = 0, losses = 0, level = 1
  `);

  await q(
    `UPDATE wars SET status='resolved', resolved_at=now(),
                     end_at = CASE WHEN end_at > now() THEN now() ELSE end_at END
      WHERE status='active'`
  );

  await q('UPDATE bonfire_events SET end_at=now() WHERE end_at > now()');
  await q('DELETE FROM push_queue WHERE sent_at IS NULL');
  await q('DELETE FROM user_relics');
  await q('DELETE FROM relic_loadouts');

  await audit(adminId, 'resetProgression', 'complete');
  return { ok: true, at: new Date().toISOString() };
}

export async function factoryReset(adminId) {
  await audit(adminId, 'factoryReset', 'starting');

  const tables = [
    'war_fronts','war_actions','war_momentum','war_legendary',
    'war_defender_actions','war_chronicles','war_vengeance','blood_alliances',
    'war_spoils_log','rivalries',
    'kiva_messages','kiva_reads','kiva_reactions','kiva_curfews',
    'user_boons','tribe_boons',
    'musters','muster_votes','war_roles',
    'tribe_idols','idol_contributions','relic_loadouts',
    'code_redemptions','codes',
    'bonfire_events','raids','admin_events',
    'season_titles','season_rewards','seasons',
    'user_badges','user_relics','relic_fusions','relic_events',
    'user_pack_state',
    'push_queue',
    'payments','ledger',
    'daily_quest_log','trial_log',
    'referral_events','x_claims','x_handle_owners','x_quests',
    'spin_log','first_pack_claims','streak_insurance',
    'user_emoji_sets',
    'spy_missions','tribe_counterspy',
    'audit','admin_feed',
    'notifications',
  ];
  for (const t of tables) {
    try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); }
    catch (e) { console.warn('[factoryReset] truncate', t, e.message); }
  }

  await q('DELETE FROM wars');

  await q(`
    UPDATE users SET
      tribe_id = NULL, ember = 500, stars = 0, renown = 0,
      role = 'Toddler', streak = 0,
      last_checkin = NULL, ash_ready_at = NULL, ash_count = 0,
      name_color = NULL, avatar_glow = NULL,
      trials_state = '{}'::jsonb,
      banned = false, ban_reason = NULL, blessed = false,
      referred_by = NULL, referral_code = NULL,
      equipped_relic_id = NULL, cursed_shards = 0,
      relic_paused_json = NULL, avatar_id = NULL
  `);
  await q('DELETE FROM users WHERE is_guest = true');
  await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
  await q('DELETE FROM tribes');

  await audit(adminId, 'factoryReset', 'complete');
  return { ok: true, at: new Date().toISOString() };
}

export async function listTables() {
  const r = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' ORDER BY table_name`
  );
  return r.rows.map((x) => x.table_name);
}