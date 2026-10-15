import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { q } from './db.js';
import { requireUser } from './auth.js';
import { getSetting, getSettings, setSetting } from './settings.js';
import { adminWebhookPath, handleAdminUpdate, registerAdminWebhook, notifyPendingProof, notifyNewPrimordial, notifyGatesOpen, notifyNewReply } from '../admin-bot/index.js';
import { moderateReply } from './moderation.js';
import { creditReferralFlat } from './referral.js';
import { publicWebhookPath, handlePublicUpdate, registerPublicWebhook } from '../bot/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ═════════════════════════════════════════════════════
// Public API  —  the Mini App talks only to these.
// All creation / resolving / stats live in the ADMIN BOT, not here.
// ═════════════════════════════════════════════════════
app.get('/api/health', (_, res) => res.json({ ok: true }));

// ═════════════════════════════════════════════════════
// THE ANTECHAMBER  —  invite-gate + referral primitives
// A "Sigil" is each player's unique referral code; "Oathbound" = people they
// brought; a "Primordial Nº" is the ordinal badge granted to the founding
// cohort who claim a handle before the gates open.
// ═════════════════════════════════════════════════════
const SIGIL_ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY349';
function randomSigil(len = 6) {
  const b = crypto.randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += SIGIL_ALPHABET[b[i] % SIGIL_ALPHABET.length];
  return s;
}

// Assign a stable, unique Sigil to a user the first time they appear.
// Retries on the (extremely rare) unique-index collision.
async function ensureSigil(id) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const { rows } = await q(`SELECT sigil FROM users WHERE telegram_id=$1`, [id]);
    if (rows.length && rows[0].sigil) return rows[0].sigil;
    const candidate = randomSigil();
    try {
      await q(`UPDATE users SET sigil=$1 WHERE telegram_id=$2 AND sigil IS NULL`, [candidate, id]);
      const { rows: check } = await q(`SELECT sigil FROM users WHERE telegram_id=$1`, [id]);
      if (check.length && check[0].sigil) return check[0].sigil;
    } catch { /* collision — loop and try a fresh code */ }
  }
  return null;
}

// Resolve the base link players actually OPEN. This must be the Telegram bot
// deep-link (https://t.me/<bot>) — NOT the Render web URL, which would open a
// bare browser tab. Order: explicit admin setting → env t.me link → derived from
// the public bot's username (getMe, cached) → web URL only as a last resort.
let _botLinkCache = null;
async function resolveReferralBase() {
  const s = await getSettings(['referral_link']);
  const manual = (s.referral_link || process.env.MINI_APP_LINK || '').trim();
  if (manual) return manual;
  if (_botLinkCache) return _botLinkCache;
  const token = process.env.BOT_TOKEN;
  if (token && typeof fetch === 'function') {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const j = await r.json();
      const uname = j?.result?.username;
      if (uname) { _botLinkCache = `https://t.me/${uname}`; return _botLinkCache; }
    } catch { /* fall through */ }
  }
  return (process.env.MINI_APP_URL || '').trim();
}

// Resolve the live gate state the Mini App should render.
async function antechamberState(me) {
  const s = await getSettings([
    'antechamber_enabled', 'antechamber_threshold',
    'antechamber_forced_open', 'referral_link',
  ]);
  const enabled = s.antechamber_enabled !== 'false';
  const forcedOpen = s.antechamber_forced_open === 'true';
  const threshold = Math.max(0, parseInt(s.antechamber_threshold, 10) || 0);

  // Headcount = everyone who has claimed a Primordial handle so far.
  let claimed = 0;
  try {
    const { rows } = await q(`SELECT COUNT(*)::int AS n FROM users WHERE is_primordial = TRUE`);
    claimed = rows[0]?.n || 0;
  } catch { claimed = 0; }

  const reached = claimed >= threshold;
  // "gate" = app locked and this user hasn't claimed; "standby" = claimed but
  // still waiting for the crowd; "open" = everyone's in.
  const open = !enabled || forcedOpen || reached;
  let phase;
  if (open) phase = 'open';
  else if (me?.is_primordial) phase = 'standby';
  else phase = 'gate';

  const base = await resolveReferralBase();

  return {
    phase, enabled, threshold,
    claimed,
    remaining: Math.max(0, threshold - claimed),
    referralBase: base,
  };
}

