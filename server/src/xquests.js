// TRIBES-FILE: server/src/xquests.js
// PHASE: 7 — Meta & Admin
// User side of X (Twitter) quests + admin review.

import { q } from './db.js';
import { notify } from './notifications.js';
import { feedWrite } from './feed.js';

export async function userList(userId) {
  const rows = (await q(
    `SELECT xq.id, xq.slug, xq.title, xq.description, xq.icon, xq.kind,
            xq.target, xq.target_label, xq.reward_ember, xq.per_user_limit,
            xq.max_completions, xq.ends_at,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='approved') AS my_approved,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='pending') AS my_pending,
            (SELECT reject_reason FROM x_claims c
               WHERE c.quest_id=xq.id AND c.user_id=$1 AND c.status='rejected'
               ORDER BY c.created_at DESC LIMIT 1) AS last_reject,
            (SELECT count(*)::int FROM x_claims c
               WHERE c.quest_id=xq.id AND c.status='approved') AS total_approved
       FROM x_quests xq
      WHERE xq.active=true
        AND (xq.starts_at IS NULL OR xq.starts_at <= now())
        AND (xq.ends_at   IS NULL OR xq.ends_at   >  now())
      ORDER BY xq.sort_order, xq.id`,
    [userId]
  )).rows;
  const quests = rows.map((r) => {
    const full = r.max_completions > 0 && r.total_approved >= r.max_completions;
    const doneByUser = r.my_approved >= r.per_user_limit;
    let status = 'open';
    if (r.my_pending > 0) status = 'pending';
    else if (doneByUser) status = 'done';
    else if (full) status = 'full';
    return {
      id: r.id, slug: r.slug, title: r.title, description: r.description,
      icon: r.icon, kind: r.kind, target: r.target, target_label: r.target_label,
      reward_ember: Number(r.reward_ember) || 0, ends_at: r.ends_at,
      status, last_reject: status === 'open' ? (r.last_reject || null) : null,
    };
  });
  const handle = (await q(
    'SELECT x_handle FROM x_handle_owners WHERE user_id=$1 LIMIT 1',
    [userId]
  )).rows[0];
  return { quests, myHandle: handle ? handle.x_handle : null };
}

export async function userClaim(user, { quest_id, x_handle, note }) {
  let handle = String(x_handle || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) {
    throw new Error('Enter a valid X handle (letters, numbers, underscore).');
  }
  const questId = Number(quest_id);
  const quest = (await q(
    'SELECT * FROM x_quests WHERE id=$1',
    [questId]
  )).rows[0];
  if (!quest || !quest.active) throw new Error('quest not found');
  if (quest.starts_at && new Date(quest.starts_at).getTime() > Date.now()) {
    throw new Error('quest not started yet');
  }
  if (quest.ends_at && new Date(quest.ends_at).getTime() < Date.now()) {
    throw new Error('quest has ended');
  }

  const owner = (await q(
    'SELECT user_id FROM x_handle_owners WHERE x_handle=$1',
    [handle]
  )).rows[0];
  if (owner && Number(owner.user_id) !== Number(user.id)) {
    throw new Error('That X handle is already linked to another account.');
  }

  const approved = (await q(
    `SELECT count(*)::int AS n FROM x_claims
      WHERE quest_id=$1 AND user_id=$2 AND status='approved'`,
    [questId, user.id]
  )).rows[0].n;
  if (approved >= quest.per_user_limit) throw new Error('You already completed this quest.');

  if (quest.max_completions > 0) {
    const total = (await q(
      "SELECT count(*)::int AS n FROM x_claims WHERE quest_id=$1 AND status='approved'",
      [questId]
    )).rows[0].n;
    if (total >= quest.max_completions) throw new Error('This quest is fully claimed.');
  }

  try {
    await q(
      `INSERT INTO x_claims (user_id, quest_id, x_handle, note, status)
       VALUES ($1,$2,$3,$4,'pending')`,
      [user.id, questId, handle, String(note || '').slice(0, 200)]
    );
  } catch (err) {
    if (String(err.code) === '23505') {
      throw new Error('You already have a pending claim for this quest.');
    }
    throw err;
  }

  feedWrite({
    type: 'x', icon: 'brand-x', severity: 'info',
    text: `@${handle} submitted "${quest.title}" for review`,
    detail: { questId, userId: user.id, handle },
    actor: user.id,
  });

  return { ok: true, status: 'pending' };
}

