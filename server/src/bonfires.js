// TRIBES-FILE: server/src/bonfires.js
// PHASE: 7 — Meta & Admin
// Scheduled events that multiply ember / renown / ash / checkin / war.

import { q } from './db.js';
import { notifyAll } from './notifications.js';
import { feedWrite } from './feed.js';

const VALID_METRICS = ['ember', 'renown', 'ash', 'checkin', 'war'];

export async function list() {
  return (await q(
    `SELECT id, title, metric, multiplier, start_at, end_at, created_by, created_at
       FROM bonfire_events
      ORDER BY start_at DESC LIMIT 30`
  )).rows;
}

export async function active() {
  const r = await q(
    `SELECT id, title, metric, multiplier, start_at, end_at
       FROM bonfire_events
      WHERE start_at <= now() AND end_at > now()
      ORDER BY start_at DESC LIMIT 1`
  );
  return r.rows[0] || null;
}

export async function create(adminId, data) {
  const title = String(data.title || '').slice(0, 60) || 'Bonfire';
  const metric = String(data.metric || 'ember');
  if (!VALID_METRICS.includes(metric)) throw new Error('bad metric');
  const mult = Math.max(1, Math.min(10, Number(data.multiplier) || 2));
  const start = data.start_at ? new Date(data.start_at) : new Date();
  const end = data.end_at ? new Date(data.end_at) : new Date(Date.now() + 2 * 3600 * 1000);
  if (end <= start) throw new Error('end must be after start');

  // clamp overlapping future events
  await q(
    'UPDATE bonfire_events SET end_at = LEAST(end_at, $1) WHERE end_at > $1',
    [start]
  );

  const r = await q(
    `INSERT INTO bonfire_events (title, metric, multiplier, start_at, end_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [title, metric, mult, start, end, adminId || null]
  );

  await notifyAll({
    type: 'system',
    title: `🔥 ${title}`,
    body: `${metric} ×${mult} until ${end.toUTCString().slice(0, 16)}`,
    severity: 'info',
    action_kind: 'hearth',
    push: true,
  });

  feedWrite({
    type: 'bonfire',
    icon: 'bolt',
    severity: 'success',
    text: `Bonfire: ${title} (${metric} ×${mult})`,
    actor: adminId,
  });

  return r.rows[0];
}

export async function end(adminId, id) {
  const r = await q(
    'UPDATE bonfire_events SET end_at=now() WHERE id=$1 RETURNING id',
    [id]
  );
  if (!r.rowCount) throw new Error('no such bonfire');
  return { id, ended: true };
}