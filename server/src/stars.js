// TRIBES-FILE: server/src/stars.js
// PHASE: 8 — Payments + Polish
// Telegram Stars (XTR) invoices + webhook.

import { q } from './db.js';
import { CFG } from './config.js';
import { feedWrite } from './feed.js';
import { notify } from './notifications.js';
import { grantRelic, grantShard } from './relics.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const API = (t) => `https://api.telegram.org/bot${BOT_TOKEN}/${t}`;

async function tg(method, body) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set');
  const r = await fetch(API(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram API: ' + (j.description || 'error'));
  return j.result;
}

/* ---------- catalog ---------- */
export const STAR_ITEMS = {
  spark:   { title: 'Spark Pack',   desc: '5,000 Ember',                 stars: 60,   grant: { ember: 5000 } },
  flame:   { title: 'Flame Pack',   desc: '30,000 Ember (+20% bonus)',   stars: 300,  grant: { ember: 36000 } },
  blaze:   { title: 'Blaze Pack',   desc: '80,000 Ember (+35% bonus)',   stars: 700,  grant: { ember: 108000 } },
  inferno: { title: 'Inferno Pack', desc: '250,000 Ember (+60% bonus)',  stars: 2000, grant: { ember: 400000 } },

  firestone: { title: 'Firestone Relic',  desc: '+10% idle Ember, forever',    stars: 120, grant: { relic: 'firestone' } },
  boneidol:  { title: 'Bone Idol Relic',  desc: '+5% tribe renown share',     stars: 280, grant: { relic: 'boneidol' } },
  sundisc:   { title: 'Sun Disc Relic',   desc: '+25% Ash cap & 12h offline',  stars: 640, grant: { relic: 'sundisc' } },
  moonshard: { title: 'Moon Shard Relic', desc: '2x streak rewards',           stars: 520, grant: { relic: 'moonshard' } },

  name_color_ember: { title: 'Name: Ember', desc: 'Name glows ember in the Kiva', stars: 90, grant: { cosmetic: 'name_color', value: '#ff7a18' } },
  name_color_jade:  { title: 'Name: Jade',  desc: 'Name glows jade in the Kiva',  stars: 90, grant: { cosmetic: 'name_color', value: '#2adc8c' } },
  name_color_void:  { title: 'Name: Void',  desc: 'Name glows void in the Kiva',  stars: 90, grant: { cosmetic: 'name_color', value: '#9a6bff' } },
  glow_ember:       { title: 'Aura: Ember', desc: 'Ember halo around your avatar', stars: 120, grant: { cosmetic: 'avatar_glow', value: 'ember' } },
  glow_frost:       { title: 'Aura: Frost', desc: 'Frost halo around your avatar', stars: 120, grant: { cosmetic: 'avatar_glow', value: 'frost' } },

  starter_bundle: { title: 'Starter Bundle', desc: '10,000 Ember + Ember name color + Firestone', stars: 150, oneTime: true, grant: { starter: true } },
  shard_pack:     { title: 'Ashen Shards ×5', desc: '5 Ashen Shards (redeem for a rare cursed relic)', stars: 200, grant: { shards: 5 } },
};

export async function createStarInvoice(userId, itemId) {
  const it = STAR_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  if (it.oneTime) {
    const ex = await q(
      "SELECT 1 FROM payments WHERE user_id=$1 AND payload=$2 AND status='paid'",
      [userId, itemId]
    );
    if (ex.rowCount) throw new Error('Already purchased');
  }
  const payload = JSON.stringify({ u: userId, i: itemId, t: Date.now() });
  return tg('createInvoiceLink', {
    title: it.title,
    description: it.desc,
    payload,
    currency: 'XTR',
    prices: [{ label: it.title, amount: it.stars }],
  });
}

/* ---------- grant ---------- */
async function grantItem(userId, itemId, it, chargeId, payload) {
  // dedupe
  const ins = await q(
    `INSERT INTO payments (user_id, kind, charge_id, payload, amount, currency)
     VALUES ($1,'stars',$2,$3,$4,'XTR')
     ON CONFLICT (charge_id) DO NOTHING
     RETURNING id`,
    [userId, chargeId, payload, it.stars]
  );
  if (!ins.rowCount) return;

  const g = it.grant || {};

  if (g.ember) await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [g.ember, userId]);

  if (g.relic) {
    await grantRelic(userId, g.relic, { detail: 'Stars purchase' });
  }

  if (g.shards) {
    await grantShard(userId, g.shards);
  }

  if (g.cosmetic) {
    await q(
      `INSERT INTO cosmetic_purchases (user_id, cosmetic_id, kind, value)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
      [userId, itemId, g.cosmetic, g.value]
    );
    if (g.cosmetic === 'name_color')  await q('UPDATE users SET name_color=$1 WHERE id=$2', [g.value, userId]);
    if (g.cosmetic === 'avatar_glow') await q('UPDATE users SET avatar_glow=$1 WHERE id=$2', [g.value, userId]);
  }

  if (g.starter) {
    await q('UPDATE users SET ember = ember + $1 WHERE id=$2',
      [Number(CFG.starter_bundle_ember) || 10000, userId]);
    await grantRelic(userId, CFG.starter_bundle_relic || 'firestone', { detail: 'Starter bundle' });
    await q("UPDATE users SET name_color=COALESCE(name_color, '#ff7a18') WHERE id=$1", [userId]);
  }

  await q(
    "INSERT INTO ledger(user_id,kind,detail,ember) VALUES ($1,'stars_purchase',$2,$3)",
    [userId, it.title, g.ember || 0]
  );

  await notify({
    userId,
    type: 'payment',
    title: `Purchase complete: ${it.title}`,
    body: `${it.stars} Stars spent.`,
    severity: 'success',
    action_kind: 'post',
  });

  feedWrite({
    type: 'payment',
    icon: 'res-stars',
    severity: 'success',
    text: `New purchase: ${it.title} · ${it.stars}⭐`,
    detail: { userId, itemId, stars: it.stars, chargeId },
    actor: userId,
  });
}

/* ---------- webhook ---------- */
export async function handleWebhook(update) {
  if (update.pre_checkout_query) {
    await tg('answerPreCheckoutQuery', {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    });
    return;
  }
  const msg = update.message;
  const sp = msg && msg.successful_payment;
  if (!sp) return;
  let p = {};
  try { p = JSON.parse(sp.invoice_payload || '{}'); } catch {}
  const it = STAR_ITEMS[p.i];
  if (it && p.u) {
    await grantItem(Number(p.u), p.i, it, sp.telegram_payment_charge_id, sp.invoice_payload);
  }
}