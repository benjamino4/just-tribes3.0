// TRIBES-FILE: web/src/screens/Moot.jsx
// PHASE: 5 — Council & Kiva
// The Moot: the tribe's council. View the sitting council, call/close a
// Moot to elect kin into positions, vote for candidates, and feed the
// tribe Idol. Wired to /api/council/*. Authored to complete the deck —
// this screen was not present in the delivered phase files.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

export default function Moot() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState(50);

  async function load() {
    try {
      const s = await apiGet('/api/council/state');
      setState(s);
    } catch {
      setState({ available: true, in_tribe: false });
    }
  }
  useEffect(() => { load(); }, []);

  async function guard(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e) { toast(e?.message || 'The council resists.'); }
    finally { setBusy(false); }
  }

  const openMoot = () => guard(async () => {
    haptic('medium');
    await apiPost('/api/council/moot/open');
    toast('A Moot has been called.');
    await load();
  });

  const closeMoot = () => guard(async () => {
    haptic('medium');
    const r = await apiPost('/api/council/moot/close');
    toast(r?.message || 'The Moot is sealed.');
    await load();
    reload?.();
  });

  const vote = (candidateId, position) => guard(async () => {
    haptic('light');
    await apiPost('/api/council/moot/vote', { candidateId, position });
    toast('Your voice is counted.');
    await load();
  });

  const forge = () => guard(async () => {
    haptic('medium');
    const r = await apiPost('/api/council/idol/forge', { amount: Number(amount) || 0 });
    toast(r?.message || 'You feed the Idol.');
    await load();
    reload?.();
  });

  if (!tribe || (state && state.in_tribe === false)) {
    return (
      <motion.div className="col" style={{ gap: 12 }}
        variants={V.page} initial="initial" animate="animate" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <Icon name="crown" size={40} style={{ color: '#ffb54a' }} />
          <h2 className="display" style={{ fontSize: 20, marginTop: 8 }}>The Moot is empty</h2>
          <p className="tiny" style={{ opacity: 0.8 }}>
            Join a tribe before you can sit at its council fire.
          </p>
          <Button style={{ marginTop: 12 }} onClick={() => nav('/longhouse')}>Find a tribe</Button>
        </div>
      </motion.div>
    );
  }

  if (!state) {
    return <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>Summoning the council…</div>;
  }

  const moot = state.moot || {};
  const roles = state.roles || [];
  const idol = state.idol || {};
  const isLeader = !!state.is_leader;
  const mootOpen = moot.status === 'open' || moot.open === true;
  const candidates = moot.candidates || moot.slots || [];
  const forgePct = idol.forge_goal ? Math.min(100, Math.round((idol.forge_progress / idol.forge_goal) * 100)) : 0;

  return (
    <motion.div className="col" style={{ gap: 14 }}
      variants={V.page} initial="initial" animate="animate" transition={M.buoyant}>

      <div className="row between">
        <div className="col" style={{ gap: 1 }}>
          <h2 className="display" style={{ fontSize: 22 }}>The Moot</h2>
          <span className="tiny" style={{ opacity: 0.75 }}>{tribe.name} · council of {roles.length}/{state.slots_cap || '—'}</span>
        </div>
        <Icon name="crown" size={30} style={{ color: '#ffb54a' }} />
      </div>

      <Hint id="moot-intro">
        Elders call a Moot to seat kin into council positions. Every voice votes;
        the Chieftain seals the result. A strong council buffs the whole tribe.
      </Hint>

      {/* ---------- sitting council ---------- */}
      <div className="glass card col" style={{ gap: 10 }}>
        <b>Sitting council</b>
        {roles.length === 0 && <span className="tiny" style={{ opacity: 0.7 }}>No positions filled yet.</span>}
        {roles.map((r) => (
          <div key={r.user_id + '-' + r.position} className="row between">
            <div className="row" style={{ gap: 8 }}>
              <Icon name="user" size={20} />
              <div className="col" style={{ gap: 0 }}>
                <b>{r.name}</b>
                <span className="tiny" style={{ opacity: 0.7, textTransform: 'capitalize' }}>{r.position}</span>
              </div>
            </div>
            <span className="tiny" style={{ opacity: 0.8 }}>{fmt(r.renown)} renown</span>
          </div>
        ))}
      </div>

      {/* ---------- the moot ---------- */}
      <div className="glass card col" style={{ gap: 10 }}>
        <div className="row between">
          <b>{mootOpen ? 'Moot in session' : 'No Moot in session'}</b>
          {mootOpen && moot.closes_at && (
            <span className="tiny" style={{ opacity: 0.75 }}>closes {shortTime(new Date(moot.closes_at).getTime() - Date.now())}</span>
          )}
        </div>

        {mootOpen ? (
          <>
            {candidates.length === 0 && <span className="tiny" style={{ opacity: 0.7 }}>Awaiting nominees…</span>}
            {candidates.map((c) => (
              <div key={c.user_id || c.candidateId} className="row between">
                <div className="col" style={{ gap: 0 }}>
                  <b>{c.name || c.first_name || 'Kin'}</b>
                  <span className="tiny" style={{ opacity: 0.7 }}>{fmt(c.votes || 0)} votes</span>
                </div>
                <Button variant="ghost" disabled={busy}
                  onClick={() => vote(c.user_id || c.candidateId, c.position || 'warrior')}>
                  Vote
                </Button>
              </div>
            ))}
            {isLeader && (
              <Button variant="danger" disabled={busy} onClick={closeMoot} style={{ marginTop: 4 }}>
                Seal the Moot
              </Button>
            )}
          </>
        ) : (
          isLeader
            ? <Button disabled={busy} onClick={openMoot}>Call a Moot</Button>
            : <span className="tiny" style={{ opacity: 0.7 }}>Only the Chieftain or Elders can call a Moot.</span>
        )}
      </div>

      {/* ---------- the idol ---------- */}
      <div className="glass card col" style={{ gap: 10 }}>
        <div className="row between">
          <div className="col" style={{ gap: 0 }}>
            <b>{idol.name || 'Tribe Idol'}</b>
            <span className="tiny" style={{ opacity: 0.7, textTransform: 'capitalize' }}>
              tier {idol.tier || 0} · {idol.state || 'dormant'}
            </span>
          </div>
          <Icon name="ember" size={26} style={{ color: '#ff7a3c' }} />
        </div>

        <div className="bar" style={{ height: 8, borderRadius: 6, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: forgePct + '%', height: '100%', background: 'linear-gradient(90deg,#ff7a3c,#ffb54a)' }} />
        </div>
        <span className="tiny" style={{ opacity: 0.75 }}>
          {fmt(idol.forge_progress || 0)} / {fmt(idol.forge_goal || 0)} embers forged ({forgePct}%)
        </span>

        <div className="row" style={{ gap: 8 }}>
          <input
            type="number" min={1} value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Button disabled={busy} onClick={forge}>Feed the Idol</Button>
        </div>
      </div>

      <Button variant="ghost" onClick={() => nav('/longhouse')}>Back to the Longhouse</Button>
    </motion.div>
  );
}
