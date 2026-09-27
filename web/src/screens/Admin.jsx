// TRIBES-FILE: web/src/screens/Admin.jsx
// PHASE: 7 — Meta & Admin
// In-app admin Control Room. Gated by /api/admin/whoami success.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionConfig, V } from '../lib/motion.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { fmt } from '../lib/format.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'players',   label: 'Players' },
  { id: 'bonfires',  label: 'Bonfires' },
  { id: 'xquests',   label: 'X Quests' },
  { id: 'config',    label: 'Config' },
  { id: 'danger',    label: 'Danger' },
];

export default function Admin() {
  const nav = useNavigate();
  const M = useMotionConfig();
  const [who, setWho] = useState(null);
  const [tab, setTab] = useState('overview');
  const [gate, setGate] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/admin/whoami');
        setWho(r.data || r);
        setGate(false);
      } catch {
        setGate(false);   // gate stays true → show unauthorized
      }
    })();
  }, []);

  if (gate) return null;

  if (!who) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 32 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Keepers Only</h2>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            You do not have access to the Control Room.
          </p>
          <Button variant="ghost" block onClick={() => nav(-1)}>Back</Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Control Room</h2>
          <Hint text="Everything you change here applies instantly to the live server." />
        </div>
        <span className="chip" style={{ color: 'var(--gold)' }}>
          <Icon name="crown" size={12} />
          {who.adminId}
        </span>
      </div>

      <div className="row" style={{ gap: 8, overflowX: 'auto', padding: '4px 0 8px' }}>
        {TABS.map((t) => (
          <button key={t.id}
            onClick={() => { haptic('select'); setTab(t.id); }}
            className="chip"
            style={{
              flex: '0 0 auto',
              borderColor: tab === t.id ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t.id ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t.id ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={M.buoyant}>
          {tab === 'overview'  && <Overview />}
          {tab === 'players'   && <Players />}
          {tab === 'bonfires'  && <Bonfires />}
          {tab === 'xquests'   && <XQuests />}
          {tab === 'config'    && <Config />}
          {tab === 'danger'    && <Danger />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------- Overview ---------- */
function Overview() {
  const [s, setS] = useState(null);
  useEffect(() => {
    (async () => { try {
      const r = await apiGet('/api/admin/stats');
      setS(r.data || r);
    } catch {} })();
  }, []);
  if (!s) return <p className="muted">Loading…</p>;
  return (
    <div className="glass card">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12,
      }}>
        {[
          ['Players', s.users.n, `${s.users.banned || 0} banned`],
          ['Ember', fmt(s.users.ember), ''],
          ['Tribes', s.tribes.n, `Pyre ${fmt(s.tribes.pyre)}`],
          ['Wars', s.wars.active, `${s.wars.total} all-time`],
          ['Stars tx', fmt(s.payments.starTx), `${fmt(s.payments.stars)} Stars`],
        ].map(([label, value, sub]) => (
          <div key={label} style={{
            padding: 12,
            background: 'rgba(0,0,0,.25)',
            borderRadius: 12,
            border: '1px solid var(--glass-brd)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--gold)', marginTop: 2 }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-dim)' }}>{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Players ---------- */
function Players() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  async function search() {
    try {
      const r = await apiGet('/api/admin/players?q=' + encodeURIComponent(q));
      setRows(r.data || r);
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function toggleBan(u) {
    const path = u.banned ? '/api/admin/unban' : '/api/admin/ban';
    try {
      await apiPost(path, { id: u.id, reason: u.banned ? '' : 'Admin action' });
      toast(u.banned ? 'Unbanned' : 'Banned', 'good');
      search();
    } catch (e) { toast(e.message, 'bad'); }
  }
  async function bless(u) {
    try {
      await apiPost('/api/admin/bless', { id: u.id, on: 'on' });
      toast('Blessed', 'good');
      search();
    } catch (e) { toast(e.message, 'bad'); }
  }
  return (
    <>
      <div className="glass card">
        <div className="row" style={{ gap: 8 }}>
          <input
            className="winput"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="name, @user, or id"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }}
          />
          <Button variant="primary" onClick={search}>Search</Button>
        </div>
      </div>
      <div className="glass card" style={{ marginTop: 8 }}>
        {rows.map((u) => (
          <div key={u.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--glass-brd)' }}>
            <div className="col" style={{ gap: 2 }}>
              <b style={{ fontSize: 14 }}>{u.first_name} <span style={{ color: 'var(--ink-dim)' }}>@{u.username || '?'}</span></b>
              <span className="tiny">#{u.id} · {u.role} · {fmt(u.ember)}E · {fmt(u.renown)}R {u.banned && '· BANNED'}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Button variant="ghost" onClick={() => bless(u)}>Bless</Button>
              <Button variant={u.banned ? 'primary' : 'ghost'} onClick={() => toggleBan(u)}>
                {u.banned ? 'Unban' : 'Ban'}
              </Button>
            </div>
          </div>
        ))}
        {!rows.length && <p className="muted">Search for players.</p>}
      </div>
    </>
  );
}

/* ---------- Bonfires ---------- */
function Bonfires() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ title: '', metric: 'ember', multiplier: 2, hours: 2 });
  async function load() {
    try { const r = await apiGet('/api/admin/bonfires'); setList(r.data || r); } catch {}
  }
  useEffect(() => { load(); }, []);
  async function create() {
    try {
      await apiPost('/api/admin/bonfires', {
        ...form,
        end_at: new Date(Date.now() + Number(form.hours) * 3600 * 1000),
      });
      toast('Bonfire lit', 'good');
      setForm({ ...form, title: '' });
      load();
    } catch (e) { toast(e.message, 'bad'); }
  }
  return (
    <>
      <div className="glass card">
        <b style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Light a bonfire</b>
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          <input placeholder="Title" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }} />
          <div className="row" style={{ gap: 8 }}>
            <select value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
              style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }}>
              {['ember','renown','ash','checkin','war'].map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <input type="number" min="1" max="10" value={form.multiplier}
              onChange={(e) => setForm({ ...form, multiplier: e.target.value })}
              style={{ width: 70, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }} />
            <input type="number" min="1" max="72" value={form.hours}
              onChange={(e) => setForm({ ...form, hours: e.target.value })}
              style={{ width: 70, padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }} />
            <Button variant="primary" onClick={create}>Light</Button>
          </div>
        </div>
      </div>

      <div className="glass card" style={{ marginTop: 8 }}>
        {list.map((b) => (
          <div key={b.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--glass-brd)' }}>
            <div className="col" style={{ gap: 1 }}>
              <b>{b.title}</b>
              <span className="tiny">{b.metric} ×{b.multiplier} · ends {new Date(b.end_at).toLocaleString()}</span>
            </div>
            <Button variant="ghost" onClick={async () => {
              await apiPost('/api/admin/bonfires/end', { id: b.id });
              load();
            }}>End</Button>
          </div>
        ))}
        {!list.length && <p className="muted">No bonfires yet.</p>}
      </div>
    </>
  );
}

/* ---------- X Quests ---------- */
function XQuests() {
  const [stats, setStats] = useState(null);
  const [claims, setClaims] = useState([]);
  async function load() {
    try {
      const [s, c] = await Promise.all([
        apiGet('/api/admin/x-stats'),
        apiGet('/api/admin/x-claims?status=pending'),
      ]);
      setStats(s.data || s);
      setClaims(c.data || c);
    } catch {}
  }
  useEffect(() => { load(); }, []);
  async function approve(id) {
    try { await apiPost('/api/admin/x-claims/approve', { id }); toast('Approved', 'good'); load(); }
    catch (e) { toast(e.message, 'bad'); }
  }
  async function reject(id) {
    const reason = prompt('Reason:');
    if (!reason) return;
    try { await apiPost('/api/admin/x-claims/reject', { id, reason }); toast('Rejected', 'bad'); load(); }
    catch (e) { toast(e.message, 'bad'); }
  }
  return (
    <>
      {stats && (
        <div className="glass card">
          <div className="row between">
            <div className="col"><span className="tiny">Pending</span><b>{stats.pending}</b></div>
            <div className="col"><span className="tiny">Approved</span><b>{stats.approved}</b></div>
            <div className="col"><span className="tiny">Rejected</span><b>{stats.rejected}</b></div>
            <div className="col"><span className="tiny">Linked handles</span><b>{stats.linked_handles}</b></div>
          </div>
        </div>
      )}
      <div className="glass card" style={{ marginTop: 8 }}>
        <b style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--ink-dim)' }}>Pending claims</b>
        {claims.map((c) => (
          <div key={c.id} className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--glass-brd)' }}>
            <div className="col" style={{ gap: 1 }}>
              <b>@{c.x_handle}</b>
              <span className="tiny">{c.quest_title} · {c.first_name || c.username}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Button variant="primary" onClick={() => approve(c.id)}>Approve</Button>
              <Button variant="ghost" onClick={() => reject(c.id)}>Reject</Button>
            </div>
          </div>
        ))}
        {!claims.length && <p className="muted">No pending claims.</p>}
      </div>
    </>
  );
}

