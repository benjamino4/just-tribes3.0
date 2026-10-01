import { q } from './db.js';

const MAX_ROWS = 3000;
const PRUNE_BATCH = 300;
let pruneCounter = 0;

export async function feedWrite(evt) {
  try {
    const detail = evt.detail ? JSON.stringify(evt.detail) : null;
    await q(
      `INSERT INTO admin_feed (type, icon, severity, text, detail, actor)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [String(evt.type || 'system').slice(0, 24),
       String(evt.icon || 'spark').slice(0, 32),
       String(evt.severity || 'info').slice(0, 12),
       String(evt.text || '').slice(0, 240),
       detail,
       evt.actor != null ? String(evt.actor).slice(0, 64) : null]
    );
    pruneCounter++;
    if (pruneCounter >= 50) { pruneCounter = 0; prune().catch(() => {}); }
  } catch (e) { console.warn('[feed] write', e.message); }
}

export async function feedRead({ since = 0, limit = 60, type = null } = {}) {
  const lim = Math.max(1, Math.min(200, Number(limit) || 60));
  let r;
  if (type) {
    r = await q(
      `SELECT id, ts, type, icon, severity, text, detail, actor
         FROM admin_feed WHERE id > $1 AND type = $2
        ORDER BY id ASC LIMIT $3`, [Number(since) || 0, type, lim]
    );
  } else {
    r = await q(
      `SELECT id, ts, type, icon, severity, text, detail, actor
         FROM admin_feed WHERE id > $1
        ORDER BY id ASC LIMIT $2`, [Number(since) || 0, lim]
    );
  }
  return r.rows.map((row) => ({ ...row, detail: safeJSON(row.detail) }));
}

async function prune() {
  await q(
    `DELETE FROM admin_feed
      WHERE id IN (SELECT id FROM admin_feed ORDER BY id ASC LIMIT $1)`,
    [PRUNE_BATCH]
  );
}

function safeJSON(s) { if (!s) return null; try { return JSON.parse(s); } catch { return null; } }

export const feedRecent = feedRead;