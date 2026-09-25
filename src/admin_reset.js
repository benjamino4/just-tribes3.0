/* =====================================================================
   TRIBES — Destructive operations. Every op writes an audit row first.
===================================================================== */
import { q } from './db.js';

async function audit(adminId, action, detail){
  try {
    await q(
      `INSERT INTO audit(admin_id,action,detail) VALUES ($1,$2,$3)`,
      [adminId || null, action, detail || '']
    );
  } catch(e){}
}

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
  const cosmetics = (await q('SELECT count(*)::int n FROM cosmetic_purchases')).rows[0].n;
  const badges = (await q('SELECT count(*)::int n FROM user_badges')).rows[0].n;

  return {
    users, usersWithProgress: usersWithProg,
    tribes, activeWars, totalWars, chronicles,
    kivaMessages: kivaMsgs, codes, payments, seasons,
    cosmeticsOwned: cosmetics, badgesOwned: badges,
  };
}

export async function backupToJSON(adminId){
  const dump = {
    _meta: {
      generated_at: new Date().toISOString(),
      admin_id: adminId || null,
      version: 'v3',
    },
    users: (await q(
      `SELECT id, username, first_name, role, ember, stars, loyalty, streak,
              last_checkin, ash_ready_at, ash_count, ton_address, tribe_id,
              name_color, avatar_glow, trials_state, created_at,
              banned, ban_reason, referral_code, referred_by
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
    cosmetic_purchases: (await q('SELECT * FROM cosmetic_purchases')).rows,
    user_badges: (await q('SELECT * FROM user_badges')).rows,
    user_relics: (await q('SELECT * FROM user_relics')).rows,
    spin_log: (await q('SELECT * FROM spin_log')).rows,
    config: (await q('SELECT k, v FROM config')).rows,
    trial_defs: (await q('SELECT * FROM trial_defs')).rows,
    daily_quests: (await q('SELECT * FROM daily_quests')).rows,
    x_quests: (await q('SELECT * FROM x_quests')).rows,
    x_claims: (await q('SELECT * FROM x_claims')).rows,
    referrals: (await q('SELECT * FROM referral_events')).rows,
  };
  await audit(adminId, 'backup', `users=${dump.users.length} tribes=${dump.tribes.length}`);
  return dump;
}

export async function resetProgression(adminId){
  await audit(adminId, 'resetProgression', 'starting');

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

  await q(
    `UPDATE wars SET status='resolved', resolved_at=now(),
                     end_at = CASE WHEN end_at > now() THEN now() ELSE end_at END
      WHERE status='active'`
  );

  await q('UPDATE calendar_state SET day=0, streak_days=0, total_claims=0, last_claim=NULL');
  await q('UPDATE bonfire_events SET end_at=now() WHERE end_at > now()');
  await q('UPDATE raids SET ends_at=now() WHERE ends_at > now()');
  await q('DELETE FROM push_queue WHERE sent_at IS NULL');

  await audit(adminId, 'resetProgression', 'complete');
  return { ok:true, at: new Date().toISOString() };
}

export async function factoryReset(adminId){
  await audit(adminId, 'factoryReset', 'starting');

  const tables = [
    'war_fronts', 'war_actions', 'war_momentum', 'war_legendary',
    'war_defender_actions', 'war_chronicles', 'rivalries',
    'kiva_reactions', 'kiva_reads', 'kiva_messages',
    'code_redemptions', 'codes',
    'calendar_state',
    'bonfire_events',
    'season_titles', 'seasons',
    'cosmetic_purchases', 'user_badges', 'user_relics',
    'push_queue',
    'ledger', 'payments',
    'daily_quest_log',
    'referral_events',
    'tribe_quest_progress',
    'raids',
    'x_claims', 'x_handle_owners',
    'spin_log',
    'first_pack_claims',
    'streak_insurance',
  ];
  for (const t of tables){
    try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); }
    catch(e){ console.warn('[factoryReset] truncate', t, e.message); }
  }

  await q('DELETE FROM wars');

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
      ban_reason = NULL,
      referred_by = NULL
  `);
  await q('DELETE FROM users WHERE is_guest = true');
  await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
  await q('DELETE FROM tribes');

  await audit(adminId, 'factoryReset', 'complete');
  return { ok:true, at: new Date().toISOString() };
}

export async function listTables(){
  const r = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema='public'
      ORDER BY table_name`
  );
  return r.rows.map(x => x.table_name);
}