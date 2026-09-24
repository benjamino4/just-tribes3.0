// ============================================================================
// Added in Phase 1 — Trials editor, Bonfire scheduler, Names pool.
// Attach these to the existing adminRouter in the same file.
// ============================================================================
import { q } from './db.js';
import { resetAllTrials } from './trials.js';
import { enqueue as pushEnqueue } from './push.js';

// ---------- Trials ----------
export async function trialsList(){
  return (await q(
    `SELECT id, slug, name, glyph, hint, reward_ember, reward_loyalty,
            cooldown_hours, max_per_window, window_hours, window_start_utc,
            active, sort_order, created_at
       FROM trials ORDER BY sort_order, id`
  )).rows;
}

export async function trialCreate(adminId, data){
  const slug = String(data.slug||'').trim().toLowerCase().replace(/[^a-z0-9_]/g,'').slice(0,32);
  if (slug.length < 2) throw new Error('slug must be 2+ chars a-z0-9_');
  const r = await q(
    `INSERT INTO trials (slug, name, glyph, hint, reward_ember, reward_loyalty,
                         cooldown_hours, max_per_window, window_hours, window_start_utc, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [slug,
     String(data.name||'').slice(0,40) || slug,
     String(data.glyph||'🔥').slice(0,8),
     String(data.hint||'').slice(0,120),
     Math.max(0, Math.floor(Number(data.reward_ember)||0)),
     Math.max(0, Math.floor(Number(data.reward_loyalty)||0)),
     Math.max(0, Math.floor(Number(data.cooldown_hours)||20)),
     Math.max(1, Math.floor(Number(data.max_per_window)||1)),
     Math.max(0, Math.floor(Number(data.window_hours)||0)),
     Math.max(0, Math.min(23, Math.floor(Number(data.window_start_utc)||0))),
     !!data.active,
     Math.floor(Number(data.sort_order)||100)]
  );
  await audit(adminId, 'trialCreate', slug);
  return r.rows[0];
}

export async function trialUpdate(adminId, id, data){
  const cur = (await q('SELECT * FROM trials WHERE id=$1', [id])).rows[0];
  if (!cur) throw new Error('no such trial');
  const merged = { ...cur, ...data };
  const r = await q(
    `UPDATE trials SET
        name=$1, glyph=$2, hint=$3, reward_ember=$4, reward_loyalty=$5,
        cooldown_hours=$6, max_per_window=$7, window_hours=$8, window_start_utc=$9,
        active=$10, sort_order=$11
      WHERE id=$12 RETURNING *`,
    [String(merged.name||'').slice(0,40),
     String(merged.glyph||'🔥').slice(0,8),
     String(merged.hint||'').slice(0,120),
     Math.max(0, Math.floor(Number(merged.reward_ember)||0)),
     Math.max(0, Math.floor(Number(merged.reward_loyalty)||0)),
     Math.max(0, Math.floor(Number(merged.cooldown_hours)||0)),
     Math.max(1, Math.floor(Number(merged.max_per_window)||1)),
     Math.max(0, Math.floor(Number(merged.window_hours)||0)),
     Math.max(0, Math.min(23, Math.floor(Number(merged.window_start_utc)||0))),
     !!merged.active,
     Math.floor(Number(merged.sort_order)||100),
     id]
  );
  await audit(adminId, 'trialUpdate', `trial ${id}`);
  return r.rows[0];
}

export async function trialDelete(adminId, id){
  const r = await q('DELETE FROM trials WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('no such trial');
  await audit(adminId, 'trialDelete', r.rows[0].slug);
  return { id, deleted:true };
}

export async function trialResetAll(adminId){
  const r = await resetAllTrials();
  await audit(adminId, 'trialResetAll', r.reset_at);
  return r;
}

// ---------- Bonfire ----------
export async function bonfireList(){
  return (await q(
    `SELECT id, title, metric, multiplier, start_at, end_at, created_by, created_at
       FROM bonfire_events ORDER BY start_at DESC LIMIT 30`
  )).rows;
}
export async function bonfireCreate(adminId, data){
  const title = String(data.title||'').slice(0,60) || 'Bonfire';
  const metric = String(data.metric||'ember');
  if (!['ember','loyalty','ash','checkin','war'].includes(metric)) throw new Error('bad metric');
  const mult = Math.max(1, Math.min(10, Number(data.multiplier)||2));
  const start = data.start_at ? new Date(data.start_at) : new Date();
  const end   = data.end_at   ? new Date(data.end_at)   : new Date(Date.now() + 2*3600*1000);
  if (end <= start) throw new Error('end must be after start');

  // Only one active at a time: end any others whose window overlaps.
  await q(`UPDATE bonfire_events SET end_at = LEAST(end_at, $1) WHERE end_at > $1`, [start]);

  const r = await q(
    `INSERT INTO bonfire_events (title, metric, multiplier, start_at, end_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title, metric, mult, start, end, adminId]
  );
  await audit(adminId, 'bonfireCreate', `${title} (${metric} x${mult})`);

  // Notify everyone whose bot has them
  const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
  for (const row of ids) await pushEnqueue(row.id, `🔥 ${title} — ${metric} ×${mult} until ${end.toUTCString().slice(0,16)}`);
  return r.rows[0];
}
export async function bonfireEnd(adminId, id){
  const r = await q(`UPDATE bonfire_events SET end_at = now() WHERE id=$1 RETURNING id`, [id]);
  if (!r.rowCount) throw new Error('no such bonfire');
  await audit(adminId, 'bonfireEnd', String(id));
  return { id, ended:true };
}

