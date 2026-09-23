// ---------------------------------------------------------------------------
// TON payments (via TON Connect on the client). Flow:
//   1) /api/ton/intent  → server returns {to, amountNano} (amount carries a
//      tiny random nanoton tag so we can match the on-chain tx unambiguously
//      WITHOUT needing a comment cell / BOC encoding on the client).
//   2) client sends exactly amountNano to `to` via TON Connect UI.
//   3) /api/ton/verify  → server queries toncenter for an incoming tx of that
//      exact amount and credits the grant (idempotent).
// Requires env TON_RECEIVE_ADDRESS. On-chain verify needs TONCENTER_API_KEY.
// ---------------------------------------------------------------------------
import crypto from 'crypto';
import { q } from './db.js';

const RECV = process.env.TON_RECEIVE_ADDRESS || '';
const TONCENTER = process.env.TONCENTER_API_KEY || '';
const NET = (process.env.TON_NETWORK || 'mainnet').toLowerCase();
const BASE = NET === 'testnet' ? 'https://testnet.toncenter.com' : 'https://toncenter.com';

// TON price list (in TON). Grants mirror the Stars catalogue.
export const TON_ITEMS = {
  spark:   { ton:0.5,  grant:{stars:100} },
  flame:   { ton:2.5,  grant:{stars:605} },
  blaze:   { ton:5,    grant:{stars:1440} },
  inferno: { ton:13,   grant:{stars:4320} },
  sundisc: { ton:2.6,  grant:{relic:'sundisc'} },
  moonshard:{ ton:2.1, grant:{relic:'moonshard'} },
};

export function tonConfigured(){ return !!RECV; }
export function receiveAddress(){ return RECV; }

export async function makeIntent(userId, itemId){
  const it = TON_ITEMS[itemId];
  if (!it) throw new Error('Unknown item');
  if (!RECV) throw new Error('TON_RECEIVE_ADDRESS not set');
  const nonce = 'TRB-' + crypto.randomBytes(6).toString('hex');
  const tag = crypto.randomInt(0, 100000);                 // unique nanoton tag
  const amountNano = String(Math.round(it.ton * 1e9) + tag);
  await q(`INSERT INTO payments(user_id,kind,charge_id,payload,amount,currency,status)
           VALUES ($1,'ton',$2,$3,$4,'TON','pending')`,
           [userId, nonce, itemId, amountNano]);
  return { to: RECV, amountNano, nonce, ton: it.ton, itemId };
}

async function findIncoming(amountNano){
  if (!TONCENTER) return false;
  const url = `${BASE}/api/v2/getTransactions?address=${encodeURIComponent(RECV)}&limit=40&api_key=${TONCENTER}`;
  const r = await fetch(url); const j = await r.json();
  if (!j.ok) return false;
  for (const tx of j.result){
    const inMsg = tx.in_msg;
    if (inMsg && String(inMsg.value) === String(amountNano)) return true;
  }
  return false;
}

export async function verifyPayment(userId, nonce){
  const p = (await q(`SELECT * FROM payments WHERE charge_id=$1 AND user_id=$2`,[nonce,userId])).rows[0];
  if (!p) return { ok:false, reason:'no_intent' };
  if (p.status === 'paid') return { ok:true, verified:true, already:true };
  const it = TON_ITEMS[p.payload];
  if (!it) return { ok:false, reason:'bad_item' };
  const paid = await findIncoming(p.amount);
  if (!paid) return { ok:false, verified:false };
  await q(`UPDATE payments SET status='paid' WHERE id=$1`,[p.id]);
  if (it.grant?.stars) await q('UPDATE users SET stars=stars+$1 WHERE id=$2',[it.grant.stars,userId]);
  await q(`INSERT INTO ledger(user_id,kind,detail,stars) VALUES ($1,'ton_purchase',$2,$3)`,
    [userId, 'TON purchase: '+p.payload, it.grant?.stars||0]);
  return { ok:true, verified:true };
}

export async function linkWallet(userId, address){
  await q('UPDATE users SET ton_address=$1 WHERE id=$2', [address, userId]);
}