/* ---------- Config ---------- */
function Config() {
  const [cfg, setCfg] = useState(null);
  const [filter, setFilter] = useState('');
  async function load() {
    try { const r = await apiGet('/api/admin/econ'); setCfg(r.data || r); } catch {}
  }
  useEffect(() => { load(); }, []);
  if (!cfg) return <p className="muted">Loading…</p>;
  const defs = cfg._defaults || {};
  const keys = Object.keys(defs).sort().filter((k) => k.includes(filter.toLowerCase()));
  return (
    <div className="glass card">
      <input placeholder="Filter keys…" value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 12, marginBottom: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }} />
      {keys.slice(0, 80).map((k) => (
        <div key={k} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid var(--glass-brd)' }}>
          <div className="col" style={{ gap: 1, flex: 1 }}>
            <b style={{ fontSize: 13 }}>{k.replace(/_/g, ' ')}</b>
            <span className="tiny">default: {String(defs[k]).slice(0, 40)}</span>
          </div>
          <input
            defaultValue={cfg[k]}
            onBlur={async (e) => {
              if (String(e.target.value) === String(cfg[k])) return;
              try {
                await apiPost('/api/admin/econ', { key: k, value: e.target.value });
                toast(`Set ${k}`, 'good');
                load();
              } catch (err) { toast(err.message, 'bad'); }
            }}
            style={{ width: 100, padding: '6px 8px', borderRadius: 8, background: 'rgba(0,0,0,.3)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', textAlign: 'right' }}
          />
        </div>
      ))}
    </div>
  );
}