// ---------- Names pool ----------
export async function namesList(){
  return (await q(
    `SELECT n.id, n.name, n.is_seed, n.claimed_by_tribe_id, t.name AS claimed_by_name
       FROM tribe_names n
       LEFT JOIN tribes t ON t.id = n.claimed_by_tribe_id
       ORDER BY n.claimed_by_tribe_id IS NULL DESC, n.name`
  )).rows;
}
export async function nameAdd(adminId, name){
  const clean = String(name||'').trim().slice(0, 32);
  if (clean.length < 3) throw new Error('name too short');
  const r = await q(
    `INSERT INTO tribe_names (name, is_seed) VALUES ($1, false)
     ON CONFLICT (name) DO NOTHING RETURNING id, name`,
    [clean]
  );
  if (!r.rowCount) throw new Error('name already in pool');
  await audit(adminId, 'nameAdd', clean);
  return r.rows[0];
}
export async function nameDelete(adminId, id){
  const r = await q(
    `DELETE FROM tribe_names WHERE id=$1 AND claimed_by_tribe_id IS NULL RETURNING name`,
    [id]
  );
  if (!r.rowCount) throw new Error('not found or already claimed');
  await audit(adminId, 'nameDelete', r.rows[0].name);
  return { id, deleted:true };
}

// ============================================================================
// New routes — append these to the existing adminRouter.
// ============================================================================
export function attachPhase1Routes(A, wrap, who){
  // Trials
  A.get('/trials',        wrap(()=>trialsList()));
  A.post('/trials',       wrap(req=>trialCreate(who(req), req.body)));
  A.post('/trials/update',wrap(req=>trialUpdate(who(req), req.body.id, req.body)));
  A.post('/trials/delete',wrap(req=>trialDelete(who(req), req.body.id)));
  A.post('/trials/reset', wrap(()=>trialResetAll(who(req))));

  // Bonfire
  A.get('/bonfires',      wrap(()=>bonfireList()));
  A.post('/bonfires',     wrap(req=>bonfireCreate(who(req), req.body)));
  A.post('/bonfires/end', wrap(req=>bonfireEnd(who(req), req.body.id)));

  // Names pool
  A.get('/names',         wrap(()=>namesList()));
  A.post('/names/add',    wrap(req=>nameAdd(who(req), req.body.name)));
  A.post('/names/delete', wrap(req=>nameDelete(who(req), req.body.id)));
}