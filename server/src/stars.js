import { q } from './db.js';
import { notify } from './notifications.js';
import { feedWrite } from './feed.js';
import { grant as grantRelic } from './relics.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const API = (t) => `https://api.telegram.org/bot${BOT_TOKEN}/${t}`;

async function tg(method, body) {
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set');
  const r = await fetch(API(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram API: ' + (j.description || 'error'));
  return j.result;
}

export const STAR_ITEMS = {
  spark:   { title: 'Spark Pack',   desc: '5,000 Sparks',                stars: 60,   grant: { sparks: 5000 } },
  flame:   { title: 'Flame Pack',   desc: '30,000 Sparks (+20% bonus)',  stars: 300,  grant: { sparks: 36000 } },
  blaze:   { title: 'Blaze Pack',   desc: '80,000 Sparks (+35% bonus)',  stars: 700,  grant: { sparks: 108000 } },
  inferno: { title: 'Inferno Pack', desc: '250,000 Sparks (+60% bonus)', stars: 2000, grant: { sparks: 400000 } },
  firestone: { title: 'Firestone Relic', desc: 'Check-in gives +20% Sparks', stars: 120, grant: { relic: 'firestone' } },
  moon_shard: { title: 'Moon Shard Relic', desc: 'Streak rewards doubled', stars: 520, grant: { relic: 'moon_shard' } },
  name_color_ember: { title: 'Name: Ember', desc: 'Name glows ember', stars: 90, grant: { cosmetic: 'name_color', value: '#ff7a18' } },
  name_color_jade:  { title: 'Name: Jade',  desc: 'Name glows jade',  stars: 90, grant: { cosmetic: 'name_color', value: '#2adc8c' } },
  name_color_void:  { title: 'Name: Void',  desc: 'Name glows void',  stars: 90, grant: { cosmetic: 'name_color', value: '#9a6bff' } },
  glow_ember:       { title: 'Aura: Ember', desc: 'Ember halo', stars: 120, grant: { cosmetic: 'avatar_glow', value: 'ember' } },
  glow_frost:       { title: 'Aura: Frost', desc: 'Frost halo', stars: 120, grant: { cosmetic: 'avatar_glow', value: 'frost' } },
  starter_bundle: { title: 'Starter Bundle', desc: '10,000 Sparks + Ember name + Firestone', stars: 150, oneTime: true, grant: { starter: true } }
};

export async function createStarInvoice(userId, itemId) {
  const it = STAR_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  if (it.oneTime) {
    const ex = await q("SELECT 1 FROM payments WHERE user_id=$1 AND payload=$2 AND status='paid'",
      [userId, itemId]);
    if (ex.rowCount) throw new Error('Already purchased');
  }
  const payload = JSON.stringify({ u: userId, i: itemId, t: Date.now() });
  return tg('createInvoiceLink', {
    title: it.title, description: it.desc,
    payload, currency: 'XTR',
    prices: [{ label: it.title, amount: it.stars }]
  });
}

async function grantItem(userId, itemId, it, chargeId, payload) {
  const ins = await q(
    `INSERT INTO payments (user_id, kind, charge_id, payload, amount, currency, status)
     VALUES ($1,'stars',$2,$3,$4,'XTR','paid')
     ON CONFLICT (charge_id) DO NOTHING RETURNING id`,
    [userId, chargeId, payload, it.stars]
  );
  if (!ins.rowCount) return;
  const g = it.grant || {};
  if (g.sparks) await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [g.sparks, userId]);
  if (g.relic) await grantRelic(userId, g.relic, { detail: 'Stars purchase' });
  if (g.cosmetic) {
    if (g.cosmetic === 'name_color')  await q('UPDATE users SET name_color=$1 WHERE id=$2', [g.value, userId]);
    if (g.cosmetic === 'avatar_glow') await q('UPDATE users SET avatar_glow=$1 WHERE id=$2', [g.value, userId]);
  }
  if (g.starter) {
    await q('UPDATE users SET sparks = sparks + 10000 WHERE id=$1', [userId]);
    await grantRelic(userId, 'firestone', { detail: 'Starter bundle' });
    await q("UPDATE users SET name_color=COALESCE(name_color, '#ff7a18') WHERE id=$1", [userId]);
  }
  await q("INSERT INTO ledger(user_id,kind,detail,sparks) VALUES ($1,'stars_purchase',$2,$3)",
    [userId, it.title, g.sparks || 0]);
  await notify({
    userId, type: 'payment',
    title: `Purchase complete: ${it.title}`,
    body: `${it.stars} Stars spent.`,
    severity: 'success', action_kind: 'post'
  });
  feedWrite({
    type: 'payment', icon: 'res-stars', severity: 'success',
    text: `New purchase: ${it.title} · ${it.stars}⭐`,
    detail: { userId, itemId, stars: it.stars, chargeId }, actor: userId
  });
}

export async function handleWebhook(update) {
  if (update.pre_checkout_query) {
    await tg('answerPreCheckoutQuery', {
      pre_checkout_query_id: update.pre_checkout_query.id, ok: true
    });
    return;
  }
  const msg = update.message;
  const sp = msg && msg.successful_payment;
  if (!sp) return;
  let p = {};
  try { p = JSON.parse(sp.invoice_payload || '{}'); } catch {}
  const it = STAR_ITEMS[p.i];
  if (it && p.u) await grantItem(Number(p.u), p.i, it, sp.telegram_payment_charge_id, sp.invoice_payload);
}