/* ---------- Danger ---------- */
function Danger() {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const r = await apiPost('/api/admin/reset/preview', {});
        setPreview(r.data || r);
      } catch {}
    })();
  }, []);
  if (!preview) return <p className="muted">Loading…</p>;
  async function doReset(kind, word) {
    const typed = prompt(`Type ${word} to confirm ${kind} reset`);
    if (typed !== word) { toast('Cancelled', 'info'); return; }
    try {
      await apiPost(`/api/admin/reset/${kind}`, {});
      toast('Reset started', 'good');
    } catch (e) { toast(e.message, 'bad'); }
  }
  return (
    <>
      <div className="glass card" style={{ borderColor: 'rgba(192,57,43,.5)' }}>
        <h3 style={{ color: '#ff8a8a', marginBottom: 8 }}>Progression Reset</h3>
        <p className="tiny">Wipes free-currency progress, tribe membership, relics. Keeps accounts and Stars.</p>
        <pre style={{ fontSize: 11, color: '#ffcf7a', marginTop: 10 }}>
          Users: {preview.users} ({preview.usersWithProgress} with progress){'\n'}
          Tribes: {preview.tribes}{'\n'}
          Active wars: {preview.activeWars}
        </pre>
        <Button variant="ghost" block style={{ marginTop: 12 }} onClick={() => doReset('progression', 'RESET')}>
          Reset Progression
        </Button>
      </div>

      <div className="glass card" style={{ borderColor: 'rgba(192,57,43,.5)', marginTop: 8 }}>
        <h3 style={{ color: '#ff8a8a', marginBottom: 8 }}>Factory Reset</h3>
        <p className="tiny">Deletes everything except accounts. All content, wars, Kiva messages, payments.</p>
        <Button variant="ghost" block style={{ marginTop: 12 }} onClick={() => doReset('factory', 'FACTORY')}>
          Factory Reset
        </Button>
      </div>
    </>
  );
}