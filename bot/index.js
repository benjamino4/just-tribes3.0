import TelegramBot from 'node-telegram-bot-api';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { q } from '../server/db.js';

// ─── Public game bot ────────────────────────────────────
// This bot ONLY opens the Mini App and shows the daily call.
// Everything creative / administrative lives in the separate admin bot.
// No polling here: receives updates by webhook on the web service (free tier),
// and only self-polls when launched directly as its own worker.
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: false });

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◈  Enter HUBRIS', web_app: { url: process.env.MINI_APP_URL } }],
        [{ text: "▸  Today's Call", callback_data: 'today' }],
      ],
    },
  };
}

bot.onText(/\/start/, msg => {
  bot.sendMessage(
    msg.chat.id,
    '◈ *HUBRIS*\n\nOne call a day. Back your nerve, outread the room, and let the judges weigh every path — the sharpest call earns the most *Ichor*.',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  try { bot.answerCallbackQuery(query.id); } catch {}
  if (query.data === 'today') {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await q(`SELECT question, reveal_at FROM challenges WHERE challenge_date=$1`, [today]);
    if (!rows.length) return bot.sendMessage(chatId, 'No call on the table today. Come back soon.');
    const r = rows[0];
    const t = new Date(r.reveal_at).toLocaleString();
    return bot.sendMessage(chatId, `▸ *${r.question}*\n\nReveal · ${t}`, { parse_mode: 'Markdown', ...mainMenu() });
  }
});

// ═══ Webhook wiring (lets the game bot ride on the web service, free tier) ═══
const PUBLIC_WEBHOOK_SECRET = process.env.BOT_TOKEN
  ? crypto.createHash('sha256').update('hubris-public:' + process.env.BOT_TOKEN).digest('hex').slice(0, 40)
  : 'disabled';
export const publicWebhookPath = `/tg/public/${PUBLIC_WEBHOOK_SECRET}`;
export const publicBot = bot;

export function handlePublicUpdate(update) {
  try { bot.processUpdate(update); } catch (e) { console.error('game-bot update error', e.message); }
}

export async function registerPublicWebhook(baseUrl) {
  if (!process.env.BOT_TOKEN) return console.warn('⚠ BOT_TOKEN missing — game bot disabled.');
  if (!baseUrl) return console.warn('⚠ MINI_APP_URL missing — cannot register the game-bot webhook.');
  const url = baseUrl.replace(/\/+$/, '') + publicWebhookPath;
  try {
    await bot.setWebHook(url, { allowed_updates: ['message', 'callback_query'] });
    console.log('✓ game-bot webhook registered');
  } catch (e) { console.error('✗ game-bot webhook failed:', e.message); }
}

// Standalone mode: `npm run bot` as its own (paid) worker still polls.
const __publicIsMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (__publicIsMain) {
  if (!process.env.BOT_TOKEN) {
    console.error('✗ BOT_TOKEN is missing. Set it and restart.');
  } else {
    bot.startPolling();
    bot.on('polling_error', (e) => console.error('polling_error', e.code || e.message));
    console.log('✓ HUBRIS game bot polling');
  }
}
