// TRIBES-FILE: web/src/screens/Settlement.jsx
// PHASE: 8 — Payments + Polish
// The settlement — buildings and stage progression.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, SECTION_MOTION, staggerParent } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

export default function Settlement() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [state, setState] = useState(null);

  async function load() {
    try { setState(await apiGet('/api/settlement')); }
    catch (e) { toast(e.message || 'Could not load settlement', 'bad'); }
  }
  useEffect(() => { load(); }, [tribe?.id]);

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>No settlement yet</h2>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 14 }}>
            Join a tribe to raise your settlement.
          </p>
          <Button variant="primary" block onClick={() => nav('/longhouse')}>Find a Tribe</Button>
        </div>
      </motion.div>
    );
  }

  async function upgrade(buildingId) {
    try {
      const r = await apiPost('/api/settlement/upgrade', { buildingId });
      toast(`${buildingId} → Lv ${r.level}`, 'good');
      load();
      reload();
    } catch (e) {
      if (e.data?.need) toast(`Need ${fmt(e.data.need)} in the Pyre`, 'bad');
      else toast(e.message || 'Could not upgrade', 'bad');
    }
  }

  if (!state) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  const buildings = state.buildings || [];

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>Settlement</h2>
          <Hint text="Buildings passively improve your tribe. Each upgrade spends the tribe's Pyre. Elders+ can upgrade." />
        </div>
      </div>

      <div className="glass hero card" style={{ textAlign: 'center', padding: 22 }}>
        <span className="tiny">Current stage</span>
        <h2 className="display" style={{ fontSize: 26, margin: '2px 0 10px' }}>{state.stage}</h2>
        <div className="row between" style={{ padding: '0 6px', marginBottom: 6 }}>
          {['Band','Camp','Village','Settlement','Stronghold','Fortress','Domain','Realm','Empire','Kingdom'].map((s, i) => (
            <div key={s} className="col center" style={{ gap: 4, flex: 1 }}>
              <motion.span
                animate={{ scale: i === (state.tribe_level || 1) - 1 ? [1, 1.12, 1] : 1 }}
                transition={{ duration: 2, repeat: i === (state.tribe_level || 1) - 1 ? (M.drift.repeat || 0) : 0 }}
                style={{
                  width: 10, height: 10, borderRadius: 99,
                  background: i < state.tribe_level
                    ? 'var(--ember-500)'
                    : 'rgba(255,255,255,.15)',
                }}
              />
            </div>
          ))}
        </div>
        <span className="tiny">Members cap {state.cap || '?'}</span>
      </div>

      <div className="sec-h">
        <h3>Buildings</h3>
        <span className="line" />
      </div>

      <motion.div variants={staggerParent(0.06)} initial="initial" animate="animate">
        {buildings.map((b, i) => (
          <motion.div key={b.id} variants={V.item} style={{ marginTop: 8 }}>
            <div className="glass card">
              <div className="row between">
                <div className="row" style={{ flex: 1 }}>
                  <span className="crest-art" style={{ background: 'linear-gradient(180deg,#4a4038,#241f1a)' }}>
                    <Icon name={b.icon} size={18} style={{ color: 'var(--ember-200)' }} />
                  </span>
                  <div className="col" style={{ gap: 1, flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{b.name} · Lv {b.level}</b>
                    <span className="tiny">{b.desc}</span>
                    <span className="tiny" style={{ color: 'var(--gold)' }}>{b.effect}</span>
                  </div>
                </div>
                {b.cost == null ? (
                  <span className="chip" style={{ color: 'var(--good)' }}>Max</span>
                ) : (
                  <Button variant="primary" onClick={() => upgrade(b.id)}>
                    {fmt(b.cost)}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}