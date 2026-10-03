import { q } from './db.js';
import { CFG, DEFAULTS, setConfig } from './config.js';
import { readLive, writeLive, listLive, listVersions, revertLive } from './live.js';
import * as Forgotten from './forgotten.js';
import * as War from './war.js';

const TOKEN = process.env.ADMIN_BOT_TOKEN || '';
const ADMIN_IDS = new Set(
  (process.env.ADMIN_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
);
const fmt = (v) => (Number(v) || 0).toLocaleString('en-US');

async function send(chatId, text, keyboard = null) {
  if (!TOKEN || !chatId) return;
  try {
    const body = { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true };
    if (keyboard) body.reply_markup = keyboard;
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { console.error('[admin_bot] send', e.message); }
}

async function audit(adminId, action, detail, extra = {}) {
  try {
    await q(
      'INSERT INTO audit (admin_id, action, detail, before_json, after_json) VALUES ($1,$2,$3,$4,$5)',
      [String(adminId || ''), action, detail,
       extra.before ? JSON.stringify(extra.before) : null,
       extra.after ? JSON.stringify(extra.after) : null]
    );
  } catch {}
}

const MAIN_MENU = {
  inline_keyboard: [
    [{ text: '👥 Players', callback_data: 'menu:players' }, { text: '🏛 Tribes', callback_data: 'menu:tribes' }],
    [{ text: '🎮 Games', callback_data: 'menu:games' }, { text: '⚔️ Wars', callback_data: 'menu:wars' }],
    [{ text: '👻 Forgotten', callback_data: 'menu:forgotten' }, { text: '💰 Economy', callback_data: 'menu:economy' }],
    [{ text: '📝 Content', callback_data: 'menu:content' }, { text: '⚙️ Config', callback_data: 'menu:config' }],
    [{ text: '📜 Audit', callback_data: 'menu:audit' }, { text: '📣 Broadcast', callback_data: 'menu:broadcast' }],
    [{ text: '🎁 Gift Codes', callback_data: 'menu:codes' }, { text: '🌌 Emoji', callback_data: 'cmd:emoji' }]
  ]
};

const pendingResets = new Map();
const pendingInputs = new Map();

function setPending(adminId, kind, data = {}) {
  const t = setTimeout(() => pendingResets.delete(String(adminId)), 120000);
  pendingResets.set(String(adminId), { kind, data, timer: t });
}
function clearPending(adminId) {
  const p = pendingResets.get(String(adminId));
  if (p) { clearTimeout(p.timer); pendingResets.delete(String(adminId)); }
}

async function runCommand(adminId, cmd, args, chatId) {
  switch (cmd) {
    case 'start':
    case 'help':
      return { text: '<b>🔥 TRIBES — Admin Console</b>\n\nTap a section below, or type a command directly:\n\n👥 /player /ban /unban /grant /bless /unbless\n🏛 /tribes /tribe /dissolve\n🎮 /games /gametoggle\n⚔️ /wars /warend\n👻 /forgotten list|stats|spawn|del\n🎁 /codes /newcode /revokecode /delcode\n🌌 /emoji\n💰 /config /set\n📜 /audit · 📣 /broadcast\n\nEach button also explains how to use it.', keyboard: MAIN_MENU };

    case 'stats': {
      const u = (await q('SELECT count(*)::int n, coalesce(sum(sparks),0)::bigint e FROM users')).rows[0];
      const t = (await q('SELECT count(*)::int n FROM tribes WHERE forgotten=false')).rows[0];
      const w = (await q("SELECT count(*)::int n FROM wars WHERE status='active'")).rows[0];
      const f = (await q('SELECT count(*)::int n FROM forgotten_ones WHERE active=true')).rows[0];
      return { text:
        `<b>Overview</b>\n` +
        `Users: ${fmt(u.n)} · Sparks: ${fmt(u.e)}\n` +
        `Tribes: ${fmt(t.n)}\n` +
        `Active wars: ${w.n}\n` +
        `Forgotten Ones: ${f.n}`
      };
    }

    case 'player': {
      const s = String(args[0] || '').trim();
      if (!s) return { text: 'Usage: /player <id|username>' };
      const r = /^\d+$/.test(s)
        ? await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, blessed, tribe_id, rank_rating FROM users WHERE id=$1', [s])
        : await q('SELECT id, username, first_name, role, sparks, kinship, stars, banned, blessed, tribe_id, rank_rating FROM users WHERE username ILIKE $1 LIMIT 5', ['%' + s + '%']);
      if (!r.rowCount) return { text: 'No such player.' };
      return { text: r.rows.map((u) =>
        `<b>${u.first_name || u.username || u.id}</b> (${u.id})${u.blessed ? ' ✨ blessed' : ''}\n` +
        `${fmt(u.sparks)} 🔥 · ${fmt(u.kinship)} 🏛 · ${fmt(u.stars)} ⭐\n` +
        `Rank: ${u.rank_rating} · ${u.banned ? 'BANNED' : 'ok'} · tribe ${u.tribe_id || '—'}`
      ).join('\n\n') };
    }

    case 'ban': {
      const id = Number(args[0]); const reason = args.slice(1).join(' ');
      if (!id) return { text: 'Usage: /ban <id> <reason>' };
      await q('UPDATE users SET banned=true, ban_reason=$1 WHERE id=$2', [reason.slice(0, 200), id]);
      await audit(adminId, 'ban', `${id}: ${reason}`);
      return { text: `✅ Banned ${id}` };
    }

    case 'unban': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /unban <id>' };
      await q('UPDATE users SET banned=false, ban_reason=NULL WHERE id=$1', [id]);
      await audit(adminId, 'unban', String(id));
      return { text: `✅ Unbanned ${id}` };
    }

    case 'grant': {
      const id = Number(args[0]);
      const kind = String(args[1] || '');
      const amount = Math.floor(Number(args[2]) || 0);
      if (!id || !['sparks', 'kinship', 'stars'].includes(kind)) {
        return { text: 'Usage: /grant <id> <sparks|kinship|stars> <amount>' };
      }
      const before = (await q(`SELECT ${kind} FROM users WHERE id=$1`, [id])).rows[0];
      await q(`UPDATE users SET ${kind} = ${kind} + $1 WHERE id=$2`, [amount, id]);
      await audit(adminId, 'grant', `${amount} ${kind} -> ${id}`,
        { before: before ? Number(before[kind]) : null, after: before ? Number(before[kind]) + amount : null });
      return { text: `✅ Granted ${amount} ${kind} to ${id}` };
    }

    case 'bless': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /bless <id>' };
      const r = await q('UPDATE users SET blessed=true WHERE id=$1 RETURNING first_name, username', [id]);
      if (!r.rowCount) return { text: 'No such player.' };
      await audit(adminId, 'bless', String(id));
      try {
        const { emit } = await import('./events.js');
        await emit({ userId: id, tier: 'island', kind: 'system', icon: 'spark', title: 'You have been Blessed', body: 'An elder has blessed your flame. ✨', severity: 'info' });
      } catch {}
      return { text: `✨ Blessed ${r.rows[0].first_name || r.rows[0].username || id}.` };
    }

    case 'unbless': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /unbless <id>' };
      const r = await q('UPDATE users SET blessed=false WHERE id=$1 RETURNING first_name, username', [id]);
      if (!r.rowCount) return { text: 'No such player.' };
      await audit(adminId, 'unbless', String(id));
      return { text: `✔️ Removed blessing from ${r.rows[0].first_name || r.rows[0].username || id}.` };
    }

    case 'newcode':
    case 'givecode': {
      // /newcode <CODE> <sparks|kinship|stars> <amount> [maxUses] [perUser]
      const code = String(args[0] || '').trim().toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 32);
      const kind = String(args[1] || '').toLowerCase();
      const amount = Math.floor(Number(args[2]) || 0);
      const maxUses = Math.max(0, Math.floor(Number(args[3]) || 0));
      const perUser = Math.max(1, Math.floor(Number(args[4]) || 1));
      if (!code || !['sparks', 'kinship', 'stars'].includes(kind) || amount <= 0) {
        return { text: 'Usage: /newcode <CODE> <sparks|kinship|stars> <amount> [maxUses] [perUser]\n\nmaxUses 0 = unlimited. Example:\n/newcode WELCOME sparks 500 0 1' };
      }
      const exists = (await q('SELECT 1 FROM codes WHERE code=$1', [code])).rowCount;
      if (exists) return { text: `⚠️ Code <code>${code}</code> already exists. Use /revokecode or /delcode first.` };
      await q(
        `INSERT INTO codes (code, kind, amount, max_uses, per_user_limit, active, created_by)
         VALUES ($1,$2,$3,$4,$5,true,$6)`,
        [code, kind, amount, maxUses, perUser, String(adminId)]
      );
      await audit(adminId, 'newcode', `${code}: ${amount} ${kind} max=${maxUses} per=${perUser}`);
      return { text: `✅ Created gift code <code>${code}</code>\n${fmt(amount)} ${kind} · ${maxUses ? maxUses + ' total uses' : 'unlimited'} · ${perUser}/player\n\nPlayers redeem it in the floating Gift Code box.` };
    }

    case 'codes': {
      const rows = (await q(
        'SELECT code, kind, amount, uses, max_uses, per_user_limit, active FROM codes ORDER BY created_at DESC LIMIT 30'
      )).rows;
      if (!rows.length) return { text: 'No gift codes yet.\n\nCreate one: /newcode <CODE> <sparks|kinship|stars> <amount> [maxUses] [perUser]' };
      return { text: '<b>🎁 Gift Codes</b>\n' + rows.map((c) =>
        `${c.active ? '✅' : '⛔️'} <code>${c.code}</code> · ${fmt(c.amount)} ${c.kind} · ${c.uses}/${c.max_uses ? c.max_uses : '∞'} used · ${c.per_user_limit}/player`
      ).join('\n') + '\n\nRevoke: /revokecode &lt;CODE&gt; · Delete: /delcode &lt;CODE&gt;' };
    }

    case 'revokecode': {
      const code = String(args[0] || '').trim().toUpperCase();
      if (!code) return { text: 'Usage: /revokecode <CODE>' };
      const r = await q('UPDATE codes SET active=false WHERE code=$1 RETURNING code', [code]);
      if (!r.rowCount) return { text: 'No such code.' };
      await audit(adminId, 'revokecode', code);
      return { text: `⛔️ Revoked <code>${code}</code> (can no longer be redeemed).` };
    }

    case 'delcode': {
      const code = String(args[0] || '').trim().toUpperCase();
      if (!code) return { text: 'Usage: /delcode <CODE>' };
      const r = await q('DELETE FROM codes WHERE code=$1 RETURNING code', [code]);
      if (!r.rowCount) return { text: 'No such code.' };
      await audit(adminId, 'delcode', code);
      return { text: `🗑 Deleted <code>${code}</code>.` };
    }

    case 'broadcast': {
      const text = args.join(' ');
      if (!text) return { text: 'Usage: /broadcast <message>' };
      const ids = (await q('SELECT id FROM users WHERE banned=false')).rows;
      const { emit } = await import('./events.js');
      for (const r of ids) {
        await emit({ userId: r.id, tier: 'island', kind: 'system', icon: 'spark', title: 'Announcement', body: text, severity: 'info' });
      }
      await audit(adminId, 'broadcast', `${ids.length} users`);
      return { text: `📣 Sent to ${ids.length}` };
    }

    case 'config': {
      const keys = Object.keys(DEFAULTS);
      return { text: `<b>Config keys (${keys.length})</b>\n` + keys.slice(0, 60).join('\n') + (keys.length > 60 ? '\n…' : '') };
    }

    case 'set': {
      const [k, ...rest] = args;
      const v = rest.join(' ');
      if (!(k in DEFAULTS)) return { text: 'Unknown key' };
      const val = await setConfig(k, v, adminId);
      return { text: `✅ ${k} = ${val}` };
    }

    case 'reset': {
      setPending(adminId, 'progression');
      return { text: '⚠️ Progression reset requested. Reply <code>RESET</code> to confirm within 2 minutes.' };
    }

    case 'factory': {
      setPending(adminId, 'factory');
      return { text: '🛑 Factory reset requested. Reply <code>FACTORY</code> to confirm within 2 minutes.' };
    }

    case 'RESET': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'progression') return { text: 'Nothing pending.' };
      clearPending(adminId);
      await q(`UPDATE users SET sparks = 500, kinship = 0, streak = 0, last_checkin = NULL,
        ash_ready_at = NULL, ash_count = 0, role = 'Toddler', tribe_id = NULL,
        rank_rating = 1000`);
      await q(`UPDATE tribes SET treasury = 0, members = 0, kinship_total = 0,
        donated_total = 0, members_total = 0, wins = 0, losses = 0, level = 1`);
      await audit(adminId, 'resetProgression', 'complete');
      return { text: '✅ Progression reset complete.' };
    }

    case 'FACTORY': {
      const p = pendingResets.get(String(adminId));
      if (!p || p.kind !== 'factory') return { text: 'Nothing pending.' };
      clearPending(adminId);
      const tables = ['war_matches','war_fronts','wars','duels','rank_history','seat_assignments',
        'live_feed','kiva_messages','kiva_reads','referral_events','code_redemptions',
        'relic_slots','user_relics','payments','audit'];
      for (const t of tables) {
        try { await q(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`); } catch {}
      }
      await q('UPDATE users SET tribe_id = NULL, sparks = 500, stars = 0, kinship = 0, role = \'Toddler\', streak = 0, last_checkin = NULL, banned = false, rank_rating = 1000');
      await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL');
      await q('DELETE FROM tribes');
      await audit(adminId, 'factoryReset', 'complete');
      return { text: '✅ Factory reset complete.' };
    }

    case 'audit': {
      const lim = Math.min(Number(args[0]) || 20, 100);
      const rows = (await q(
        'SELECT admin_id, action, detail, created_at FROM audit ORDER BY id DESC LIMIT $1', [lim]
      )).rows;
      return { text: rows.map((r) =>
        `${new Date(r.created_at).toISOString().slice(0, 19)} · ${r.action} · ${r.detail || ''} (by ${r.admin_id})`
      ).join('\n') || 'No audit entries.' };
    }

    case 'forgotten': {
      const sub = args[0] || 'list';
      if (sub === 'list') {
        const rows = (await q(
          'SELECT id, name, rank_rating, personality, rank_games, rank_wins FROM forgotten_ones WHERE active=true ORDER BY rank_rating DESC LIMIT 30'
        )).rows;
        return { text: rows.map((r) =>
          `${r.name} · rank ${r.rank_rating} · ${r.personality} · ${r.rank_wins}/${r.rank_games}`
        ).join('\n') || 'No Forgotten Ones.' };
      }
      if (sub === 'stats') {
        const n = (await q('SELECT count(*)::int AS n FROM forgotten_ones WHERE active=true')).rows[0];
        const matches = (await q('SELECT count(*)::int AS n FROM forgotten_matches')).rows[0];
        return { text: `Forgotten Ones: ${n.n}\nTotal matches played: ${matches.n}` };
      }
      if (sub === 'spawn') {
        const count = Math.min(Math.max(Number(args[1]) || 1, 1), 20);
        for (let i = 0; i < count; i++) await Forgotten.createOne();
        await audit(adminId, 'forgottenSpawn', String(count));
        return { text: `✅ Spawned ${count} Forgotten One(s).` };
      }
      if (sub === 'del') {
        const id = Number(args[1]);
        if (!id) return { text: 'Usage: /forgotten del <id>' };
        const r = await q('UPDATE forgotten_ones SET active=false WHERE id=$1 RETURNING name', [id]);
        if (!r.rowCount) return { text: 'No such Forgotten One.' };
        await audit(adminId, 'forgottenDel', String(id));
        return { text: `✅ Retired ${r.rows[0].name} (#${id}).` };
      }
      return { text: 'Usage: /forgotten [list|stats|spawn <n>|del <id>]' };
    }

    case 'tribes': {
      const rows = (await q(
        `SELECT id, name, level, members, wins, losses, treasury, forgotten
         FROM tribes ORDER BY level DESC, wins DESC LIMIT 20`
      )).rows;
      if (!rows.length) return { text: 'No tribes yet.' };
      return { text: '<b>🏛 Tribes (top 20)</b>\n' + rows.map((t) =>
        `#${t.id} <b>${t.name}</b>${t.forgotten ? ' 👻' : ''} · L${t.level} · ${t.members} kin · ${t.wins}W/${t.losses}L · ${fmt(t.treasury)}🔥`
      ).join('\n') + '\n\nTap one with /tribe &lt;id&gt; · remove with /dissolve &lt;id&gt;' };
    }

    case 'tribe': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /tribe <id>' };
      const t = (await q('SELECT * FROM tribes WHERE id=$1', [id])).rows[0];
      if (!t) return { text: 'No such tribe.' };
      const mem = (await q('SELECT count(*)::int n FROM users WHERE tribe_id=$1', [id])).rows[0];
      return { text:
        `<b>${t.name}</b> (#${t.id})${t.forgotten ? ' 👻 forgotten' : ''}\n` +
        `Level ${t.level} · ${mem.n} members\n` +
        `Treasury ${fmt(t.treasury)} 🔥 · Kinship ${fmt(t.kinship_total)}\n` +
        `Record ${t.wins}W / ${t.losses}L\n` +
        `Motto: ${t.motto || '—'}\n\nRemove: /dissolve ${t.id}` };
    }

    case 'dissolve': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /dissolve <id>' };
      const t = (await q('SELECT name FROM tribes WHERE id=$1', [id])).rows[0];
      if (!t) return { text: 'No such tribe.' };
      setPending(adminId, 'confirm_dissolve', { id, name: t.name });
      return { text: `⚠️ Dissolve <b>${t.name}</b> (#${id})? This frees all its members and deletes the tribe.\n\nReply <code>CONFIRM</code> within 2 minutes.` };
    }

    case 'games': {
      const rows = (await q(
        'SELECT slug, name, archetype, active, sort_order FROM game_defs ORDER BY sort_order, id'
      )).rows;
      return { text: '<b>🎮 Games</b>\n' + rows.map((g) =>
        `${g.active ? '✅' : '⭕️'} <code>${g.slug}</code> · ${g.name} (${g.archetype})`
      ).join('\n') + '\n\nEnable/disable: /gametoggle &lt;slug&gt;' };
    }

    case 'gametoggle': {
      const slug = String(args[0] || '').trim();
      if (!slug) return { text: 'Usage: /gametoggle <slug>' };
      const r = await q(
        'UPDATE game_defs SET active = NOT active WHERE slug=$1 RETURNING name, active', [slug]
      );
      if (!r.rowCount) return { text: 'No such game slug.' };
      await audit(adminId, 'gametoggle', `${slug} -> ${r.rows[0].active}`);
      return { text: `${r.rows[0].active ? '✅ Enabled' : '⭕️ Disabled'} ${r.rows[0].name}` };
    }

    case 'wars': {
      const rows = (await q(
        `SELECT w.id, w.status, w.attacker_score, w.defender_score, w.end_at,
                a.name AS an, d.name AS dn
         FROM wars w
         LEFT JOIN tribes a ON a.id=w.attacker_id
         LEFT JOIN tribes d ON d.id=w.defender_id
         WHERE w.status='active' ORDER BY w.start_at DESC LIMIT 20`
      )).rows;
      if (!rows.length) return { text: 'No active wars.' };
      return { text: '<b>⚔️ Active Wars</b>\n' + rows.map((w) => {
        const left = Math.max(0, Math.round((new Date(w.end_at).getTime() - Date.now()) / 60000));
        return `#${w.id} ${w.an} ${w.attacker_score}–${w.defender_score} ${w.dn} · ${left}m left`;
      }).join('\n') + '\n\nForce-finish now: /warend &lt;id&gt;' };
    }

    case 'warend': {
      const id = Number(args[0]);
      if (!id) return { text: 'Usage: /warend <id>' };
      const w = (await q("SELECT id FROM wars WHERE id=$1 AND status='active'", [id])).rows[0];
      if (!w) return { text: 'No such active war.' };
      await q('UPDATE wars SET end_at = now() WHERE id=$1', [id]);
      const n = await War.resolveWarIfDue();
      await audit(adminId, 'warend', String(id));
      return { text: `✅ War #${id} resolved (${n} war(s) settled this pass).` };
    }

    case 'emoji': {
      const rows = (await q(
        `SELECT es.slug, es.name, es.price_stars, es.active,
                (SELECT count(*)::int FROM user_emoji_sets u WHERE u.set_slug=es.slug) AS owners
         FROM emoji_sets es ORDER BY es.sort_order, es.id`
      )).rows;
      if (!rows.length) return { text: 'No emoji sets.' };
      return { text: '<b>🪐 Emoji Sets</b>\n' + rows.map((e) =>
        `${e.active ? '✅' : '⭕️'} <code>${e.slug}</code> · ${e.name} · ${e.price_stars > 0 ? e.price_stars + '⭐ premium' : 'free'} · ${e.owners} owners`
      ).join('\n') + '\n\nPrice: /set is per-config; edit art in the emoji_defs table.' };
    }

    default:
      return { text: 'Unknown command. Type /help' };
  }
}

