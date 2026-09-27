// TRIBES-FILE: server/src/env.js
// PHASE: 2 — Identity & shell
// Minimal zero-dependency .env loader.
// Reads ../.env (project root) or server/.env if present, sets process.env
// for any key that isn't already set. Real environment variables always win
// (so Render's dashboard values override a stray .env).
//
// Imported as the FIRST line of server/src/index.js so that every module
// evaluated afterwards — db.js's buildPool(), auth.js's BOT_TOKEN capture —
// sees the loaded values.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_ENV   = path.join(__dirname, '..', '..', '.env');   // tribes/.env
const SERVER_ENV = path.join(__dirname, '..', '.env');         // tribes/server/.env

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
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
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
  } catch {
    return false;
  }
}

let loaded = false;
if (loadIfPresent(ROOT_ENV))   loaded = true;
if (loadIfPresent(SERVER_ENV)) loaded = true;

if (loaded) console.log('[env] .env loaded');

export const envLoaded = loaded;
