import TelegramBot from 'node-telegram-bot-api';
import 'dotenv/config';
import { q } from '../server/db.js';

// ─── Public game bot ────────────────────────────────────
// This bot ONLY opens the Mini App and shows the daily call.
// Everything creative / administrative lives in the separate admin bot.
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

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

bot.on('polling_error', (e) => console.error('polling_error', e.code || e.message));

console.log('✓ HUBRIS game bot running');