app.get('/api/today', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await q(
    `SELECT id, challenge_date, question, options, reveal_at, status,
            winner_id, ranking, ai_reason, show_reason, outcome_text
     FROM challenges WHERE challenge_date = $1`,
    [today]
  );
  if (!rows.length) return res.json({ challenge: null });
  res.json({ challenge: rows[0] });
});

app.get('/api/me', requireUser, async (req, res) => {
  const id = req.tgUser.id;

  // Ensure the row exists.
  let { rows } = await q(
    `SELECT telegram_id, username, first_name, points, streak, best_streak,
            handle, sigil, referred_by, is_primordial, primordial_no,
            referral_earned, active_days, created_at, last_active
     FROM users WHERE telegram_id = $1`,
    [id]
  );
  if (!rows.length) {
    await q(
      `INSERT INTO users (telegram_id, username, first_name)
       VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [id, req.tgUser.username, req.tgUser.first_name]
    );
    ({ rows } = await q(
      `SELECT telegram_id, username, first_name, points, streak, best_streak,
              handle, sigil, referred_by, is_primordial, primordial_no,
              referral_earned, active_days, created_at, last_active
       FROM users WHERE telegram_id = $1`,
      [id]
    ));
  }
  let user = rows[0] || { telegram_id: id, points: 0, streak: 0, best_streak: 0 };

  // Universal referral: everyone carries a Sigil, whether gated or not.
  if (!user.sigil) {
    const sigil = await ensureSigil(id);
    if (sigil) user.sigil = sigil;
  }

  // Referral attribution — only from the signed start_param, only once, never self.
  if (!user.referred_by && req.startParam) {
    const code = req.startParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    // Guard against self-referral: ignore a player's own Sigil outright.
    if (code && code !== (user.sigil || '').toUpperCase()) {
      try {
        const { rows: ref } = await q(
          `SELECT telegram_id FROM users WHERE sigil = $1`, [code]
        );
        if (ref.length && String(ref[0].telegram_id) !== String(id)) {
          const upd = await q(
            `UPDATE users SET referred_by = $1 WHERE telegram_id = $2 AND referred_by IS NULL
             RETURNING telegram_id`,
            [ref[0].telegram_id, id]
          );
          if (upd.rows.length) {
            user.referred_by = ref[0].telegram_id;
            // Pay the referrer their flat per-head bounty right now (no-op
            // unless the admin set 'points' mode with a positive value).
            try { await creditReferralFlat(q, ref[0].telegram_id); } catch { /* ignore */ }
          }
        }
      } catch { /* ignore attribution races */ }
    }
  }

  // How many souls this player has brought (their Oathbound count).
  let oathbound = 0;
  try {
    const { rows: c } = await q(
      `SELECT COUNT(*)::int AS n FROM users WHERE referred_by = $1`, [id]
    );
    oathbound = c[0]?.n || 0;
  } catch { oathbound = 0; }

  // ── Daily activity + streak ───────────────────────────────────────────
  // Every app open counts attendance. If the last visit was yesterday the
  // streak grows; if it was today nothing changes; any older gap resets the
  // streak to 1. active_days is the lifetime count of distinct days seen.
  try {
    const prev = user.last_active ? new Date(user.last_active) : null;
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const prevDay = prev ? new Date(Date.UTC(prev.getUTCFullYear(), prev.getUTCMonth(), prev.getUTCDate())) : null;
    const dayGap = prevDay ? Math.round((today - prevDay) / 86400000) : null;
    if (dayGap !== 0) {
      // first visit today — advance activity
      const newStreak = dayGap === 1 ? (user.streak || 0) + 1 : 1;
      const newBest = Math.max(user.best_streak || 0, newStreak);
      const newActive = (user.active_days || 0) + 1;
      await q(
        `UPDATE users SET last_active = (NOW() AT TIME ZONE 'UTC')::date,
                          streak = $1, best_streak = $2, active_days = $3
         WHERE telegram_id = $4`,
        [newStreak, newBest, newActive, id]
      );
      user.streak = newStreak; user.best_streak = newBest; user.active_days = newActive;
    }
  } catch { /* activity tracking is best-effort */ }

  const ante = await antechamberState(user);

  // Season config: Day numbering is counted from an admin-set "Day 1" date.
  // If the admin hasn't set one, default to the date of the very first call,
  // so "Day 1" lands on launch day without any configuration.
  let dayZero = null;
  try {
    const cfg = await getSettings(['day_zero']);
    dayZero = (cfg.day_zero || '').trim() || null;
  } catch { dayZero = null; }
  if (!dayZero) {
    try {
      const { rows } = await q(`SELECT MIN(challenge_date)::text d FROM challenges`);
      if (rows[0]?.d) dayZero = String(rows[0].d).slice(0, 10);
    } catch { /* leave null; client falls back */ }
  }

  // Leaderboard stays hidden until the admin switches it on.
  let leaderboard = false;
  try {
    const lb = await getSetting('leaderboard_enabled', 'false');
    leaderboard = lb === 'true';
  } catch { leaderboard = false; }

  res.json({ user, oathbound, antechamber: ante, config: { dayZero, leaderboard } });
});

// Claim a Primordial handle during the gated phase (or anytime, universally).
app.post('/api/antechamber/claim', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const raw = (req.body?.handle || '').toString().trim().toLowerCase();

  // Handles are lowercase, 3–16 chars, letters/digits/underscore.
  if (!/^[a-z0-9_]{3,16}$/.test(raw)) {
    return res.status(400).json({ error: 'invalid_handle' });
  }

  // Already a Primordial? Return the existing identity (idempotent).
  const { rows: existing } = await q(
    `SELECT handle, primordial_no FROM users WHERE telegram_id = $1 AND is_primordial = TRUE`,
    [id]
  );
  if (existing.length) {
    return res.json({ ok: true, handle: existing[0].handle, primordial_no: existing[0].primordial_no });
  }

  // Make sure the player exists + carries a Sigil.
  await q(
    `INSERT INTO users (telegram_id, username, first_name)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [id, req.tgUser.username, req.tgUser.first_name]
  );
  const sigil = await ensureSigil(id);

  // Uniqueness check on the handle (case-insensitive).
  try {
    const { rows: taken } = await q(
      `SELECT 1 FROM users WHERE lower(handle) = $1 AND telegram_id <> $2`, [raw, id]
    );
    if (taken.length) return res.status(409).json({ error: 'handle_taken' });
  } catch { /* unique index will still protect us below */ }

  // Assign the next ordinal. Serialized enough for free-tier volume; the
  // unique index on primordial_no is the real guard against double-claims.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { rows: mx } = await q(
      `SELECT COALESCE(MAX(primordial_no), 0) AS mx FROM users WHERE is_primordial = TRUE`
    );
    const next = (mx[0]?.mx || 0) + 1;
    try {
      const upd = await q(
        `UPDATE users
         SET handle = $1, is_primordial = TRUE, primordial_no = $2,
             joined_antechamber_at = NOW()
         WHERE telegram_id = $3 AND is_primordial = FALSE
         RETURNING handle, primordial_no`,
        [raw, next, id]
      );
      if (upd.rows.length) {
        const { handle, primordial_no } = upd.rows[0];
        // Alert the admin of the new initiate + the running total.
        try {
          const { rows: t } = await q(`SELECT COUNT(*)::int AS n FROM users WHERE is_primordial = TRUE`);
          const total = t[0]?.n || primordial_no;
          notifyNewPrimordial({ user: req.tgUser, handle, no: primordial_no, total, sigil });
          // If this claim crossed the threshold, announce the gates once.
          const ante = await antechamberState({ is_primordial: true });
          if (ante.phase === 'open') {
            const announced = await getSetting('antechamber_announced', 'false');
            if (announced !== 'true' && ante.enabled) {
              await setSetting('antechamber_announced', 'true');
              notifyGatesOpen({ total });
            }
          }
        } catch (e) { console.error('primordial notify failed:', e.message); }
        return res.json({ ok: true, handle, primordial_no });
      }
    } catch (e) {
      // Unique collision on handle or primordial_no — retry / report.
      if (/handle/i.test(e.message)) return res.status(409).json({ error: 'handle_taken' });
      // else loop to grab a fresh ordinal
    }
  }
  return res.status(500).json({ error: 'claim_failed' });
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
  // Leaderboard is hidden until the admin enables it — refuse data otherwise
  // so a crafted request can't peek at the boards early.
  let enabled = false;
  try { enabled = (await getSetting('leaderboard_enabled', 'false')) === 'true'; } catch { enabled = false; }
  if (!enabled) return res.json({ enabled: false, points: [], activity: [] });

  // Board 1 — Ichor (points accumulated).
  const { rows: points } = await q(
    `SELECT telegram_id, username, first_name, points, streak,
            handle, is_primordial, primordial_no
     FROM users ORDER BY points DESC, streak DESC LIMIT 100`
  );
  // Board 2 — pure activity (how active they are): current streak first,
  // then lifetime active days, then longest streak.
  const { rows: activity } = await q(
    `SELECT telegram_id, username, first_name, points, streak, best_streak,
            active_days, handle, is_primordial, primordial_no,
            created_at, last_active
     FROM users
     ORDER BY streak DESC, active_days DESC, best_streak DESC LIMIT 100`
  );
  res.json({ enabled: true, points, activity });
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
    `SELECT id, question, options, ranking, winner_id, ai_reason, show_reason, outcome_text, status
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

app.get('/api/quests', requireUser, async (req, res) => {
  const uid = req.tgUser.id;
  const { rows } = await q(
    `SELECT q.id, q.title, q.description, q.reward, q.action_url, q.action_type,
            q.verify_text, q.requires_terms, q.terms_text, q.proof_type,
            c.status AS my_status
     FROM quests q
     LEFT JOIN quest_completions c
       ON c.quest_id = q.id AND c.telegram_id = $1
     WHERE q.is_active = TRUE
       AND (q.expires_at IS NULL OR q.expires_at > NOW())
     ORDER BY
       CASE
         WHEN c.status = 'rejected' THEN 0
         WHEN c.status IS NULL      THEN 1
         WHEN c.status = 'pending'  THEN 2
         WHEN c.status = 'approved' THEN 3
         ELSE 1
       END,
       q.created_at DESC`,
    [uid]
  );
  res.json({ quests: rows });
});

// Downscaled JPEG data URLs only; keep screenshots well under the body limit.
function validProofImage(s) {
  return typeof s === 'string' && /^data:image\/(png|jpe?g|webp);base64,/.test(s) && s.length < 900000;
}

app.post('/api/quests/:id/complete', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const questId = req.params.id;
  const agreed = req.body?.agreed === true;
  const proofValue = (req.body?.proof_value || '').toString().trim().slice(0, 400) || null;
  const proofImage = req.body?.proof_image;

  const { rows: quest } = await q(
    `SELECT title, reward, requires_terms, proof_type FROM quests WHERE id = $1 AND is_active = TRUE`,
    [questId]
  );
  if (!quest.length) return res.status(404).json({ error: 'no_quest' });
  const { title, reward, requires_terms, proof_type } = quest[0];

  // Legal gate: quests flagged requires_terms only complete once the player
  // has explicitly agreed to the attached Terms & Conditions.
  if (requires_terms && !agreed) {
    return res.status(400).json({ error: 'terms_required' });
  }

  // Proof gate: quests that demand a username / profile link / screenshot are
  // submitted for admin review and award NO points until approved.
  const needsProof = proof_type && proof_type !== 'none';
  if (needsProof) {
    if ((proof_type === 'username' || proof_type === 'link') && !proofValue)
      return res.status(400).json({ error: 'proof_required' });
    if (proof_type === 'screenshot' && !validProofImage(proofImage))
      return res.status(400).json({ error: 'proof_required' });
  }

  const status = needsProof ? 'pending' : 'approved';
  const insert = await q(
    `INSERT INTO quest_completions
       (telegram_id, quest_id, agreed_terms, status, proof_type, proof_value, proof_image)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
    [id, questId, agreed, status, proof_type || 'none', proofValue,
     proof_type === 'screenshot' && validProofImage(proofImage) ? proofImage : null]
  );
  if (!insert.rows.length) return res.status(409).json({ error: 'done' });

  // Only auto-award when no admin review is required.
  if (!needsProof) {
    await q(`UPDATE users SET points = points + $1 WHERE telegram_id = $2`, [reward, id]);
    return res.json({ ok: true, status: 'approved', reward });
  }

  // Hand the pending submission to the admin for review (fire-and-forget).
  try {
    notifyPendingProof({
      completionId: insert.rows[0].id,
      user: req.tgUser,
      quest: { id: questId, title, reward },
      proofType: proof_type,
      proofValue,
      proofImage: proof_type === 'screenshot' && validProofImage(proofImage) ? proofImage : null,
    });
  } catch (e) { console.error('notifyPendingProof failed:', e.message); }

  res.json({ ok: true, status: 'pending', reward: 0 });
});