/* ---------- admin side ---------- */
export async function adminList() {
  return (await q(
    `SELECT q.*,
            (SELECT count(*)::int FROM x_claims c
              WHERE c.quest_id=q.id AND c.status='pending') AS pending,
            (SELECT count(*)::int FROM x_claims c
              WHERE c.quest_id=q.id AND c.status='approved') AS approved
       FROM x_quests q
      ORDER BY q.sort_order, q.id`
  )).rows;
}

export async function adminCreate(adminId, data) {
  const slug = String(data.slug || '').trim().toLowerCase()
    .replace(/[^a-z0-9_]/g, '').slice(0, 40);
  if (slug.length < 2) throw new Error('slug must be 2+ chars');
  const r = await q(
    `INSERT INTO x_quests (slug, title, description, icon, kind, target, target_label,
                           reward_ember, per_user_limit, max_completions, active, sort_order,
                           starts_at, ends_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [slug,
     String(data.title || slug).slice(0, 80),
     String(data.description || '').slice(0, 240),
     String(data.icon || 'brand-x').slice(0, 32),
     String(data.kind || 'follow').slice(0, 16),
     String(data.target || '').slice(0, 120),
     String(data.target_label || '').slice(0, 80),
     Math.max(0, Math.floor(Number(data.reward_ember) || 0)),
     Math.max(1, Math.floor(Number(data.per_user_limit) || 1)),
     Math.max(0, Math.floor(Number(data.max_completions) || 0)),
     data.active !== false,
     Math.floor(Number(data.sort_order) || 100),
     data.starts_at || null,
     data.ends_at || null,
     adminId || null]
  );
  return r.rows[0];
}

export async function adminUpdate(adminId, id, data) {
  const cur = (await q('SELECT * FROM x_quests WHERE id=$1', [id])).rows[0];
  if (!cur) throw new Error('no such quest');
  const m = { ...cur, ...data };
  const r = await q(
    `UPDATE x_quests SET title=$1, description=$2, icon=$3, kind=$4, target=$5, target_label=$6,
                         reward_ember=$7, per_user_limit=$8, max_completions=$9, active=$10,
                         sort_order=$11, starts_at=$12, ends_at=$13
     WHERE id=$14 RETURNING *`,
    [String(m.title).slice(0, 80),
     String(m.description || '').slice(0, 240),
     String(m.icon || 'brand-x').slice(0, 32),
     String(m.kind).slice(0, 16),
     String(m.target || '').slice(0, 120),
     String(m.target_label || '').slice(0, 80),
     Math.max(0, Math.floor(Number(m.reward_ember) || 0)),
     Math.max(1, Math.floor(Number(m.per_user_limit) || 1)),
     Math.max(0, Math.floor(Number(m.max_completions) || 0)),
     !!m.active,
     Math.floor(Number(m.sort_order) || 100),
     m.starts_at || null,
     m.ends_at || null,
     id]
  );
  return r.rows[0];
}

export async function adminDelete(adminId, id) {
  const r = await q('DELETE FROM x_quests WHERE id=$1 RETURNING slug', [id]);
  if (!r.rowCount) throw new Error('no such quest');
  return { id, deleted: true, slug: r.rows[0].slug };
}

export async function adminToggle(adminId, id, active) {
  const r = await q(
    'UPDATE x_quests SET active=$1 WHERE id=$2 RETURNING id, active',
    [!!active, id]
  );
  if (!r.rowCount) throw new Error('no such quest');
  return r.rows[0];
}

export async function claimsList({ status = 'pending', q: query = '', limit = 60 } = {}) {
  const like = '%' + (query || '') + '%';
  return (await q(
    `SELECT c.id, c.user_id, c.quest_id, c.x_handle, c.note, c.status,
            c.reviewed_by, c.reviewed_at, c.reject_reason, c.reward_paid, c.created_at,
            u.username, u.first_name, u.ember,
            q.slug AS quest_slug, q.title AS quest_title, q.icon AS quest_icon,
            q.kind AS quest_kind, q.target AS quest_target, q.target_label AS quest_target_label,
            q.reward_ember AS quest_reward_ember,
            (SELECT user_id FROM x_handle_owners WHERE x_handle = lower(c.x_handle)) AS handle_owner_user
       FROM x_claims c
       JOIN users u ON u.id = c.user_id
       JOIN x_quests q ON q.id = c.quest_id
      WHERE ($1 = 'all' OR c.status = $1)
        AND ($2 = '%%' OR c.x_handle ILIKE $2 OR u.username ILIKE $2 OR u.first_name ILIKE $2)
      ORDER BY c.created_at DESC LIMIT $3`,
    [status, like, Math.min(limit, 200)]
  )).rows;
}

export async function claimApprove(adminId, id) {
  const c = (await q(
    `SELECT c.*, q.reward_ember, q.per_user_limit, q.max_completions
       FROM x_claims c JOIN x_quests q ON q.id = c.quest_id
      WHERE c.id=$1`,
    [id]
  )).rows[0];
  if (!c) throw new Error('no such claim');
  if (c.status !== 'pending') throw new Error('already reviewed');
  if (String(c.user_id) === String(adminId)) throw new Error('cannot review your own claim');

  const handle = String(c.x_handle || '').replace(/^@/, '').toLowerCase();
  const owner = (await q(
    'SELECT user_id FROM x_handle_owners WHERE x_handle=$1',
    [handle]
  )).rows[0];
  if (owner && Number(owner.user_id) !== Number(c.user_id)) {
    throw new Error('that X handle is already linked to another account');
  }

  await q(
    `INSERT INTO x_handle_owners (x_handle, user_id) VALUES ($1,$2)
     ON CONFLICT (x_handle) DO NOTHING`,
    [handle, c.user_id]
  );
  await q('UPDATE users SET ember = ember + $1 WHERE id=$2', [c.reward_ember, c.user_id]);
  await q(
    `UPDATE x_claims
        SET status='approved', reviewed_by=$1, reviewed_at=now(),
            reward_paid=$2
      WHERE id=$3`,
    [adminId || null, JSON.stringify({ ember: c.reward_ember }), id]
  );

  await notify({
    userId: c.user_id,
    type: 'system',
    title: `Quest approved: ${c.quest_title}`,
    body: `+${c.reward_ember} Ember`,
    severity: 'success',
    action_kind: 'x',
  });

  feedWrite({
    type: 'x', icon: 'check', severity: 'success',
    text: `Approved @${handle} — ${c.quest_title}`,
    detail: { claimId: id, questId: c.quest_id, userId: c.user_id, reward: c.reward_ember },
    actor: adminId,
  });

  return { ok: true, id, reward_ember: c.reward_ember };
}

export async function claimReject(adminId, id, reason) {
  const c = (await q('SELECT * FROM x_claims WHERE id=$1', [id])).rows[0];
  if (!c) throw new Error('no such claim');
  if (c.status !== 'pending') throw new Error('already reviewed');
  const why = String(reason || '').trim();
  if (!why) throw new Error('reason is required');
  await q(
    `UPDATE x_claims
        SET status='rejected', reviewed_by=$1, reviewed_at=now(), reject_reason=$2
      WHERE id=$3`,
    [adminId || null, why.slice(0, 200), id]
  );

  await notify({
    userId: c.user_id,
    type: 'system',
    title: `Quest rejected`,
    body: why.slice(0, 200),
    severity: 'warn',
  });

  feedWrite({
    type: 'x', icon: 'bolt', severity: 'warn',
    text: `Rejected @${c.x_handle}: ${why}`,
    detail: { claimId: id, reason: why },
    actor: adminId,
  });

  return { ok: true, id, reason: why };
}

export async function stats() {
  const s = (await q(
    `SELECT
       (SELECT count(*)::int FROM x_quests WHERE active=true) AS active_quests,
       (SELECT count(*)::int FROM x_claims WHERE status='pending') AS pending,
       (SELECT count(*)::int FROM x_claims WHERE status='approved') AS approved,
       (SELECT count(*)::int FROM x_claims WHERE status='rejected') AS rejected,
       (SELECT count(*)::int FROM x_handle_owners) AS linked_handles`
  )).rows[0];
  const per = (await q(
    `SELECT q.slug, q.title,
            count(c.id) filter (where c.status='approved')::int AS approved,
            count(c.id) filter (where c.status='pending')::int AS pending
       FROM x_quests q LEFT JOIN x_claims c ON c.quest_id=q.id
       GROUP BY q.id, q.slug, q.title
      ORDER BY q.sort_order`
  )).rows;
  return { ...s, perQuest: per };
}