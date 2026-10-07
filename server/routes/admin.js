import express from 'express';
import { q } from '../db.js';
import { verifyInitData } from '../auth.js';
import { askAllAIs, askAI, judgeWithRanking } from '../ai.js';
import { buildPointsMap } from '../scoring.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════
// Admin auth — Telegram initData + admin ID + session token
// Returns 404 for every failure. No hints. No bypasses.
// ═══════════════════════════════════════════════════════════
function requireAdmin(req, res, next) {
  // 1. Must present Telegram initData
  const initData = req.headers['x-init-data'];
  if (!initData) return res.status(404).json({ error: 'not_found' });

  const user = verifyInitData(initData, process.env.BOT_TOKEN);
  if (!user) return res.status(404).json({ error: 'not_found' });

  // 2. Must be the configured admin Telegram ID
  const expected = String(process.env.ADMIN_TELEGRAM_ID || '').trim();
  const actual = String(user.id || '').trim();
  if (!expected || !actual || expected !== actual) {
    return res.status(404).json({ error: 'not_found' });
  }

  // 3. Must present a valid, unexpired session token issued by /api/me
  const token = req.headers['x-admin-token'];
  if (!token) return res.status(404).json({ error: 'not_found' });

  const shared = global.__aurum_adminSessions;
  if (!shared) return res.status(404).json({ error: 'not_found' });

  const s = shared.get(token);
  if (!s || Date.now() > s.expiresAt || s.telegramId !== actual) {
    return res.status(404).json({ error: 'not_found' });
  }

  req.adminUser = user;
  next();
}

router.use(requireAdmin);

// ═══════════════════════════════════════════════════════════
// Dashboard stats
// ═══════════════════════════════════════════════════════════
router.get('/stats', async (req, res) => {
  const [users, picks, quests, open] = await Promise.all([
    q(`SELECT COUNT(*)::int AS c FROM users`),
    q(`SELECT COUNT(*)::int AS c FROM picks`),
    q(`SELECT COUNT(*)::int AS c FROM quest_completions`),
    q(`SELECT COUNT(*)::int AS c FROM challenges WHERE status='open'`),
  ]);
  const { rows: recent } = await q(
    `SELECT challenge_date, question, status, winner_id
     FROM challenges ORDER BY challenge_date DESC LIMIT 5`
  );
  res.json({
    users: users.rows[0].c,
    picks: picks.rows[0].c,
    quests_completed: quests.rows[0].c,
    open_challenges: open.rows[0].c,
    recent,
  });
});

// ═══════════════════════════════════════════════════════════
// Challenges
// ═══════════════════════════════════════════════════════════
router.get('/challenges', async (req, res) => {
  const { rows } = await q(
    `SELECT c.*,
      (SELECT COUNT(*)::int FROM picks p WHERE p.challenge_id = c.id) AS pick_count
     FROM challenges c
     ORDER BY challenge_date DESC LIMIT 100`
  );
  res.json({ challenges: rows });
});

router.get('/challenges/:id', async (req, res) => {
  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const { rows: picks } = await q(
    `SELECT choice, COUNT(*)::int AS count FROM picks WHERE challenge_id=$1 GROUP BY choice`,
    [req.params.id]
  );
  res.json({ challenge: rows[0], picks });
});

