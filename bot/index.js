import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import 'dotenv/config';
import { q } from '../server/db.js';
import { judgeWithVoting, askAllAIs } from '../server/ai.js';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const ADMIN = Number(process.env.ADMIN_TELEGRAM_ID);

const sessions = {};
const isAdmin = msg => msg.from.id === ADMIN;

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ New Challenge', callback_data: 'new_ch' }],
        [{ text: '🎯 Resolve Challenge', callback_data: 'resolve_list' }],
        [{ text: '💬 Ask AIs', callback_data: 'ask_ai' }],
        [{ text: '🎁 New Quest', callback_data: 'new_quest' }],
        [{ text: '📋 List Quests', callback_data: 'list_quests' }],
        [{ text: '🌐 Open Admin Panel', web_app: { url: `${process.env.MINI_APP_URL}/admin-console` } }],
      ],
    },
  };
}

bot.onText(/\/start/, msg => {
  if (!isAdmin(msg)) return bot.sendMessage(msg.chat.id, 'Unauthorized.');
  bot.sendMessage(msg.chat.id, '🛠 Admin Panel', mainMenu());
});

bot.on('callback_query', async query => {
  const chatId = query.message.chat.id;
  if (query.from.id !== ADMIN) return;
  const data = query.data;
  const s = sessions[chatId];

  if (data === 'new_ch') {
    sessions[chatId] = { step: 'q' };
    return bot.sendMessage(chatId, '📝 Send the challenge question:');
  }

  if (data === 'ask_ai') {
    sessions[chatId] = { step: 'ask_ai' };
    return bot.sendMessage(chatId, '💬 Send any prompt. I will forward it to all AIs.');
  }

  if (data === 'new_quest') {
    sessions[chatId] = { step: 'quest_title' };
    return bot.sendMessage(chatId, '🎁 Send quest title:');
  }

  if (data === 'list_quests') {
    const { rows } = await q(`SELECT * FROM quests ORDER BY created_at DESC`);
    if (!rows.length) return bot.sendMessage(chatId, 'No quests yet.');
    const txt = rows.map(r => `${r.is_active ? '🟢' : '🔴'} #${r.id} ${r.title} (+${r.reward})`).join('\n');
    return bot.sendMessage(chatId, txt);
  }

  if (data === 'resolve_list') {
    const { rows } = await q(
      `SELECT id, challenge_date, question FROM challenges WHERE status='open' ORDER BY challenge_date DESC LIMIT 10`
    );
    if (!rows.length) return bot.sendMessage(chatId, 'No open challenges.');
    const kb = rows.map(r => [{ text: `${r.challenge_date} — ${r.question.slice(0, 40)}`, callback_data: `res_${r.id}` }]);
    return bot.sendMessage(chatId, 'Pick challenge to resolve:', { reply_markup: { inline_keyboard: kb } });
  }

  if (data.startsWith('res_')) {
    const id = data.split('_')[1];
    const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
    if (!rows.length) return;
    const ch = rows[0];
    sessions[chatId] = { step: 'resolve_outcome', challengeId: id };
    return bot.sendMessage(chatId, `Challenge: ${ch.question}\n\nSend the OUTCOME text.\nOr /skip to pick winner manually.`);
  }

  if (data === 'uai_yes' || data === 'uai_no') {
    s.use_ai = data === 'uai_yes';
    s.step = 'reveal_time';
    return bot.sendMessage(chatId, 'Reveal time? Send HH:MM (today) or full ISO datetime.');
  }

  if (data.startsWith('conf_')) {
    const id = data.split('_')[1];
    const v = s.verdict;
    await q(
      `UPDATE challenges SET winner_id=$1, ai_votes=$2, ai_reason=$3, status='revealed', resolved_at=NOW() WHERE id=$4`,
      [v.winner_id, JSON.stringify(v.votes), v.reason, id]
    );
    await q(`UPDATE picks SET points_earned=10 WHERE challenge_id=$1 AND choice=$2`, [id, v.winner_id]);
    await q(`UPDATE users u SET points = u.points + COALESCE(p.points_earned,0)
             FROM picks p WHERE p.telegram_id=u.telegram_id AND p.challenge_id=$1`, [id]);
    await q(`UPDATE users u SET streak = CASE WHEN p.choice=$2 THEN u.streak+1 ELSE 0 END
             FROM picks p WHERE p.telegram_id=u.telegram_id AND p.challenge_id=$1`, [id, v.winner_id]);
    delete sessions[chatId];
    bot.answerCallbackQuery(query.id, { text: 'Resolved ✅' });
    return bot.sendMessage(chatId, `✅ Revealed. Winner: ${v.winner_id}`, mainMenu());
  }

  bot.answerCallbackQuery(query.id);
});

