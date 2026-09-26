import React from 'react';
import { motion } from 'framer-motion';
import Icon from '../components/Icon.jsx';
import { Card, SectionHeader, Button, ProgressBar } from '../components/UI.jsx';
import { toast } from '../components/Toast.jsx';
import { fmt } from '../lib/format.js';

const TIERS = ['Village', 'Town', 'Dynasty', 'Empire', 'Kingdom'];
const UPGRADES = [
  { key: 'hearth', name: 'Hearth', desc: 'Ash pools faster', lvl: 3, cost: 4200, icon: 'fire' },
  { key: 'well', name: 'Well', desc: 'Bigger Ember cap', lvl: 2, cost: 6800, icon: 'ash' },
  { key: 'watch', name: 'Watchtower', desc: 'Scout enemy tribes', lvl: 1, cost: 9000, icon: 'ranks' },
  { key: 'forge', name: 'Forge', desc: 'Craft war relics', lvl: 1, cost: 12000, icon: 'bolt' },
];

export default function Lands() {
  const tier = 2; // Dynasty
  return (
    <div className="col" style={{ gap: 4 }}>
      <Card strong style={{ textAlign: 'center', overflow: 'hidden' }}>
        <span className="tiny">Your settlement</span>
        <h2 className="display" style={{ fontSize: 26, margin: '2px 0 12px' }}>{TIERS[tier]}</h2>
        <div className="row between" style={{ padding: '0 6px', marginBottom: 6 }}>
          {TIERS.map((t, i) => (
            <div key={t} className="col center" style={{ gap: 4, flex: 1 }}>
              <motion.span
                animate={{ scale: i === tier ? [1, 1.12, 1] : 1 }}
                transition={{ duration: 2, repeat: i === tier ? Infinity : 0 }}
                style={{ width: 12, height: 12, borderRadius: 99, background: i <= tier ? 'var(--ember-500)' : 'rgba(255,255,255,.15)', boxShadow: i <= tier ? '0 0 10px var(--ember-500)' : 'none' }}
              />
              <span className="tiny" style={{ fontSize: 9, color: i === tier ? 'var(--ink)' : 'var(--ink-faint)' }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ margin: '10px 6px 14px' }}><ProgressBar value={64} max={100} /></div>
        <Button variant="primary" block onClick={() => toast('Settlement grows toward Empire', 'good')}>
          Advance to {TIERS[tier + 1]}  ·  {fmt(45000)} Pyre
        </Button>
      </Card>

      <SectionHeader>Tribe Buildings</SectionHeader>
      {UPGRADES.map((u, i) => (
        <motion.div key={u.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
          <Card>
            <div className="row between">
              <div className="row">
                <span className="crest-art" style={{ background: 'linear-gradient(180deg,#4a4038,#241f1a)' }}><Icon name={u.icon} size={18} style={{ color: 'var(--ember-200)' }} /></span>
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 14 }}>{u.name} · Lv {u.lvl}</b>
                  <span className="tiny">{u.desc}</span>
                </div>
              </div>
              <Button variant="ghost" onClick={() => toast(`${u.name} upgraded to Lv ${u.lvl + 1}`, 'good')}>{fmt(u.cost)}</Button>
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
