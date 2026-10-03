import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const LIVE_DIR = path.join(DATA_DIR, 'live');
const VERSIONS_DIR = path.join(DATA_DIR, 'versions');
const CACHE_MS = 200;
const cache = new Map();

export async function initLive() {
  await fs.mkdir(LIVE_DIR, { recursive: true });
  await fs.mkdir(VERSIONS_DIR, { recursive: true });
  // Seed defaults if missing
  const defaults = {
    'verses.json': {
      patterns: [
        { template: '{verb} the {noun}.', category: 'any' },
        { template: '{adj} {noun}, {adj} {noun}.', category: 'any' },
        { template: 'The {noun} {verb}s.', category: 'any' },
        { template: 'Feed the fire, kin.', category: 'welcome' },
        { template: 'Blood remembers blood.', category: 'war', literal: true }
      ],
      vocabulary: {
        verb: ['Feed', 'Wake', 'Raise', 'Stoke', 'Tend', 'Guard', 'Forge', 'Hold', 'Hunt', 'Rise'],
        noun: ['fire', 'tribe', 'ash', 'kin', 'banner', 'blade', 'stone', 'mountain', 'ember', 'rune'],
        adj: ['cold', 'warm', 'old', 'young', 'dark', 'bright', 'fierce', 'quiet', 'sacred', 'eternal']
      }
    },
    'help.json': [
      { slug: 'basics', section: 'Basics', title: 'What is TRIBES?', body: 'TRIBES is a stone-age tribe game. Feed your fire, join a tribe, fight in mini-games.' },
      { slug: 'hearth', section: 'Hearth', title: 'The Hearth', body: 'Your Hearth is your fire. Feed it daily to keep your streak.' },
      { slug: 'arena', section: 'Arena', title: 'The Arena', body: 'Fight other players 1v1 in mini-games. Ranked matches give Kinship.' },
      { slug: 'tribe', section: 'Tribe', title: 'The Tribe', body: 'A tribe has 7 named seats. Rank determines them weekly.' },
      { slug: 'forgotten', section: 'Lore', title: 'The Forgotten Ones', body: 'Some fighters bear a small carved rune. They are the Forgotten — those who stayed when others left. Treat them as you would any warrior.' }
    ],
    'colors.json': {
      'midnight-0': '#0a0e14', 'midnight-1': '#0f141c', 'midnight-2': '#161c26',
      'ember-400': '#d46f2c', 'ember-200': '#f7a259',
      'jade-300': '#55a882', 'lapis-300': '#5a7fa5',
      'slate-100': '#c9d4e0', 'slate-200': '#8e9aaa'
    },
    'game_texts.json': {
      rune_match: { name: 'Rune Match', rule: 'Swap two runes. Match three to clear them.' },
      stone_stack: { name: 'Stone Stack', rule: 'Stack stones. Do not miss the timing.' },
      fireflies: { name: 'Fireflies', rule: 'Catch every firefly before it escapes.' },
      ember_reflex: { name: 'Ember Reflex', rule: 'Tap the fire as soon as it lights.' },
      rite_of_hands: { name: 'Rite of Hands', rule: 'Read their pattern, beat their throw.' },
      three_masks: { name: 'Three Masks', rule: 'Guess their mask.' }
    }
  };
  for (const [name, content] of Object.entries(defaults)) {
    const p = path.join(LIVE_DIR, name);
    try { await fs.access(p); }
    catch { await fs.writeFile(p, JSON.stringify(content, null, 2), 'utf8'); }
  }
}

export async function readLive(fileName) {
  const now = Date.now();
  const cached = cache.get(fileName);
  if (cached && now - cached.at < CACHE_MS) return cached.value;
  const filePath = path.join(LIVE_DIR, fileName);
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const value = JSON.parse(content);
    cache.set(fileName, { value, at: now });
    return value;
  } catch (e) {
    console.warn('[live] failed to read', fileName, e.message);
    return cached?.value || null;
  }
}

export async function writeLive(fileName, value, adminId = null, note = null) {
  const filePath = path.join(LIVE_DIR, fileName);
  let oldContent = '';
  try { oldContent = await fs.readFile(filePath, 'utf8'); } catch {}
  // Save version
  const { q } = await import('./db.js');
  await q(
    'INSERT INTO file_versions (file_path, content, edited_by, note) VALUES ($1,$2,$3,$4)',
    [fileName, oldContent, adminId, note]
  );
  // Write in place (preserve inode)
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
  cache.delete(fileName);
  return { ok: true };
}

export async function listLive() {
  const files = await fs.readdir(LIVE_DIR);
  return files.filter(f => f.endsWith('.json'));
}

export async function revertLive(fileName, versionId, adminId) {
  const { q } = await import('./db.js');
  const v = (await q('SELECT * FROM file_versions WHERE id=$1 AND file_path=$2', [versionId, fileName])).rows[0];
  if (!v) throw new Error('version not found');
  const current = await readLive(fileName);
  await writeLive(fileName, JSON.parse(v.content), adminId, `revert to v${versionId}`);
  return { ok: true, from: current, to: JSON.parse(v.content) };
}

export async function listVersions(fileName) {
  const { q } = await import('./db.js');
  return (await q(
    'SELECT id, edited_by, edited_at, note FROM file_versions WHERE file_path=$1 ORDER BY id DESC LIMIT 50',
    [fileName]
  )).rows;
}