router.post('/challenges', async (req, res) => {
  const { challenge_date, question, options, outcome_text, use_ai, reveal_at } = req.body;
  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'invalid_payload' });
  }
  try {
    const { rows } = await q(
      `INSERT INTO challenges
        (challenge_date, question, options, outcome_text, use_ai, reveal_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        challenge_date,
        question,
        JSON.stringify(options),
        outcome_text || null,
        use_ai !== false,
        reveal_at,
      ]
    );
    res.json({ challenge: rows[0] });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.patch('/challenges/:id', async (req, res) => {
  const { question, options, outcome_text, use_ai, reveal_at, status } = req.body;
  const fields = [];
  const values = [];
  let i = 1;

  if (question !== undefined) { fields.push(`question=$${i++}`); values.push(question); }
  if (options !== undefined) { fields.push(`options=$${i++}`); values.push(JSON.stringify(options)); }
  if (outcome_text !== undefined) { fields.push(`outcome_text=$${i++}`); values.push(outcome_text); }
  if (use_ai !== undefined) { fields.push(`use_ai=$${i++}`); values.push(use_ai); }
  if (reveal_at !== undefined) { fields.push(`reveal_at=$${i++}`); values.push(reveal_at); }
  if (status !== undefined) { fields.push(`status=$${i++}`); values.push(status); }

  if (!fields.length) return res.status(400).json({ error: 'nothing_to_update' });

  values.push(req.params.id);
  const { rows } = await q(
    `UPDATE challenges SET ${fields.join(', ')} WHERE id=$${i} RETURNING *`,
    values
  );
  res.json({ challenge: rows[0] });
});

router.delete('/challenges/:id', async (req, res) => {
  await q(`DELETE FROM picks WHERE challenge_id=$1`, [req.params.id]);
  await q(`DELETE FROM challenges WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// Resolve — builds full ranking, awards tiered points
// ═══════════════════════════════════════════════════════════
router.post('/challenges/:id/resolve', async (req, res) => {
  const id = req.params.id;
  const { ranking: manualRanking } = req.body;

  const { rows } = await q(`SELECT * FROM challenges WHERE id=$1`, [id]);
  if (!rows.length) return res.status(404).json({ error: 'not_found' });
  const ch = rows[0];

  let ranking = manualRanking;
  let ai_votes = [];
  let ai_reason = '';

  if (!ranking && ch.use_ai) {
    if (!ch.outcome_text) return res.status(400).json({ error: 'no_outcome_text' });
    const verdict = await judgeWithRanking(ch.question, ch.outcome_text, ch.options);
    ranking = verdict.ranking;
    ai_votes = verdict.votes || [];
    ai_reason = verdict.reason || '';
  }

  if (!Array.isArray(ranking) || !ranking.length) {
    return res.status(400).json({ error: 'no_ranking' });
  }

  const { map, ordered } = buildPointsMap(ranking);
  const winner_id = ranking[0];

  await q(
    `UPDATE challenges
     SET winner_id=$1, ranking=$2, ai_votes=$3, ai_reason=$4,
         status='revealed', resolved_at=NOW()
     WHERE id=$5`,
    [winner_id, JSON.stringify(ordered), JSON.stringify(ai_votes), ai_reason, id]
  );

  // Award points per-pick according to the ranking
  for (const [optionId, points] of Object.entries(map)) {
    await q(
      `UPDATE picks SET points_earned=$1 WHERE challenge_id=$2 AND choice=$3`,
      [points, id, optionId]
    );
  }

  // Credit user balances
  await q(
    `UPDATE users u
     SET points = u.points + COALESCE(p.points_earned, 0)
     FROM picks p
     WHERE p.telegram_id = u.telegram_id AND p.challenge_id = $1`,
    [id]
  );

  // Streak: only players who picked the #1 option keep/increase streak
  await q(
    `UPDATE users u
     SET streak = CASE WHEN p.choice=$2 THEN u.streak+1 ELSE 0 END,
         best_streak = GREATEST(
           u.best_streak,
           u.streak + CASE WHEN p.choice=$2 THEN 1 ELSE 0 END
         )
     FROM picks p
     WHERE p.telegram_id = u.telegram_id AND p.challenge_id = $1`,
    [id, winner_id]
  );

  res.json({ ok: true, ranking, winner_id, ai_votes, ai_reason, pointsMap: map });
});

// ═══════════════════════════════════════════════════════════
// AI Console
// ═══════════════════════════════════════════════════════════
router.post('/ai/ask-all', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'no_prompt' });
  const responses = await askAllAIs(prompt);
  await q(
    `INSERT INTO ai_chats (prompt, response) VALUES ($1, $2)`,
    [prompt, JSON.stringify(responses)]
  );
  res.json({ responses });
});

