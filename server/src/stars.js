import { q } from './db.js';

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
};

export async function createStarInvoice(userId, itemId) {
  const it = STAR_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  const payload = JSON.stringify({ u: userId, i: itemId, t: Date.now() });
  return tg('createInvoiceLink', {
    title: it.title, description: it.desc,
    payload, currency: 'XTR',
    prices: [{ label: it.title, amount: it.stars }]
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
  if (!it || !p.u) return;
  const ins = await q(
    `INSERT INTO payments (user_id, kind, charge_id, payload, amount, currency, status)
     VALUES ($1,'stars',$2,$3,$4,'XTR','paid')
     ON CONFLICT (charge_id) DO NOTHING RETURNING id`,
    [Number(p.u), sp.telegram_payment_charge_id, sp.invoice_payload, it.stars]
  );
  if (!ins.rowCount) return;
  const g = it.grant || {};
  if (g.sparks) await q('UPDATE users SET sparks = sparks + $1 WHERE id=$2', [g.sparks, Number(p.u)]);
}