// ═════════════════════════════════════════════════
// DAILY REPLIES  —  one voice per player, per challenge, after the reveal
//   • Only writable AFTER the reveal, so it can never leak a pick or sway
//     scoring (picks are already locked + resolved by then).
//   • One per player per challenge, no edits, no deletes (DB UNIQUE guard).
//   • 280-char cap. Runs the slur/URL filter first: a tripped reply is stored
//     as 'rejected' (silently) — the slot is spent, the writer still sees their
//     own words, but it never reaches the admin queue or the public wall.
//   • Clean replies land as 'pending' and are pushed to the admin to feature.
// ══════════════════════════════════════════════════
const REPLY_MAX = 280;

// A challenge is "revealed" once its reveal time has passed (or it's resolved).
function isRevealed(ch) {
  if (!ch) return false;
  if (ch.status && ch.status !== 'open') return true;
  return ch.reveal_at ? new Date(ch.reveal_at) <= new Date() : false;
}

async function todaysChallenge() {
  const today = new Date().toISOString().split('T')[0];
  const { rows } = await q(
    `SELECT id, challenge_date, question, reveal_at, status
     FROM challenges WHERE challenge_date = $1`, [today]);
  return rows[0] || null;
}

// Featured replies for the most recent PAST challenge that has any — "yesterday".
async function yesterdayFeatured(beforeDate) {
  try {
    const { rows: ch } = await q(
      `SELECT c.id, c.challenge_date, c.question
       FROM challenges c
       WHERE c.challenge_date < $1
         AND EXISTS (SELECT 1 FROM replies r WHERE r.challenge_id = c.id AND r.status='featured')
       ORDER BY c.challenge_date DESC LIMIT 1`, [beforeDate]);
    if (!ch.length) return { challenge: null, replies: [] };
    const { rows: reps } = await q(
      `SELECT body, admin_note FROM replies
       WHERE challenge_id=$1 AND status='featured'
       ORDER BY reviewed_at ASC NULLS LAST, id ASC LIMIT 3`, [ch[0].id]);
    return { challenge: { question: ch[0].question, date: ch[0].challenge_date }, replies: reps };
  } catch { return { challenge: null, replies: [] }; }
}