router.post('/ai/ask-one', async (req, res) => {
  const { prompt, providerIndex = 0 } = req.body;
  if (!prompt) return res.status(400).json({ error: 'no_prompt' });
  const response = await askAI(prompt, providerIndex);
  res.json({ response });
});

router.get('/ai/history', async (req, res) => {
  const { rows } = await q(
    `SELECT id, prompt, response, created_at FROM ai_chats
     ORDER BY created_at DESC LIMIT 50`
  );
  res.json({ history: rows });
});

// ═══════════════════════════════════════════════════════════
// Quests
// ═══════════════════════════════════════════════════════════
router.get('/quests', async (req, res) => {
  const { rows } = await q(
    `SELECT q.*,
      (SELECT COUNT(*)::int FROM quest_completions qc WHERE qc.quest_id = q.id) AS completions
     FROM quests q ORDER BY created_at DESC`
  );
  res.json({ quests: rows });
});

router.post('/quests', async (req, res) => {
  const { title, description, reward, action_url, action_type, verify_text, expires_at } = req.body;
  if (!title || !reward) return res.status(400).json({ error: 'invalid_payload' });
  const { rows } = await q(
    `INSERT INTO quests
      (title, description, reward, action_url, action_type, verify_text, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      title,
      description || '',
      reward,
      action_url || null,
      action_type || 'link',
      verify_text || null,
      expires_at || null,
    ]
  );
  res.json({ quest: rows[0] });
});

router.patch('/quests/:id/toggle', async (req, res) => {
  const { rows } = await q(
    `UPDATE quests SET is_active = NOT is_active WHERE id=$1 RETURNING *`,
    [req.params.id]
  );
  res.json({ quest: rows[0] });
});

router.delete('/quests/:id', async (req, res) => {
  await q(`DELETE FROM quest_completions WHERE quest_id=$1`, [req.params.id]);
  await q(`DELETE FROM quests WHERE id=$1`, [req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════
// Users
// ═══════════════════════════════════════════════════════════
router.get('/users', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const search = req.query.search;
  let query = `SELECT telegram_id, username, first_name, points, streak, best_streak, created_at FROM users`;
  const params = [];
  if (search) {
    query += ` WHERE username ILIKE $1 OR first_name ILIKE $1 OR CAST(telegram_id AS TEXT) LIKE $1`;
    params.push(`%${search}%`);
  }
  query += ` ORDER BY points DESC LIMIT $${params.length + 1}`;
  params.push(limit);
  const { rows } = await q(query, params);
  res.json({ users: rows });
});

router.patch('/users/:id/points', async (req, res) => {
  const { points } = req.body;
  if (typeof points !== 'number') return res.status(400).json({ error: 'invalid' });
  const { rows } = await q(
    `UPDATE users SET points=$1 WHERE telegram_id=$2 RETURNING *`,
    [points, req.params.id]
  );
  res.json({ user: rows[0] });
});

// ═══════════════════════════════════════════════════════════
// Broadcast
// ═══════════════════════════════════════════════════════════
router.post('/broadcast', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'no_message' });

  const { rows } = await q(`SELECT telegram_id FROM users`);
  const bot = req.app.get('bot');
  if (!bot) return res.status(500).json({ error: 'bot_not_attached' });

  let sent = 0;
  let failed = 0;
  for (const u of rows) {
    try {
      await bot.sendMessage(u.telegram_id, message);
      sent++;
      // small delay to respect Telegram rate limits
      await new Promise(r => setTimeout(r, 40));
    } catch {
      failed++;
    }
  }
  res.json({ ok: true, sent, failed });
});

export default router;