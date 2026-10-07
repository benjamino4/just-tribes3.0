import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { q } from './db.js';
import { requireUser } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ═════════════════════════════════════════════════════
// Public API  —  the Mini App talks only to these.
// All creation / resolving / stats live in the ADMIN BOT, not here.
// ═════════════════════════════════════════════════════
app.get('/api/health', (_, res) => res.json({ ok: true }));

app.get('/api/today', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await q(
    `SELECT id, challenge_date, question, options, reveal_at, status,
            winner_id, ranking, ai_reason, outcome_text
     FROM challenges WHERE challenge_date = $1`,
    [today]
  );
  if (!rows.length) return res.json({ challenge: null });
  res.json({ challenge: rows[0] });
});

app.get('/api/me', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const { rows } = await q(
    `SELECT telegram_id, username, first_name, points, streak, best_streak
     FROM users WHERE telegram_id = $1`,
    [id]
  );

  let user;
  if (!rows.length) {
    await q(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [id, req.tgUser.username, req.tgUser.first_name]
    );
    user = { telegram_id: id, points: 0, streak: 0, best_streak: 0 };
  } else {
    user = rows[0];
  }

  res.json({ user });
});

app.get('/api/me/pick', requireUser, async (req, res) => {
  const { rows } = await q(
    `SELECT choice, points_earned FROM picks
     WHERE telegram_id=$1 AND challenge_id=$2`,
    [req.tgUser.id, req.query.challengeId]
  );
  res.json({ pick: rows[0] || null });
});

app.post('/api/pick', requireUser, async (req, res) => {
  const { challengeId, choice } = req.body;
  const id = req.tgUser.id;

  const { rows: ch } = await q(`SELECT * FROM challenges WHERE id = $1`, [challengeId]);
  if (!ch.length) return res.status(404).json({ error: 'not_found' });
  const challenge = ch[0];

  if (challenge.status !== 'open' || new Date(challenge.reveal_at) <= new Date()) {
    return res.status(400).json({ error: 'closed' });
  }

  const validIds = challenge.options.map(o => o.id);
  if (!validIds.includes(choice)) return res.status(400).json({ error: 'invalid_choice' });

  const insert = await q(
    `INSERT INTO picks (telegram_id, challenge_id, choice)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id`,
    [id, challengeId, choice]
  );

  if (!insert.rows.length) return res.status(409).json({ error: 'already_picked' });

  await q(`UPDATE users SET last_pick=$1 WHERE telegram_id=$2`, [choice, id]).catch(() => {});
  res.json({ ok: true });
});

app.get('/api/board', async (req, res) => {
  const { rows } = await q(
    `SELECT telegram_id, username, first_name, points, streak
     FROM users ORDER BY points DESC, streak DESC LIMIT 100`
  );
  res.json({ board: rows });
});

app.get('/api/challenge/:id/stats', async (req, res) => {
  const { rows } = await q(
    `SELECT choice, COUNT(*)::int AS count FROM picks
     WHERE challenge_id = $1 GROUP BY choice`,
    [req.params.id]
  );
  const total = rows.reduce((s, r) => s + r.count, 0);
  const stats = rows.map(r => ({
    choice: r.choice,
    count: r.count,
    percent: total ? Math.round((r.count / total) * 100) : 0,
  }));
  res.json({ total, stats });
});

app.get('/api/challenge/:id/breakdown', async (req, res) => {
  const { rows: ch } = await q(
    `SELECT id, question, options, ranking, winner_id, ai_reason, outcome_text, status
     FROM challenges WHERE id=$1`,
    [req.params.id]
  );
  if (!ch.length) return res.status(404).json({ error: 'not_found' });
  const challenge = ch[0];

  const { rows: counts } = await q(
    `SELECT choice, COUNT(*)::int AS count FROM picks
     WHERE challenge_id=$1 GROUP BY choice`,
    [req.params.id]
  );
  const total = counts.reduce((s, r) => s + r.count, 0);
  const dist = {};
  counts.forEach(c => {
    dist[c.choice] = {
      count: c.count,
      percent: total ? Math.round((c.count / total) * 100) : 0,
    };
  });

  // ranking is stored as ordered objects [{ id, rank, points }]
  const pointsMap = {};
  (challenge.ranking || []).forEach(r => {
    if (r && typeof r === 'object') pointsMap[r.id] = r.points;
  });

  res.json({ challenge, distribution: dist, total, pointsMap });
});

app.get('/api/quests', async (req, res) => {
  const { rows } = await q(
    `SELECT id, title, description, reward, action_url, action_type, verify_text
     FROM quests WHERE is_active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY created_at DESC`
  );
  res.json({ quests: rows });
});

app.post('/api/quests/:id/complete', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const questId = req.params.id;

  const { rows: quest } = await q(
    `SELECT reward FROM quests WHERE id = $1 AND is_active = TRUE`,
    [questId]
  );
  if (!quest.length) return res.status(404).json({ error: 'no_quest' });

  const insert = await q(
    `INSERT INTO quest_completions (telegram_id, quest_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
    [id, questId]
  );
  if (!insert.rows.length) return res.status(409).json({ error: 'done' });

  await q(
    `UPDATE users SET points = points + $1 WHERE telegram_id = $2`,
    [quest[0].reward, id]
  );
  res.json({ ok: true, reward: quest[0].reward });
});

// ═════════════════════════════════════════════════════
// Static Mini App  +  SPA fallback
// ═════════════════════════════════════════════════════
app.use(express.static('public'));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'not_found' });
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ═════════════════════════════════════════════════════
// Auto-migrate + start
// ═════════════════════════════════════════════════════
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    const { migrate } = await import('./db.js');
    await migrate();
  } catch (e) {
    console.error('⚠ Migration skipped:', e.message);
  }
  app.listen(PORT, () => console.log(`✓ HUBRIS on :${PORT}`));
})();