app.get('/api/replies/today', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const ch = await todaysChallenge();
  const today = new Date().toISOString().split('T')[0];
  const revealed = isRevealed(ch);

  let myReply = null, featured = [];
  if (ch) {
    const { rows: mine } = await q(
      `SELECT body, status FROM replies WHERE telegram_id=$1 AND challenge_id=$2`, [id, ch.id]);
    // Writer always sees their OWN reply, whatever its status (incl. rejected).
    if (mine.length) myReply = { body: mine[0].body, status: mine[0].status };
    if (revealed) {
      const { rows: feat } = await q(
        `SELECT body, admin_note FROM replies
         WHERE challenge_id=$1 AND status='featured'
         ORDER BY reviewed_at ASC NULLS LAST, id ASC LIMIT 3`, [ch.id]);
      featured = feat;
    }
  }

  const yest = await yesterdayFeatured(ch ? ch.challenge_date : today);

  res.json({
    hasChallenge: !!ch,
    revealed,
    canReply: !!ch && revealed && !myReply,
    maxLen: REPLY_MAX,
    myReply,
    featured,
    yesterday: yest,
  });
});

app.post('/api/replies', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const body = (req.body?.body || '').toString().trim().replace(/\s+/g, ' ').slice(0, REPLY_MAX);
  if (!body) return res.status(400).json({ error: 'empty' });

  const ch = await todaysChallenge();
  if (!ch) return res.status(404).json({ error: 'no_challenge' });
  if (!isRevealed(ch)) return res.status(400).json({ error: 'not_revealed' });

  // Spent your one slot already? (no edits, no deletes)
  const { rows: existing } = await q(
    `SELECT status FROM replies WHERE telegram_id=$1 AND challenge_id=$2`, [id, ch.id]);
  if (existing.length) return res.status(409).json({ error: 'already_replied' });

  // Slur / URL filter runs FIRST. A tripped reply is stored rejected + silent.
  const verdict = moderateReply(body);
  const status = verdict.clean ? 'pending' : 'rejected';

  const ins = await q(
    `INSERT INTO replies (challenge_id, telegram_id, body, status, auto_flag)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id`,
    [ch.id, id, body, status, !verdict.clean]);
  if (!ins.rows.length) return res.status(409).json({ error: 'already_replied' });

  // Only clean replies reach the admin's featuring queue.
  if (verdict.clean) {
    try {
      notifyNewReply({ replyId: ins.rows[0].id, user: req.tgUser, question: ch.question, body });
    } catch (e) { console.error('notifyNewReply failed:', e.message); }
  }

  // Response is identical whether clean or silently rejected — the writer can't
  // tell their reply was filtered; it simply shows as their private reply.
  res.json({ ok: true, status: 'pending', myReply: { body, status: 'pending' } });
});

