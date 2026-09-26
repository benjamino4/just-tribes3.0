import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SubPage from '../components/SubPage.jsx';
import { Card, Button } from '../components/UI.jsx';
import Toggle from '../components/Toggle.jsx';
import AnimatedIcon from '../components/AnimatedIcon.jsx';
import { useSettings } from '../lib/settings.js';
import { useGame } from '../store.js';
import { fmt } from '../lib/format.js';

export default function Profile() {
  const nav = useNavigate();
  const s = useSettings();
  const user = useGame((g) => g.data?.user) || {};

  return (
    <SubPage title="Profile" hint="Your keeper profile and app settings. Turn animations off for a calmer, battery-friendly experience — the whole app respects it.">
      <Card strong>
        <div className="row" style={{ gap: 14 }}>
          <motion.span className="crest-art" style={{ width: 56, height: 56 }} animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 4, repeat: Infinity }}>
            <AnimatedIcon name="flame" size={30} tone="#2a1200" />
          </motion.span>
          <div className="grow"><h2 style={{ fontSize: 19 }}>@{user.username || 'wanderer'}</h2><span className="tiny">{user.role || 'Wanderer'} · {fmt(user.loyalty || 0)} loyalty</span></div>
        </div>
        <div className="row between" style={{ marginTop: 14 }}>
          <div className="col"><span className="tiny">Ember</span><b className="tabular">{fmt(user.ember || 0)}</b></div>
          <div className="col"><span className="tiny">Stars</span><b className="tabular">{fmt(user.stars || 0)}</b></div>
          <div className="col"><span className="tiny">Streak</span><b className="tabular">{user.streak || 0}d</b></div>
        </div>
      </Card>

      <Card>
        <b style={{ fontSize: 13, letterSpacing: '.04em', color: 'var(--ink-dim)', textTransform: 'uppercase' }}>Motion & Feel</b>
        <div className="col" style={{ gap: 14, marginTop: 14 }}>
          <Toggle label="Animations" hint="Fluid motion across the app" on={s.animations} onChange={(v) => s.set({ animations: v })} />
          <Toggle label="Haptics" hint="Vibration feedback on taps" on={s.haptics} onChange={(v) => s.set({ haptics: v })} tone="#7cc4ff" />
          <Toggle label="Sound" hint="Ambient fire & UI sounds" on={s.sound} onChange={(v) => s.set({ sound: v })} tone="#5ce39a" />
          <Toggle label="Data saver" hint="Lighter effects on slow networks" on={s.reducedData} onChange={(v) => s.set({ reducedData: v })} tone="#c39bff" />
        </div>
      </Card>

      <Card>
        <div className="row between">
          <div className="row"><AnimatedIcon name="shield" size={30} tone="#ffd27a" /><div className="col" style={{ gap: 1 }}><b>Admin Control Room</b><span className="tiny">Keepers only</span></div></div>
          <Button variant="ghost" onClick={() => nav('/admin')}>Open</Button>
        </div>
      </Card>
    </SubPage>
  );
}