async function handleCallback(adminId, data, chatId, messageId) {
  if (data === 'menu:main') {
    await send(chatId, '🔥 <b>TRIBES — Admin Console</b>', MAIN_MENU);
    return;
  }
  if (data.startsWith('menu:')) {
    const section = data.slice(5);
    const menus = {
      players: { text: '👥 <b>Players</b>\n\nLook up and moderate any player.\n\n<b>How to use — type:</b>\n/player &lt;id|name&gt; — view a profile\n/ban &lt;id&gt; &lt;reason&gt; — ban\n/unban &lt;id&gt; — lift a ban\n/grant &lt;id&gt; &lt;sparks|kinship|stars&gt; &lt;amount&gt; — award currency\n/bless &lt;id&gt; — bless a player (✨ badge + notice)\n/unbless &lt;id&gt; — remove the blessing', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      tribes: { text: '🏛 <b>Tribes</b>\n\nBrowse and manage every tribe directly from here — no SQL needed.\n\n<b>Buttons below</b> list the top tribes. Then:\n/tribe &lt;id&gt; — full detail\n/dissolve &lt;id&gt; — disband a tribe (asks you to CONFIRM)', keyboard: { inline_keyboard: [[{ text: '📋 List tribes', callback_data: 'cmd:tribes' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
      games: { text: '🎮 <b>Games</b>\n\nTurn individual mini-games on or off. Disabled games stop appearing in Arena & War matchmaking immediately.\n\n<b>How to use:</b>\n/games — list all games + status\n/gametoggle &lt;slug&gt; — enable/disable one', keyboard: { inline_keyboard: [[{ text: '📋 List games', callback_data: 'cmd:games' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
      wars: { text: '⚔️ <b>Wars</b>\n\nWars run live and auto-resolve when their timer ends. From here you can watch them and end one early.\n\n<b>How to use:</b>\n/wars — list active wars + scores\n/warend &lt;id&gt; — resolve one right now\n/set war_duration_minutes &lt;n&gt; — length of new wars', keyboard: { inline_keyboard: [[{ text: '📋 List wars', callback_data: 'cmd:wars' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
      forgotten: { text: '👻 <b>Forgotten Ones</b>\n\nThe AI “ember-spirit” opponents (hidden accounts). They fill Arena duels and war fronts when no human is free, and are kept ~70% strength so players win most of the time.\n\n<b>How to use:</b>\n/forgotten list — roster\n/forgotten stats — totals\n/forgotten spawn &lt;n&gt; — add bots\n/forgotten del &lt;id&gt; — retire one', keyboard: { inline_keyboard: [[{ text: '📋 List', callback_data: 'cmd:forgotten list' }, { text: '➕ Spawn 5', callback_data: 'cmd:forgotten spawn 5' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
      economy: { text: '💰 <b>Economy</b>\n\nTune every currency sink & faucet. Changes apply instantly to all players.\n\n<b>Common keys (use /set key value):</b>\n/set checkin_base &lt;n&gt; — daily check-in reward\n/set ash_unit &lt;n&gt; — idle sparks per unit\n/set found_sparks &lt;n&gt; — cost to found a tribe\n\n/config lists every key.', keyboard: { inline_keyboard: [[{ text: '🪐 Emoji store', callback_data: 'cmd:emoji' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
      content: {
        text: '📝 <b>Content</b>\n\nEdit live content files:',
        keyboard: { inline_keyboard: [
          [{ text: 'Verses', callback_data: 'edit:verses.json' }, { text: 'Help', callback_data: 'edit:help.json' }],
          [{ text: 'Colors', callback_data: 'edit:colors.json' }, { text: 'Game Texts', callback_data: 'edit:game_texts.json' }],
          [{ text: '← Back', callback_data: 'menu:main' }]
        ] }
      },
      config: { text: '⚙️ <b>Config</b>\n\n/set <key> <value>\n/config to list all keys', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      audit: { text: '📜 <b>Audit</b>\n\n/audit 50 — last 50 actions', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      broadcast: { text: '📣 <b>Broadcast</b>\n\n/broadcast <message>', keyboard: { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] } },
      codes: { text: '🎁 <b>Gift Codes</b>\n\nCreate redeemable codes players enter in the in-app floating Gift Code box. Each code grants sparks, kinship, or stars.\n\n<b>How to use:</b>\n/newcode &lt;CODE&gt; &lt;sparks|kinship|stars&gt; &lt;amount&gt; [maxUses] [perUser]\n   • maxUses 0 = unlimited total redemptions\n   • perUser defaults to 1\n   • e.g. <code>/newcode WELCOME sparks 500 0 1</code>\n/codes — list every code + how many times used\n/revokecode &lt;CODE&gt; — disable (keeps history)\n/delcode &lt;CODE&gt; — delete permanently', keyboard: { inline_keyboard: [[{ text: '📋 List codes', callback_data: 'cmd:codes' }], [{ text: '← Back', callback_data: 'menu:main' }]] } },
    };
    const m = menus[section];
    if (m) await send(chatId, m.text, m.keyboard);
    return;
  }
  if (data.startsWith('cmd:')) {
    // Quick-action buttons: run a normal command and show its result.
    const parts = data.slice(4).trim().split(/\s+/);
    const out = await runCommand(adminId, parts[0], parts.slice(1), chatId);
    await send(chatId, out.text, out.keyboard || { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:main' }]] });
    return;
  }
  if (data.startsWith('edit:')) {
    const file = data.slice(5);
    const content = await readLive(file);
    const preview = JSON.stringify(content, null, 2).slice(0, 3500);
    await send(chatId,
      `📝 <b>${file}</b>\n\n<code>${preview}</code>\n\nSend the new JSON content to update.`,
      { inline_keyboard: [[{ text: '← Back', callback_data: 'menu:content' }]] }
    );
    setPending(adminId, 'edit_file', { file });
    return;
  }
}

export async function adminBotWebhook(update) {
  if (update.callback_query) {
    const cq = update.callback_query;
    const from = cq.from?.id;
    const chat = cq.message?.chat?.id;
    if (!ADMIN_IDS.has(String(from))) {
      await send(chat, '⛔ Unauthorized.');
      return;
    }
    try {
      await handleCallback(from, cq.data, chat, cq.message.message_id);
    } catch (e) {
      await send(chat, '⚠️ ' + e.message);
    }
    return;
  }

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return;
  const from = msg.from?.id;
  const chat = msg.chat?.id;
  if (!ADMIN_IDS.has(String(from))) {
    await send(chat, '⛔ Unauthorized.');
    return;
  }

  // Check if waiting for input (file edit)
  const pending = pendingResets.get(String(from));
  if (pending && pending.kind === 'edit_file') {
    try {
      const newContent = JSON.parse(msg.text);
      await writeLive(pending.data.file, newContent, from, 'admin bot edit');
      clearPending(from);
      await send(chat, `✅ Updated ${pending.data.file}`);
    } catch (e) {
      await send(chat, `⚠️ Invalid JSON: ${e.message}\n\nTry again or /cancel.`);
    }
    return;
  }
  if (pending && pending.kind === 'confirm_dissolve') {
    if (msg.text.trim() === 'CONFIRM') {
      const { id, name } = pending.data;
      clearPending(from);
      try {
        await q('UPDATE users SET tribe_id = NULL WHERE tribe_id=$1', [id]);
        await q('UPDATE tribe_names SET claimed_by_tribe_id = NULL WHERE claimed_by_tribe_id=$1', [id]);
        await q("UPDATE wars SET status='resolved', resolved_at=now() WHERE status='active' AND (attacker_id=$1 OR defender_id=$1)", [id]);
        await q('DELETE FROM tribes WHERE id=$1', [id]);
        await audit(from, 'dissolveTribe', `${id}: ${name}`);
        await send(chat, `✅ Dissolved ${name} (#${id}).`);
      } catch (e) {
        await send(chat, '⚠️ ' + e.message);
      }
    } else {
      clearPending(from);
      await send(chat, 'Cancelled.');
    }
    return;
  }

  const parts = msg.text.trim().split(/\s+/);
  const cmdRaw = parts[0].toLowerCase().replace(/^\//, '').split('@')[0];
  const cmd = (cmdRaw === 'reset' || cmdRaw === 'factory') && parts.length === 1 ? cmdRaw.toUpperCase() : cmdRaw;
  try {
    const out = await runCommand(from, cmd, parts.slice(1), chat);
    await send(chat, out.text, out.keyboard);
  } catch (e) {
    await send(chat, '⚠️ ' + e.message);
  }
}

export async function setupAdminBot(baseUrl) {
  if (!TOKEN) { console.log('[admin_bot] ADMIN_BOT_TOKEN not set'); return; }
  const secret = process.env.ADMIN_WEBHOOK_SECRET || '';
  if (!secret) { console.warn('[admin_bot] ADMIN_WEBHOOK_SECRET missing — webhook will fail closed'); return; }
  if (!baseUrl) { console.log('[admin_bot] no base url'); return; }
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: baseUrl.replace(/\/$/, '') + '/api/admin/webhook',
        allowed_updates: ['message', 'callback_query'],
        secret_token: secret
      })
    });
    console.log('[admin_bot] webhook set');
  } catch (e) { console.error('[admin_bot] setup', e.message); }
}