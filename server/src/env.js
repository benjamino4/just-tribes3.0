// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/env.js
// PURPOSE: Load .env from root or server directory. Never overwrites
//          existing process.env. Silent if no file present.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV = path.join(__dirname, '..', '..', '.env');
const SERVER_ENV = path.join(__dirname, '..', '.env');

function parse(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key) out[key] = val;
  }
  return out;
}

function loadIfPresent(file) {
  try {
    if (!fs.existsSync(file)) return false;
    const parsed = parse(fs.readFileSync(file, 'utf8'));
    for (const [k, v] of Object.entries(parsed)) {
      if (!(k in process.env)) process.env[k] = v;
    }
    return true;
  } catch { return false; }
}

let loaded = false;
if (loadIfPresent(ROOT_ENV)) loaded = true;
if (loadIfPresent(SERVER_ENV)) loaded = true;
if (loaded) console.log('[env] .env loaded');
export const envLoaded = loaded;