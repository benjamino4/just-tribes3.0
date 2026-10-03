// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/admin_edit.js
// PURPOSE: Safe file editing. Version history. Auto-revert on error.
//          Triggers Render rebuild via API.
// DEPENDS ON: db.js, config.js
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { q } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_DIRS = [
  'server/src/live',
  'server/src/content',
  'web/src/content',
  'web/src/data',
  'web/src/styles/games',
];

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', '.data');
const LIVE_DIR = path.join(DATA_DIR, 'live');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

let consecutiveErrors = 0;
let lastEditedFile = null;
let lastEditedAt = 0;

export function recordError(error, sourceFile) {
  consecutiveErrors++;
  if (consecutiveErrors >= 3 && sourceFile) {
    autoRevert(sourceFile).catch(() => {});
    consecutiveErrors = 0;
  }
}

export function recordSuccess() {
  consecutiveErrors = 0;
  if (lastEditedFile && Date.now() - lastEditedAt > 5 * 60 * 1000) {
    lastEditedFile = null;
  }
}

function validatePath(p) {
  const normalized = path.normalize(p).replace(/^(\.\.(\/|\\|$))+/, '');
  const allowed = ALLOWED_DIRS.some((dir) => normalized.startsWith(dir));
  if (!allowed) throw new Error('Path not allowed: ' + p);
  return path.resolve(process.cwd(), normalized);
}

function validateFile(filePath, content) {
  if (filePath.endsWith('.json')) {
    try { JSON.parse(content); return { ok: true }; }
    catch (e) { return { ok: false, error: 'Invalid JSON: ' + e.message }; }
  }
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts')) {
    const opens = (content.match(/[{[(]/g) || []).length;
    const closes = (content.match(/[}\])]/g) || []).length;
    if (opens !== closes) return { ok: false, error: 'Unbalanced brackets' };
    return { ok: true };
  }
  return { ok: true };
}

export async function readFile(filePath, adminId) {
  const safePath = validatePath(filePath);
  const content = await fs.readFile(safePath, 'utf8');
  return { path: filePath, content, size: content.length };
}

export async function writeFile(adminId, filePath, newContent, note = null) {
  const safePath = validatePath(filePath);
  const validation = validateFile(filePath, newContent);
  if (!validation.ok) throw new Error('Validation failed: ' + validation.error);

  let oldContent = null;
  try { oldContent = await fs.readFile(safePath, 'utf8'); } catch {}

  if (oldContent !== null) {
    await q(
      'INSERT INTO file_versions (file_path, content, edited_by, note) VALUES ($1,$2,$3,$4)',
      [filePath, oldContent, adminId, note]
    );
  }

  await fs.mkdir(path.dirname(safePath), { recursive: true });
  await fs.writeFile(safePath, newContent, 'utf8');

  lastEditedFile = filePath;
  lastEditedAt = Date.now();

  const requiresRebuild = filePath.startsWith('web/');
  if (requiresRebuild) {
    triggerRebuild().catch(() => {});
  }

  return { ok: true, requiresRebuild };
}

export async function stageEdit(adminId, filePath, newContent, note) {
  const safePath = validatePath(filePath);
  const validation = validateFile(filePath, newContent);
  if (!validation.ok) throw new Error('Validation failed: ' + validation.error);

  const oldContent = await fs.readFile(safePath, 'utf8').catch(() => null);

  const r = await q(
    `INSERT INTO pending_edits (admin_id, file_path, old_content, new_content, note)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [adminId, filePath, oldContent, newContent, note || null]
  );

  return { id: r.rows[0].id, diff: computeDiff(oldContent, newContent) };
}

export async function applyEdit(adminId, editId) {
  const edit = (await q('SELECT * FROM pending_edits WHERE id=$1 AND status=$2',
    [editId, 'pending'])).rows[0];
  if (!edit) throw new Error('no such pending edit');

  const safePath = validatePath(edit.file_path);

  if (edit.old_content) {
    await q(
      'INSERT INTO file_versions (file_path, content, edited_by, note) VALUES ($1,$2,$3,$4)',
      [edit.file_path, edit.old_content, adminId, edit.note]
    );
  }

  await fs.mkdir(path.dirname(safePath), { recursive: true });
  await fs.writeFile(safePath, edit.new_content, 'utf8');

  await q(
    'UPDATE pending_edits SET status=$1, applied_at=now() WHERE id=$2',
    ['applied', editId]
  );

  const requiresRebuild = edit.file_path.startsWith('web/');
  if (requiresRebuild) {
    triggerRebuild().catch(() => {});
  }

  return { ok: true, requiresRebuild };
}

async function autoRevert(filePath) {
  const prev = (await q(
    'SELECT content FROM file_versions WHERE file_path=$1 ORDER BY edited_at DESC LIMIT 1',
    [filePath]
  )).rows[0];
  if (!prev) return;
  const safePath = validatePath(filePath);
  await fs.writeFile(safePath, prev.content, 'utf8');
  await q(
    'INSERT INTO audit (admin_id, action, target, detail) VALUES ($1,$2,$3,$4)',
    ['system', 'auto_revert', filePath, 'reverted due to 3 consecutive errors']
  );
}

export async function triggerRebuild() {
  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.RENDER_SERVICE_ID;
  if (!apiKey || !serviceId) {
    console.log('[rebuild] Render API not configured');
    return { ok: false, reason: 'not_configured' };
  }
  try {
    const r = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ clearCache: 'do_not_clear' })
    });
    const j = await r.json();
    return { ok: r.ok, deploy: j };
  } catch (e) {
    console.warn('[rebuild] failed', e.message);
    return { ok: false, error: e.message };
  }
}

function computeDiff(oldC, newC) {
  const oldLines = (oldC || '').split('\n');
  const newLines = newC.split('\n');
  const diff = [];
  const max = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < max; i++) {
    if (oldLines[i] !== newLines[i]) {
      if (oldLines[i] !== undefined) diff.push({ type: 'remove', line: i + 1, text: oldLines[i] });
      if (newLines[i] !== undefined) diff.push({ type: 'add', line: i + 1, text: newLines[i] });
    }
  }
  return diff;
}

export async function listVersions(filePath) {
  return (await q(
    'SELECT id, edited_by, edited_at, note, length(content) AS size FROM file_versions WHERE file_path=$1 ORDER BY edited_at DESC LIMIT 20',
    [filePath]
  )).rows;
}

export async function revertToVersion(adminId, filePath, versionId) {
  const v = (await q('SELECT content FROM file_versions WHERE id=$1 AND file_path=$2',
    [versionId, filePath])).rows[0];
  if (!v) throw new Error('no such version');
  return await writeFile(adminId, filePath, v.content, `revert to v${versionId}`);
}

export function runSelfEditWatcher() {
  setInterval(() => {
    // Clean stale pending edits (older than 24h)
    q("DELETE FROM pending_edits WHERE status='pending' AND created_at < now() - interval '24 hours'").catch(() => {});
  }, 60 * 60 * 1000).unref();
}