// TRIBES-FILE: server/src/tribes.js
// PHASE: 2 — Identity & shell
// Tribe create / join / leave / donate / upgrade.

import { q } from './db.js';
import { CFG } from './config.js';
import { addRenown, levelTable } from './economy.js';

export async function tribesList(limit = 60) {
  return (await q(
    `SELECT id,name,hue,motto,crest,banner,palette,members,renown_total,treasury,wins,losses,level
       FROM tribes
      ORDER BY renown_total DESC, members DESC
      LIMIT $1`,
    [limit]
  )).rows;
}

export async function tribeDetail(id) {
  const t = (await q('SELECT * FROM tribes WHERE id=$1', [id])).rows[0];
  if (!t) return null;
  const roster = (await q(
    `SELECT id, username, first_name, role, renown
       FROM users WHERE tribe_id=$1
      ORDER BY renown DESC LIMIT 50`,
    [id]
  )).rows;
  return { ...t, roster };
}

export async function namesAvailable() {
  return (await q(
    `SELECT id, name FROM tribe_names
      WHERE claimed_by_tribe_id IS NULL
      ORDER BY name`
  )).rows;
}

export async function createTribe(u, { nameId, palette = 'ember', banner = 'sun', motto = '' }) {
  if (u.tribe_id) throw new Error('already in a tribe');

  const PALETTES = ['ember','jade','frost','blood','gold','void'];
  const BANNERS  = ['sun','moon','wolf','bear','spear','shield','tree','flame'];

  if (!PALETTES.includes(palette)) throw new Error('bad palette');
  if (!BANNERS.includes(banner))   throw new Error('bad banner');
  if (Number(u.ember) < Number(CFG.foundEmber)) {
    const e = new Error('not enough Ember');
    e.need = CFG.foundEmber;
    throw e;
  }

  const nameRow = (await q(
    `SELECT id, name FROM tribe_names
      WHERE id=$1 AND claimed_by_tribe_id IS NULL
      FOR UPDATE`,
    [nameId]
  )).rows[0];
  if (!nameRow) throw new Error('that name has been claimed');

  const created = (await q(
    `INSERT INTO tribes (name, name_id, hue, motto, crest, banner, palette, level,
                         created_by, members, members_total, treasury)
     VALUES ($1,$2,0,$3,'totem',$4,$5,1,$6,1,1,0)
     RETURNING *`,
    [nameRow.name, nameRow.id, String(motto).slice(0, 80), banner, palette, u.id]
  )).rows[0];

  await q('UPDATE tribe_names SET claimed_by_tribe_id=$1 WHERE id=$2', [created.id, nameRow.id]);
  await q(
    'UPDATE users SET tribe_id=$1, ember=ember-$2, role=$3 WHERE id=$4',
    [created.id, CFG.foundEmber, 'Chief', u.id]
  );

  return created;
}

export async function joinTribe(u, tribeId) {
  if (u.tribe_id) throw new Error('already in a tribe');

  const t = (await q('SELECT * FROM tribes WHERE id=$1', [tribeId])).rows[0];
  if (!t) throw new Error('no such tribe');

  const { caps } = levelTable();
  const cap = caps[Math.max(0, Math.min(caps.length - 1, (t.level || 1) - 1))];
  if (t.members >= cap) throw new Error('this tribe is full');

  await q(
    'UPDATE tribes SET members=members+1, members_total=members_total+1 WHERE id=$1',
    [tribeId]
  );
  await q('UPDATE users SET tribe_id=$1 WHERE id=$2', [tribeId, u.id]);

  return t;
}

export async function leaveTribe(u) {
  if (!u.tribe_id) return;
  await q('UPDATE tribes SET members=GREATEST(0,members-1) WHERE id=$1', [u.tribe_id]);
  await q('UPDATE users SET tribe_id=NULL WHERE id=$1', [u.id]);
}

export async function donate(u, amount) {
  if (!u.tribe_id) throw new Error('join a tribe first');
  const amt = Math.floor(Number(amount) || 0);
  if (amt < 1) throw new Error('bad amount');
  if (Number(u.ember) < amt) throw new Error('not enough Ember');

  await q('UPDATE users SET ember=ember-$1 WHERE id=$2', [amt, u.id]);
  await q(
    'UPDATE tribes SET treasury=treasury+$1, donated_total=donated_total+$1 WHERE id=$2',
    [amt, u.tribe_id]
  );
  await addRenown(u, Math.floor(amt / (Number(CFG.renown_donateDiv) || 50)));
  return { donated: amt };
}

export async function upgradeTribe(u) {
  if (!u.tribe_id) throw new Error('no tribe');
  if (!['Chief', 'Head', 'Elder'].includes(u.role)) throw new Error('only Elders+');

  const t = (await q('SELECT * FROM tribes WHERE id=$1', [u.tribe_id])).rows[0];
  if (!t) throw new Error('no tribe');

  const { caps, costs, names } = levelTable();
  const cur = Number(t.level) || 1;
  if (cur >= costs.length) throw new Error('already at the highest level');
  const nextCost = Number(costs[cur]);
  if (Number(t.treasury) < nextCost) {
    const e = new Error('the Great Pyre is too shallow');
    e.need = nextCost;
    throw e;
  }

  await q(
    'UPDATE tribes SET treasury=treasury-$1, level=level+1 WHERE id=$2',
    [nextCost, t.id]
  );
  const newLevel = cur + 1;
  return {
    level: newLevel,
    name: names[newLevel - 1] || ('Level ' + newLevel),
    cap: caps[newLevel - 1],
  };
}