bot.on('message', async msg => {
  if (!isAdmin(msg)) return;
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text || text.startsWith('/')) return;
  const s = sessions[chatId];
  if (!s) return;

  if (s.step === 'q') {
    s.question = text;
    s.step = 'options';
    return bot.sendMessage(chatId, 'Send options, one per line: id|text\nExample:\na|Harvest energy\nb|Scout sector');
  }

  if (s.step === 'options') {
    try {
      const options = text.split('\n').map(line => {
        const [id, ...rest] = line.split('|');
        return { id: id.trim(), text: rest.join('|').trim() };
      });
      if (options.length < 2) throw new Error('Need at least 2');
      s.options = options;
      s.step = 'use_ai';
      return bot.sendMessage(chatId, 'Use AI to pick winner?', {
        reply_markup: { inline_keyboard: [
          [{ text: '✅ Yes', callback_data: 'uai_yes' }],
          [{ text: '❌ No (manual)', callback_data: 'uai_no' }],
        ]},
      });
    } catch {
      return bot.sendMessage(chatId, '❌ Invalid format. Try again.');
    }
  }

  if (s.step === 'reveal_time') {
    let iso;
    if (/^\d{2}:\d{2}$/.test(text)) {
      const today = new Date().toISOString().split('T')[0];
      iso = new Date(`${today}T${text}:00`).toISOString();
    } else {
      iso = new Date(text).toISOString();
    }
    const { rows } = await q(
      `INSERT INTO challenges (challenge_date, question, options, outcome_text, use_ai, reveal_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [new Date().toISOString().split('T')[0], s.question,
       JSON.stringify(s.options), s.outcome_text || null, s.use_ai, iso]
    );
    delete sessions[chatId];
    return bot.sendMessage(chatId, `✅ Challenge #${rows[0].id} created`, mainMenu());
  }

  if (s.step === 'ask_ai') {
    bot.sendMessage(chatId, '⏳ Asking all AIs...');
    const responses = await askAllAIs(text);
    if (!responses.length) return bot.sendMessage(chatId, '❌ No AI responded.');
    const report = responses.map(r => `🤖 ${r.provider}\n→ ${r.winner_id || '—'}\n   ${r.reason || ''}`).join('\n\n');
    delete sessions[chatId];
    return bot.sendMessage(chatId, `📊 Results:\n\n${report}`, mainMenu());
  }

  if (s.step === 'resolve_outcome') {
    if (text === '/skip') {
      s.step = 'resolve_manual';
      const ch = (await q(`SELECT options FROM challenges WHERE id=$1`, [s.challengeId])).rows[0];
      const opts = ch.options.map(o => [{ text: `${o.id}: ${o.text}`, callback_data: `win_${s.challengeId}_${o.id}` }]);
      return bot.sendMessage(chatId, 'Pick winner manually:', { reply_markup: { inline_keyboard: opts } });
    }

    const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [s.challengeId]);
    const ch = rows[0];
    await q(`UPDATE challenges SET outcome_text=$1 WHERE id=$2`, [text, s.challengeId]);

    bot.sendMessage(chatId, '⏳ Sending to AIs...');
    const verdict = await judgeWithVoting(ch.question, text, ch.options);
    const report = verdict.votes.map(v => `🤖 ${v.provider}: ${v.winner_id}\n   ${v.reason}`).join('\n\n');

    s.step = 'resolve_confirm';
    s.verdict = verdict;

    return bot.sendMessage(
      chatId,
      `🗳 AI votes:\n\n${report}\n\n🏆 Majority winner: *${verdict.winner_id}*\n\nConfirm?`,
      { parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [
          [{ text: '✅ Confirm', callback_data: `conf_${s.challengeId}` }],
        ]},
      }
    );
  }

  if (s.step === 'quest_title') { s.title = text; s.step = 'quest_desc'; return bot.sendMessage(chatId, 'Description:'); }
  if (s.step === 'quest_desc') { s.description = text; s.step = 'quest_reward'; return bot.sendMessage(chatId, 'Reward points:'); }
  if (s.step === 'quest_reward') { s.reward = parseInt(text); s.step = 'quest_url'; return bot.sendMessage(chatId, 'Action URL (or /skip):'); }
  if (s.step === 'quest_url') {
    s.action_url = text === '/skip' ? null : text;
    const { rows } = await q(
      `INSERT INTO quests (title, description, reward, action_url)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [s.title, s.description, s.reward, s.action_url]
    );
    delete sessions[chatId];
    return bot.sendMessage(chatId, `✅ Quest #${rows[0].id} created`, mainMenu());
  }
});

cron.schedule('* * * * *', async () => {
  try {
    const { rows } = await q(
      `SELECT * FROM challenges WHERE status='open' AND reveal_at <= NOW()`
    );
    for (const ch of rows) {
      await q(`UPDATE challenges SET status='closed' WHERE id=$1`, [ch.id]);
      bot.sendMessage(ADMIN, `🔒 Challenge #${ch.id} closed. Send outcome to resolve.`);
    }
  } catch (e) { console.error(e); }
});

console.log('✓ Bot running');