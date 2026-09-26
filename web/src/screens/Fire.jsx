import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Campfire from '../components/Campfire.jsx';
import AnimatedIcon from '../components/AnimatedIcon.jsx';
import Icon from '../components/Icon.jsx';
import Hint from '../components/Hint.jsx';
import Shape, { RADII } from '../components/Shape.jsx';
import { Card, Button } from '../components/UI.jsx';
import { useGame } from '../store.js';
import { useConfig } from '../lib/config.js';
import { api } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { fmt, timeLeft } from '../lib/format.js';
import { haptic } from '../lib/telegram.js';

const HERO_RADII = {
  blob: '46% 54% 42% 58% / 55% 45% 55% 45%',
  circle: '50%', curved: '40px', shield: '32px 32px 46% 46% / 32px 32px 60% 60%',
};

export default function Fire() {
  const nav = useNavigate();
  const { data, act } = useGame();
  const cfg = useConfig((s) => s.cfg).home;
  const user = data?.user || {};
  const daily = data?.daily || [];
  const bonfire = data?.bonfire;
  const war = data?.war;
  const checkedIn = daily.find((d) => d.id === 'checkin')?.done;
  const streak = user.streak || 0;

  async function feedFire() {
    if (checkedIn) { toast('Already fed today', 'info'); return; }
    try { await act(() => api.checkin()); }
    catch (e) {
      const d = useGame.getState().data;
      useGame.getState().patch({ user: { ...d.user, streak: streak + 1, ember: (d.user.ember || 0) + 120 }, daily: d.daily.map((x) => x.id === 'checkin' ? { ...x, done: true } : x) });
    }
    toast('The fire roars. Streak +1', 'good');
  }

  const sections = (cfg.sections || []).filter((s) => s.on);

  return (
    <div className="col" style={{ gap: 4 }}>
      {bonfire?.active && (
        <motion.div className="glass" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(255,180,100,.4)' }}>
          <AnimatedIcon name="bolt" size={22} tone="var(--gold)" />
          <div className="grow"><b style={{ fontSize: 14 }}>{bonfire.title}</b><div className="tiny">x{bonfire.multiplier} · ends in {timeLeft(bonfire.ends_in_ms)}</div></div>
        </motion.div>
      )}

      {/* Campfire hero with an admin-configurable shape */}
      <Shape kind="soft" className="card" style={{ paddingTop: 10, textAlign: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, right: 12 }}><Hint text="Your Home Fire tracks your daily streak. Feed it every day to earn Ember and climb milestone rewards." /></div>
        <motion.div style={{ width: 210, height: 210, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: HERO_RADII[cfg.heroShape] || '40px', background: 'radial-gradient(circle at 50% 62%, rgba(255,122,24,.18), transparent 68%)' }}
          animate={{ borderRadius: cfg.heroShape === 'blob' ? ['46% 54% 42% 58% / 55% 45% 55% 45%', '58% 42% 55% 45% / 45% 58% 42% 55%', '46% 54% 42% 58% / 55% 45% 55% 45%'] : (HERO_RADII[cfg.heroShape] || '40px') }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}>
          <Campfire streak={streak} lit />
        </motion.div>
        <h2 className="display" style={{ fontSize: 22, marginTop: 2 }}>The Home Fire</h2>
        <p className="tiny" style={{ margin: '4px 0 14px' }}>Streak · <b style={{ color: 'var(--ember-200)' }}>{streak} days</b></p>
        <Button variant="primary" size="lg" block onClick={feedFire} disabled={checkedIn} haptic="heavy">
          <Icon name="fire" size={20} />{checkedIn ? 'Fire fed today' : 'Feed the Fire  ·  +120'}
        </Button>
      </Shape>

      {/* War strip */}
      {war?.active && (
        <Shape kind="curved" className="card" onClick={() => nav('/tribe/war')} style={{ cursor: 'pointer' }}>
          <div className="row between">
            <div className="row"><AnimatedIcon name="bolt" size={26} tone="var(--ember-400)" /><div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>War vs {war.opponent}</b><span className="tiny">{fmt(war.attacker_score)} – {fmt(war.defender_score)} · {timeLeft(war.ends_in_ms)} left</span></div></div>
            <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
          </div>
        </Shape>
      )}

      {/* Section grid — each tile is its own page, admin-configurable */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {sections.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 26 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('medium'); nav('/home/' + s.id); }}
            className="glass"
            style={{ padding: 16, textAlign: 'left', borderRadius: RADII[s.shape] || 'var(--r-lg)', minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', gridColumn: sections.length % 2 === 1 && i === sections.length - 1 ? '1 / -1' : 'auto' }}
          >
            <div style={{ alignSelf: s.shape === 'circle' ? 'center' : 'flex-start' }}><AnimatedIcon name={s.icon} size={38} tone={cfg.accent} /></div>
            <div className="row between" style={{ width: '100%' }}>
              <b style={{ fontSize: 15 }}>{s.name}</b>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
