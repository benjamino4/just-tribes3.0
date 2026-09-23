// ---------------------------------------------------------------------------
// Telegram Stars (XTR) payments via the Bot API.
//  - createInvoiceLink  → client opens with Telegram.WebApp.openInvoice()
//  - webhook            → answer pre_checkout_query, credit on successful_payment
// Requires env BOT_TOKEN. Set the webhook once to <APP_URL>/api/tg/webhook.
// ---------------------------------------------------------------------------
import { q } from './db.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const API = t => `https://api.telegram.org/bot${BOT_TOKEN}/${t}`;

async function tg(method, body){
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set');
  const r = await fetch(API(method), {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram API: ' + (j.description||'error'));
  return j.result;
}

// Star packs & star-priced items. amount = Stars to charge.
export const STAR_ITEMS = {
  spark:   { title:'Spark Pack',    desc:'100 ⭐ for your journey',   stars:100,  grant:{stars:100} },
  flame:   { title:'Flame Pack',    desc:'550 ⭐ (+10% bonus)',       stars:550,  grant:{stars:605} },
  blaze:   { title:'Blaze Pack',    desc:'1200 ⭐ (+20% bonus)',      stars:1200, grant:{stars:1440} },
  inferno: { title:'Inferno Pack',  desc:'3200 ⭐ (+35% bonus)',      stars:3200, grant:{stars:4320} },
  charm:   { title:'Streak Charm',  desc:'Protect your streak once', stars:75,   grant:{item:'charm'} },
  auto:    { title:'Eternal Flame', desc:'Auto-collect Ash for 7 days', stars:150, grant:{item:'auto'} },
  firestone:{title:'Firestone Relic',desc:'+10% idle Ember',         stars:120,  grant:{relic:'firestone'} },
  boneidol:{ title:'Bone Idol Relic',desc:'+5% loyalty share',       stars:280,  grant:{relic:'boneidol'} },
  sundisc: { title:'Sun Disc Relic', desc:'+25% Ash cap & 12h offline',stars:640, grant:{relic:'sundisc'} },
  moonshard:{title:'Moon Shard Relic',desc:'2× streak rewards',       stars:520,  grant:{relic:'moonshard'} },
};

export async function createStarInvoice(userId, itemId){
  const it = STAR_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  const payload = JSON.stringify({ u:userId, i:itemId, t:Date.now() });
  const link = await tg('createInvoiceLink', {
    title: it.title,
    description: it.desc,
    payload,
    currency: 'XTR',
    prices: [{ label: it.title, amount: it.stars }],
  });
  return link;
}

async function grant(userId, it, chargeId, payload){
  // idempotent: charge_id is unique
  const exists = await q('SELECT 1 FROM payments WHERE charge_id=$1', [chargeId]);
  if (exists.rowCount) return;
  await q(`INSERT INTO payments(user_id,kind,charge_id,payload,amount,currency)
           VALUES ($1,'stars',$2,$3,$4,'XTR')`, [userId, chargeId, payload, it.stars]);
  const g = it.grant || {};
  if (g.stars) await q('UPDATE users SET stars = stars + $1 WHERE id=$2', [g.stars, userId]);
  await q(`INSERT INTO ledger(user_id,kind,detail,stars) VALUES ($1,'stars_purchase',$2,$3)`,
    [userId, it.title, it.stars]);
}

// Express handler for Telegram webhook updates.
export async function handleWebhook(update){
  if (update.pre_checkout_query){
    await tg('answerPreCheckoutQuery', { pre_checkout_query_id: update.pre_checkout_query.id, ok:true });
    return;
  }
  const msg = update.message;
  const sp = msg && msg.successful_payment;
  if (sp){
    let p = {}; try { p = JSON.parse(sp.invoice_payload || '{}'); } catch {}
    const it = STAR_ITEMS[p.i];
    if (it && p.u) await grant(Number(p.u), it, sp.telegram_payment_charge_id, sp.invoice_payload);
  }
}