// ─── Post-pick opinion ────────────────────────────────────────────────
// Captured right after a player locks a card: an optional "take" they can
// keep private (writer-only) OR send anonymously to the group. Reuses the
// replies table (one take per player per challenge). Anonymous takes run the
// slur/URL filter FIRST — a tripped take is stored rejected + silent (the
// writer can't tell), exactly like the Agora. Clean ones hit the admin's
// featuring queue, which posts them to the configured group/channel.
app.post('/api/opinion', requireUser, async (req, res) => {
  const id = req.tgUser.id;
  const challengeId = Number(req.body?.challengeId);
  const visibility = req.body?.visibility === 'public' ? 'public' : 'private';
  const body = (req.body?.body || '').toString().trim().replace(/\s+/g, ' ').slice(0, REPLY_MAX);
  if (!challengeId) return res.status(400).json({ error: 'no_challenge' });
  if (!body) return res.json({ ok: true, status: 'empty' });   // nothing to store

  // Must have actually locked a card on this challenge.
  const { rows: pk } = await q(
    `SELECT 1 FROM picks WHERE telegram_id=$1 AND challenge_id=$2`, [id, challengeId]);
  if (!pk.length) return res.status(403).json({ error: 'not_picked' });

  // One take per challenge (shared with the Agora reply — whoever writes first).
  const { rows: existing } = await q(
    `SELECT 1 FROM replies WHERE telegram_id=$1 AND challenge_id=$2`, [id, challengeId]);
  if (existing.length) return res.status(409).json({ error: 'already_replied' });

  if (visibility === 'private') {
    await q(
      `INSERT INTO replies (challenge_id, telegram_id, body, status, visibility)
       VALUES ($1,$2,$3,'private','private') ON CONFLICT DO NOTHING`,
      [challengeId, id, body]);
    return res.json({ ok: true, status: 'private' });
  }

  // Anonymous → group. Filter first, then (if clean) push to the admin queue.
  const verdict = moderateReply(body);
  const status = verdict.clean ? 'pending' : 'rejected';
  const { rows: ch } = await q(`SELECT question FROM challenges WHERE id=$1`, [challengeId]);
  const ins = await q(
    `INSERT INTO replies (challenge_id, telegram_id, body, status, auto_flag, visibility)
     VALUES ($1,$2,$3,$4,$5,'public') ON CONFLICT DO NOTHING RETURNING id`,
    [challengeId, id, body, status, !verdict.clean]);
  if (ins.rows.length && verdict.clean) {
    try {
      notifyNewReply({ replyId: ins.rows[0].id, user: req.tgUser, question: ch[0]?.question || '', body });
    } catch (e) { console.error('notifyNewReply failed:', e.message); }
  }
  // Identical response whether clean or silently rejected.
  res.json({ ok: true, status: 'pending' });
});

// ═════════════════════════════════════════════════════
// Static Mini App  +  SPA fallback
// ═════════════════════════════════════════════════════
// Telegram webhooks — both bots fold into this one web service.
// Telegram pushes updates to these unguessable, token-derived paths, so no
// separate always-on worker is needed (free-tier friendly).
app.post(adminWebhookPath, (req, res) => { handleAdminUpdate(req.body); res.sendStatus(200); });
app.post(publicWebhookPath, (req, res) => { handlePublicUpdate(req.body); res.sendStatus(200); });

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
  app.listen(PORT, async () => {
    console.log(`✓ HUBRIS on :${PORT}`);
    // Fold both Telegram bots onto this service via webhook.
    const base = process.env.MINI_APP_URL;
    await registerPublicWebhook(base);
    await registerAdminWebhook(base);
  });
})();
