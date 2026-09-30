// TRIBES-FILE: server/src/store.js
// PHASE: 4 — Rise of the Eternal Flame (monetization hub)
//
// Paid tribe branding + the store catalog. All prices are in the internal
// Stars balance (users.stars), which is topped up with real money via
// Telegram Stars (stars.js) or TON (ton.js). Every mutation is Chief-gated,
// server-authoritative, and deducts Stars atomically.
//
// Perks are ONE-TIME unlocks: once a tribe owns 'name' / 'icon' / 'banner',
// the Chief edits that branding freely (re-crop, rename, restyle) at no extra
// cost — which matches the "crop, position, then save" UX on the client.

import { q } from './db.js';
import { CFG, cfgJSON } from './config.js';

function num(v, fb = 0) { const n = Number(v); return Number.isFinite(n) ? n : fb; }

function fonts() { return cfgJSON('tribe_name_fonts', []); }
function styles() { return cfgJSON('tribe_name_styles', []); }

const PERKS = {
  name:   { col: 'perk_name',   cfg: 'tribe_name_perk_stars',   label: 'Custom Tribe Name' },
  icon:   { col: 'perk_icon',   cfg: 'tribe_icon_perk_stars',   label: 'Custom Tribe Icon' },
  banner: { col: 'perk_banner', cfg: 'tribe_banner_perk_stars', label: 'Premium Banner' },
};

async function loadTribe(id) {
  return (await q(
    `SELECT id, name, motto, palette, banner, icon_url, name_font, name_style,
            banner_style, perk_name, perk_icon, perk_banner
       FROM tribes WHERE id=$1`, [id]
  )).rows[0] || null;
}

// A user may brand the tribe only if they are the Chief of it.
function assertChief(user) {
  if (!user.tribe_id) { const e = new Error('join a tribe first'); throw e; }
  if (user.role !== 'Chief') { const e = new Error('only the Chief may customize the tribe'); throw e; }
}

async function spendStars(user, price) {
  if (user.blessed) return 0;                    // blessed accounts skip the cost
  if (num(user.stars) < price) {
    const e = new Error(`Need ${price} Stars`); e.need = price; throw e;
  }
  await q('UPDATE users SET stars = stars - $1 WHERE id=$2', [price, user.id]);
  user.stars = num(user.stars) - price;
  return price;
}

/* ---------------- state ---------------- */
export async function storeState(user) {
  const tribe = user.tribe_id ? await loadTribe(user.tribe_id) : null;
  return {
    stars: num(user.stars),
    is_chief: user.role === 'Chief',
    in_tribe: !!user.tribe_id,
    prices: {
      pin_message: num(CFG.pin_message_stars, 130),
      perk_name:   num(CFG.tribe_name_perk_stars, 400),
      perk_icon:   num(CFG.tribe_icon_perk_stars, 500),
      perk_banner: num(CFG.tribe_banner_perk_stars, 260),
    },
    fonts: fonts(),
    styles: styles(),
    name_max_len: num(CFG.tribe_name_max_len, 24),
    tribe: tribe && {
      id: tribe.id,
      name: tribe.name,
      icon_url: tribe.icon_url || null,
      name_font: tribe.name_font || 'default',
      name_style: tribe.name_style || 'plain',
      banner_style: tribe.banner_style || 'plain',
      perks: {
        name: !!tribe.perk_name,
        icon: !!tribe.perk_icon,
        banner: !!tribe.perk_banner,
      },
    },
  };
}

/* ---------------- buy a one-time perk ---------------- */
export async function buyPerk(user, perkId) {
  assertChief(user);
  const perk = PERKS[perkId];
  if (!perk) throw new Error('unknown perk');
  const tribe = await loadTribe(user.tribe_id);
  if (!tribe) throw new Error('tribe not found');
  if (tribe[perk.col]) return { ok: true, already: true, perk: perkId };

  const price = num(CFG[perk.cfg]);
  const spent = await spendStars(user, price);
  await q(`UPDATE tribes SET ${perk.col}=TRUE WHERE id=$1`, [user.tribe_id]);
  return { ok: true, perk: perkId, spent, stars: num(user.stars) };
}

/* ---------------- custom tribe name + font + style ---------------- */
export async function setTribeName(user, { name, font, style } = {}) {
  assertChief(user);
  const tribe = await loadTribe(user.tribe_id);
  if (!tribe) throw new Error('tribe not found');
  if (!tribe.perk_name) { const e = new Error('unlock the Custom Tribe Name perk first'); e.need_perk = 'name'; throw e; }

  const clean = String(name || '').trim().replace(/\s+/g, ' ');
  const max = num(CFG.tribe_name_max_len, 24);
  if (clean.length < 3 || clean.length > max) throw new Error(`Name must be 3\u2013${max} characters`);
  if (!/^[\p{L}\p{N} '\-\u00b7]+$/u.test(clean)) throw new Error('Name has invalid characters');

  // case-insensitive uniqueness against every other tribe
  const clash = (await q(
    'SELECT id FROM tribes WHERE lower(name)=lower($1) AND id<>$2', [clean, user.tribe_id]
  )).rows[0];
  if (clash) throw new Error('That name is already taken');

  const fontId  = fonts().some((f) => f.id === font)   ? font  : 'default';
  const styleId = styles().some((s) => s.id === style) ? style : 'plain';

  await q(
    'UPDATE tribes SET name=$1, name_font=$2, name_style=$3 WHERE id=$4',
    [clean, fontId, styleId, user.tribe_id]
  );
  return { ok: true, name: clean, name_font: fontId, name_style: styleId };
}

/* ---------------- custom tribe icon (circular, client-cropped) ---------------- */
// The client crops + positions the image on a <canvas> and sends a small,
// square PNG/JPEG/WebP data URL. We validate the shape + size here; the
// browser has already produced the final circle-masked bitmap.
export async function setTribeIcon(user, dataUrl) {
  assertChief(user);
  const tribe = await loadTribe(user.tribe_id);
  if (!tribe) throw new Error('tribe not found');
  if (!tribe.perk_icon) { const e = new Error('unlock the Custom Tribe Icon perk first'); e.need_perk = 'icon'; throw e; }

  if (dataUrl == null || dataUrl === '') {
    await q('UPDATE tribes SET icon_url=NULL WHERE id=$1', [user.tribe_id]);
    return { ok: true, icon_url: null };
  }

  const s = String(dataUrl);
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(s);
  if (!m) throw new Error('Icon must be a PNG, JPEG or WebP image');

  const maxKb = num(CFG.tribe_icon_max_kb, 130);
  // base64 length * 3/4 ≈ decoded bytes
  const bytes = Math.floor(m[2].length * 0.75);
  if (bytes > maxKb * 1024) throw new Error(`Icon too large \u2014 keep it under ${maxKb} KB`);

  await q('UPDATE tribes SET icon_url=$1 WHERE id=$2', [s, user.tribe_id]);
  return { ok: true, icon_url: s, bytes };
}

/* ---------------- premium banner styling ---------------- */
export async function setBannerStyle(user, styleId) {
  assertChief(user);
  const tribe = await loadTribe(user.tribe_id);
  if (!tribe) throw new Error('tribe not found');
  if (!tribe.perk_banner) { const e = new Error('unlock the Premium Banner perk first'); e.need_perk = 'banner'; throw e; }
  const ok = styles().some((s) => s.id === styleId) || styleId === 'plain';
  const val = ok ? styleId : 'plain';
  await q('UPDATE tribes SET banner_style=$1 WHERE id=$2', [val, user.tribe_id]);
  return { ok: true, banner_style: val };
}
