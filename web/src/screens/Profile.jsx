// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Profile.jsx
// PURPOSE: Profile + settings. Perf tier picker. Referral entry.
// DEPENDS ON: store, perf, Toggle
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';
import Toggle from '../components/Toggle.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import RankMedallion from '../components/RankMedallion.jsx';
import { getPerf, setTier } from '../lib/perf.js';

const KEY = 'tribes.settings';

function load() {
  try { return { animations: true, haptics: true, sound: false, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { animations: true, haptics: true, sound: false }; }
}

export default function Profile() {
  const nav = useNavigate();
  const { data } = useApp();
  const [s, setS] = useState(load());
  const [perf, setPerf] = useState(getPerf().tier);

  useEffect(() => {
    document.documentElement.setAttribute('data-fx', s.animations ? 'full' : 'reduced');
    window.__hapticsEnabled = s.haptics;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  }, [s]);

  function update(p) { setS((x) => ({ ...x, ...p })); }
  function changePerf(t) { setTier(t); setPerf(t); }

  const user = data?.user || {};

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Profile</h2>
        </div>
      </div>

      <div className="glass strong card">
        <div className="row" style={{ gap: 14 }}>
          <RankMedallion user={user} size={56} />
          <div className="grow">
            <h2 style={{ fontSize: 19 }}>@{user.username || 'wanderer'}</h2>
            <span className="tiny">{user.rank_tier?.title || user.role || 'Kin'}</span>
          </div>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <div className="col"><span className="tiny">Sparks</span><b>{fmt(user.sparks || 0)}</b></div>
          <div className="col"><span className="tiny">Kinship</span><b>{fmt(user.kinship || 0)}</b></div>
          <div className="col"><span className="tiny">Streak</span><b>{(user.streak || 0)}d</b></div>
        </div>
      </div>

      <div className="glass card">
        <b style={{ fontSize: 13, textTransform: 'uppercase' }}>Motion & Feel</b>
        <div className="col" style={{ gap: 14, marginTop: 14 }}>
          <Toggle label="Animations" hint="Fluid motion" on={s.animations} onChange={(v) => update({ animations: v })} />
          <Toggle label="Haptics" hint="Vibration feedback" on={s.haptics} onChange={(v) => update({ haptics: v })} tone="#7aa8c4" />
          <Toggle label="Sound" hint="Fire crackle and UI sounds" on={s.sound} onChange={(v) => update({ sound: v })} tone="#7fc9a7" />
        </div>
      </div>

      <div className="glass card">
        <b style={{ fontSize: 13, textTransform: 'uppercase' }}>Performance</b>
        <p className="tiny" style={{ marginTop: 6 }}>Current: <b>{perf}</b></p>
        <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {['ultra120', 'ultra', 'high', 'balanced', 'low', 'potato'].map((t) => (
            <button key={t}
              onClick={() => { haptic('select'); changePerf(t); }}
              className="chip"
              style={{
                borderColor: perf === t ? 'var(--ember-300)' : 'var(--glass-brd)',
                color: perf === t ? 'var(--ember-200)' : 'var(--ink-dim)'
              }}
            >{t}</button>
          ))}
        </div>
      </div>

      <Button variant="primary" block onClick={() => nav('/referral')}>
        <Icon name="gift" size={16} /> Referral Altar
      </Button>

      <Button variant="ghost" block onClick={() => nav('/help')}>
        <Icon name="info" size={16} /> Help & Rules
      </Button>
    </motion.div>
  );
}