// ---------------------------------------------------------------------------
// Telegram Stars (XTR) — the ONLY way soft "Stars" shows up now is as a
// price rail. Items grant Ember, relics, cosmetics, or one-time bundles.
// ---------------------------------------------------------------------------
import { q } from './db.js';
import { CFG } from './config.js';

const BOT_TOKEN = process.env.BOT_TOKEN || '';
const API = t => `https://api.telegram.org/bot${BOT_TOKEN}/${t}`;

async function tg(method, body){
  if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set');
  const r = await fetch(API(method), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error('Telegram API: ' + (j.description||'error'));
  return j.result;
}

// The catalogue. Every entry is Stars-priced. Grants never include `stars`.
export const STAR_ITEMS = {
  // Ember packs
  spark:   { title:'Spark Pack',    desc:'5,000 Ember',                 stars:60,  grant:{ember:5000} },
  flame:   { title:'Flame Pack',    desc:'30,000 Ember (+20% bonus)',   stars:300, grant:{ember:36000} },
  blaze:   { title:'Blaze Pack',    desc:'80,000 Ember (+35% bonus)',   stars:700, grant:{ember:108000} },
  inferno: { title:'Inferno Pack',  desc:'250,000 Ember (+60% bonus)',  stars:2000,grant:{ember:400000} },

  // Relics
  firestone: { title:'Firestone Relic',  desc:'+10% idle Ember, forever',    stars:120, grant:{relic:'firestone'} },
  boneidol:  { title:'Bone Idol Relic',  desc:'+5% tribe loyalty share',     stars:280, grant:{relic:'boneidol'} },
  sundisc:   { title:'Sun Disc Relic',   desc:'+25% Ash cap & 12h offline',  stars:640, grant:{relic:'sundisc'} },
  moonshard: { title:'Moon Shard Relic', desc:'2× streak rewards',           stars:520, grant:{relic:'moonshard'} },

  // Tribe boosts (apply to your tribe's treasury)
  pyreboost: { title:'Pyre Boost',       desc:'+10,000 Ember to the Pyre',   stars:80,  grant:{tribe_ember:10000} },

  // Cosmetics
  name_color_ember: { title:'Name: Ember',  desc:'Name glows ember in the Kiva', stars:90,  grant:{cosmetic:'name_color','value':'#ff7a18'} },
  name_color_jade:  { title:'Name: Jade',   desc:'Name glows jade in the Kiva',  stars:90,  grant:{cosmetic:'name_color','value':'#2adc8c'} },
  name_color_void:  { title:'Name: Void',   desc:'Name glows void in the Kiva',  stars:90,  grant:{cosmetic:'name_color','value':'#9a6bff'} },
  glow_ember:       { title:'Aura: Ember',  desc:'Ember halo around your avatar', stars:120, grant:{cosmetic:'avatar_glow','value':'ember'} },
  glow_frost:       { title:'Aura: Frost',  desc:'Frost halo around your avatar', stars:120, grant:{cosmetic:'avatar_glow','value':'frost'} },

  // One-time starter
  starter_bundle: { title:'Starter Bundle', desc:'10,000 Ember + a random relic + Ember name color', stars:150, oneTime:true, grant:{starter:true} },
};

export async function createStarInvoice(userId, itemId){
  const it = STAR_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  if (it.oneTime){
    const ex = await q(`SELECT 1 FROM payments WHERE user_id=$1 AND payload=$2 AND status='paid'`, [userId, itemId]);
    if (ex.rowCount) throw new Error('Already purchased');
  }
  const payload = JSON.stringify({ u:userId, i:itemId, t:Date.now() });
  return tg('createInvoiceLink', {
    title: it.title,
    description: it.desc,
    payload,
    currency: 'XTR',
    prices: [{ label: it.title, amount: it.stars }],
  });
}

async function grant(userId, itemId, it, chargeId, payload){
  const ins = await q(
    `INSERT INTO payments(user_id,kind,charge_id,payload,amount,currency)
     VALUES ($1,'stars',$2,$3,$4,'XTR')
     ON CONFLICT (charge_id) DO NOTHING
     RETURNING id`,
    [userId, chargeId, payload, it.stars]
  );
  if (!ins.rowCount) return; // webhook retry

  const g = it.grant || {};

  if (g.ember){
    await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [g.ember, userId]);
  }
  if (g.relic){
    const t = await q('SELECT tribe_id FROM users WHERE id=$1', [userId]);
    if (t.rows[0]?.tribe_id) {
      await q('UPDATE tribes SET relics_total = relics_total + 1 WHERE id=$1', [t.rows[0].tribe_id]);
    }
  }
  if (g.tribe_ember){
    const t = await q('SELECT tribe_id FROM users WHERE id=$1', [userId]);
    if (t.rows[0]?.tribe_id) {
      await q('UPDATE tribes SET treasury = treasury + $1 WHERE id=$2', [g.tribe_ember, t.rows[0].tribe_id]);
    } else {
      await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [g.tribe_ember, userId]);
    }
  }
  if (g.cosmetic){
    await q(
      `INSERT INTO cosmetic_purchases (user_id, cosmetic_id, kind, value)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (user_id, cosmetic_id) DO NOTHING`,
      [userId, itemId, g.cosmetic, g.value]
    );
    if (g.cosmetic === 'name_color') await q('UPDATE users SET name_color=$1 WHERE id=$2', [g.value, userId]);
    if (g.cosmetic === 'avatar_glow') await q('UPDATE users SET avatar_glow=$1 WHERE id=$2', [g.value, userId]);
  }
  if (g.starter){
    await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [Number(CFG.starter_bundle_ember)||10000, userId]);
    const relic = String(CFG.starter_bundle_relic || 'firestone');
    const t = await q('SELECT tribe_id FROM users WHERE id=$1', [userId]);
    if (t.rows[0]?.tribe_id) await q('UPDATE tribes SET relics_total = relics_total + 1 WHERE id=$1', [t.rows[0].tribe_id]);
    await q('UPDATE users SET name_color=COALESCE(name_color, $1) WHERE id=$2', ['#ff7a18', userId]);
    await q('INSERT INTO ledger(user_id,kind,detail) VALUES ($1,$2,$3)', [userId, 'starter_bundle', 'Starter bundle: '+relic]);
  }

  await q(
    `INSERT INTO ledger(user_id,kind,detail,ember)
     VALUES ($1,'stars_purchase',$2,$3)`,
    [userId, it.title, g.ember || 0]
  );
}

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
    if (it && p.u) await grant(Number(p.u), p.i, it, sp.telegram_payment_charge_id, sp.invoice_payload);
  }
}