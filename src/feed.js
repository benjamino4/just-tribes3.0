/* =====================================================================
   TRIBES — Unified admin feed writer + reader.
   Every interesting event writes one row here. The Warden right-rail
   subscribes via SSE and/or polls /api/admin/feed.
===================================================================== */
import { q } from './db.js';

const MAX_ROWS = 2000;             // server-side retention
const PRUNE_BATCH = 200;           // delete this many oldest when trimming
let pruneCounter = 0;

/* ---------- write ---------- */
/**
 * @param {object} evt
 * @param {string} evt.type     — 'audit'|'user'|'tribe'|'war'|'payment'|'x'|'spin'|'quest'|'raid'|'system'
 * @param {string} evt.icon     — icon name from sprite (optional)
 * @param {string} evt.severity — 'info'|'success'|'warn'|'danger'
 * @param {string} evt.text     — short line for the feed
 * @param {object} [evt.detail] — any extra JSON (clicked to expand)
 * @param {string|number} [evt.actor] — admin id or user id who caused it
 */
export async function feedWrite(evt){
  try {
    const detail = evt.detail ? JSON.stringify(evt.detail) : null;
    await q(
      `INSERT INTO admin_feed (type, icon, severity, text, detail, actor)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        String(evt.type || 'system').slice(0, 24),
        String(evt.icon || 'status-info').slice(0, 32),
        String(evt.severity || 'info').slice(0, 12),
        String(evt.text || '').slice(0, 240),
        detail,
        evt.actor != null ? String(evt.actor).slice(0, 64) : null,
      ]
    );

    // opportunistic prune every 50 writes
    pruneCounter++;
    if (pruneCounter >= 50){
      pruneCounter = 0;
      prune().catch(() => {});
    }
  } catch(e){
    // Feed writes must never break a real action.
    console.warn('[feed] write', e.message);
  }
}

/* ---------- read (cursor-based) ---------- */
export async function feedRead({ since = 0, limit = 60, type = null } = {}){
  const lim = Math.max(1, Math.min(200, Number(limit) || 60));
  let r;
  if (type){
    r = await q(
      `SELECT id, ts, type, icon, severity, text, detail, actor
         FROM admin_feed
        WHERE id > $1 AND type = $2
        ORDER BY id ASC
        LIMIT $3`,
      [Number(since) || 0, type, lim]
    );
  } else {
    r = await q(
      `SELECT id, ts, type, icon, severity, text, detail, actor
         FROM admin_feed
        WHERE id > $1
        ORDER BY id ASC
        LIMIT $2`,
      [Number(since) || 0, lim]
    );
  }
  return r.rows.map(row => ({
    ...row,
    detail: safeJSON(row.detail),
  }));
}

/* ---------- latest N (initial paint) ---------- */
export async function feedLatest(limit = 60){
  const lim = Math.max(1, Math.min(200, Number(limit) || 60));
  const r = await q(
    `SELECT id, ts, type, icon, severity, text, detail, actor
       FROM admin_feed
      ORDER BY id DESC
      LIMIT $1`,
    [lim]
  );
  return r.rows.reverse().map(row => ({
    ...row,
    detail: safeJSON(row.detail),
  }));
}

/* ---------- prune ---------- */
async function prune(){
  await q(
    `DELETE FROM admin_feed
      WHERE id IN (
        SELECT id FROM admin_feed
         ORDER BY id ASC
         LIMIT $1
      )`,
    [PRUNE_BATCH]
  );
}

export async function feedCounts(){
  const r = await q(
    `SELECT type, count(*)::int AS n FROM admin_feed GROUP BY type`
  );
  const out = {};
  for (const row of r.rows) out[row.type] = row.n;
  return out;
}

function safeJSON(s){
  if (!s) return null;
  try { return JSON.parse(s); } catch(e){ return null; }
}