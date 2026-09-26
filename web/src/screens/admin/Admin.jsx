import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { haptic } from '../../lib/telegram.js';
import UsersTab from './UsersTab.jsx';
import EconomyTab from './EconomyTab.jsx';
import PacksTab from './PacksTab.jsx';
import KivaTab from './KivaTab.jsx';
import LayoutTab from './LayoutTab.jsx';

const PIN = '1136'; // demo gate — in production this is a server-side role check
const TABS = [
  { id: 'users',   label: 'Users',   cmp: UsersTab },
  { id: 'economy', label: 'Economy', cmp: EconomyTab },
  { id: 'packs',   label: 'Packs',   cmp: PacksTab },
  { id: 'kiva',    label: 'Kiva',    cmp: KivaTab },
  { id: 'layout',  label: 'Home',    cmp: LayoutTab },
];

export default function Admin() {
  const [ok, setOk] = useState(false);
  const [pin, setPin] = useState('');
  const [tab, setTab] = useState('users');

  if (!ok) {
    return (
      <SubPage title="Control Room" hint="Restricted area. In production this gate is a server-side keeper check tied to your Telegram ID — the PIN here is only for the demo.">
        <Card strong style={{ textAlign: 'center', padding: 28 }}>
          <AnimatedIcon name="shield" size={64} tone="#ffd27a" />
          <h2 className="display" style={{ fontSize: 20, marginTop: 10 }}>Keepers only</h2>
          <p className="tiny" style={{ margin: '6px 0 16px' }}>Enter the keeper PIN to open the control room.</p>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" placeholder="••••" type="password"
            style={{ width: 140, textAlign: 'center', letterSpacing: '.4em', fontSize: 20, padding: '12px', borderRadius: 14, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', margin: '0 auto 14px', display: 'block' }} />
          <Button variant="primary" block onClick={() => { if (pin === PIN) { haptic('success'); setOk(true); } else { haptic('error'); setPin(''); } }}>Unlock</Button>
          <p className="tiny" style={{ marginTop: 10, color: 'var(--ink-faint)' }}>Demo PIN: 1136</p>
        </Card>
      </SubPage>
    );
  }

  const Active = TABS.find((t) => t.id === tab).cmp;
  return (
    <SubPage title="Control Room" hint="Every change here is live instantly for the demo (saved on-device). In production these write to the server config and sync to all players.">
      <div className="admin-tabs">
        {TABS.map((t) => (
          <motion.button key={t.id} whileTap={{ scale: 0.94 }} onClick={() => { haptic('select'); setTab(t.id); }}
            className="chip" style={{ borderColor: tab === t.id ? 'var(--ember-400)' : 'var(--glass-brd)', color: tab === t.id ? 'var(--ember-200)' : 'var(--ink-dim)', background: tab === t.id ? 'rgba(255,122,24,.14)' : 'rgba(255,255,255,.04)' }}>{t.label}</motion.button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          <Active />
        </motion.div>
      </AnimatePresence>
    </SubPage>
  );
}
