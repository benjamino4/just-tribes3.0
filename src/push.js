// ---------------------------------------------------------------------------
// Push notifications via the game bot. Messages go through push_queue so a
// failed send retries and so we can throttle to Telegram's rate limit.
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

export async function enqueue(userId, body){
  if (!BOT_TOKEN) return;
  await q(`INSERT INTO push_queue (user_id, body) VALUES ($1,$2)`, [userId, String(body).slice(0, 4000)]);
}

export async function flushQueue(limit = 40){
  if (!BOT_TOKEN) return { sent: 0, failed: 0 };
  const r = await q(
    `SELECT id, user_id, body FROM push_queue
      WHERE sent_at IS NULL AND send_at <= now()
      ORDER BY id LIMIT $1`, [limit]
  );
  let sent = 0, failed = 0;
  for (const row of r.rows){
    try {
      await tg('sendMessage', { chat_id: row.user_id, text: row.body, parse_mode:'HTML', disable_web_page_preview:true });
      await q('UPDATE push_queue SET sent_at=now() WHERE id=$1', [row.id]);
      sent++;
      if (sent % 20 === 0) await new Promise(r => setTimeout(r, 1100));
    } catch (e) {
      // permanent failures (blocked bot) shouldn't retry forever; mark as failed
      await q('UPDATE push_queue SET sent_at=now() WHERE id=$1', [row.id]);
      failed++;
    }
  }
  return { sent, failed };
}

// Background flusher for warm instances. On Render free tier this only runs
// while the instance is up; the cron job (see README) also calls flushQueue.
let timer = null;
export function startFlusher(intervalSec = 20){
  if (timer) return;
  timer = setInterval(() => { flushQueue().catch(()=>{}); }, intervalSec*1000);
  timer.unref?.();
}