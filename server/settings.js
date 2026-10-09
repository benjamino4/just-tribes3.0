import { q } from './db.js';

// ─── Tiny key/value settings store (app_settings table) ─────────────────────
// Used for admin-tunable toggles like the Antechamber gate. Every read is
// defensive: if the table isn't migrated yet we fall back gracefully instead
// of throwing (the app must still boot on a fresh DB).

export async function getSetting(key, fallback = null) {
  try {
    const { rows } = await q(`SELECT value FROM app_settings WHERE key=$1`, [key]);
    return rows.length ? rows[0].value : fallback;
  } catch {
    return fallback;
  }
}

export async function getSettings(keys) {
  try {
    const { rows } = await q(`SELECT key, value FROM app_settings WHERE key = ANY($1)`, [keys]);
    const o = {};
    rows.forEach((r) => { o[r.key] = r.value; });
    return o;
  } catch {
    return {};
  }
}

export async function setSetting(key, value) {
  await q(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, String(value)]
  );
}
