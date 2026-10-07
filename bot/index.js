import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import 'dotenv/config';
import { q } from '../server/db.js';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN = Number(process.env.ADMIN_TELEGRAM_ID);
const isAdmin = msg => msg.from.id === ADMIN;

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '◈ Open AURUM', web_app: { url: process.env.MINI_APP_URL } }],
        [{ text: '📊 Today\'s Challenge', callback_data: 'today' }],
        [{ text: '🌐 Admin Console', web_app: { url: `${process.env.MINI_APP_URL}/${process.env.ADMIN_PATH}` } }],
      ],
    },
  };
}

bot.onText(/\/start/, msg => {
  bot.sendMessage(msg.chat.id,
    '◈ *AURUM*\n\nThe daily call. Every option is a path — the best one pays the most.',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  if (query.data === 'today') {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await q(`SELECT question FROM challenges WHERE challenge_date=$1`, [today]);
    if (!rows.length) return bot.sendMessage(chatId, 'No challenge today.');
    return bot.sendMessage(chatId, `▸ ${rows[0].question}`, mainMenu());
  }
});

// Every minute: close challenges whose reveal_at has passed
cron.schedule('* * * * *', async () => {
  try {
    const { rows } = await q(
      `SELECT id, question FROM challenges WHERE status='open' AND reveal_at <= NOW()`
    );
    for (const ch of rows) {
      await q(`UPDATE challenges SET status='closed' WHERE id=$1`, [ch.id]);
      try {
        await bot.sendMessage(ADMIN, `🔒 Challenge #${ch.id} closed. Send outcome to resolve.`);
      } catch {}
    }
  } catch (e) { console.error(e); }
});

console.log('✓ AURUM bot running');