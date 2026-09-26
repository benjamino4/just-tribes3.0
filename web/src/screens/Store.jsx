import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import AnimatedIcon from '../components/AnimatedIcon.jsx';
import { Card, SectionHeader, Button, ProgressBar } from '../components/UI.jsx';
import { toast } from '../components/Toast.jsx';
import { fmt } from '../lib/format.js';
import { useConfig } from '../lib/config.js';
import { haptic } from '../lib/telegram.js';

const PACKS = [
  { stars: 100, bonus: '', price: '100 ⭐' },
  { stars: 550, bonus: '+10%', price: '500 ⭐' },
  { stars: 1200, bonus: '+20%', price: '1000 ⭐' },
];
const TOOLS = [
  { name: 'Torch', desc: 'Ash pools 2x faster for 24h', price: 150, icon: 'fire' },
  { name: 'Totem', desc: '+15% loyalty for a week', price: 300, icon: 'tribe' },
  { name: 'Eternal Flame', desc: 'Auto-collect ash while away', price: 900, icon: 'spark' },
];
const RELICS = [
  { name: 'Emberheart', tier: 'Legendary', tone: '#ffb03a' },
  { name: 'Ashfang', tier: 'Epic', tone: '#c39bff' },
  { name: 'Stone Sigil', tier: 'Rare', tone: '#7cc4ff' },
];

export default function Store() {
  const nav = useNavigate();
  const packs = useConfig((s) => s.cfg.packs);
  return (
    <div className="col" style={{ gap: 4 }}>
      {/* Battle pass */}
      <Card strong style={{ overflow: 'hidden' }}>
        <div className="row between">
          <div><h2 className="display" style={{ fontSize: 20 }}>Path of Fire</h2><span className="tiny">Season pass · Tier 12 / 40</span></div>
          <span className="chip" style={{ color: 'var(--gold)' }}><Icon name="crown" size={14} style={{ color: 'var(--gold)' }} /> Premium</span>
        </div>
        <div style={{ margin: '12px 0' }}><ProgressBar value={12} max={40} /></div>
        <Button variant="primary" block onClick={() => toast('Path of Fire coming next', 'info')}>Unlock Premium Track</Button>
      </Card>

      <SectionHeader>Star Packs</SectionHeader>
      <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
        {PACKS.map((p, i) => (
          <motion.div key={i} whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            <Card style={{ textAlign: 'center', padding: 14, height: '100%' }}>
              <Icon name="spark" size={22} style={{ color: 'var(--gold)' }} />
              <b className="tabular" style={{ display: 'block', fontSize: 18, margin: '6px 0 0' }}>{fmt(p.stars)}</b>
              {p.bonus && <span className="tiny" style={{ color: 'var(--good)' }}>{p.bonus}</span>}
              <Button variant="ghost" block style={{ marginTop: 8 }} onClick={() => toast('Opening Telegram invoice…', 'info')}>{p.price}</Button>
            </Card>
          </motion.div>
        ))}
      </div>

      <SectionHeader>Tools</SectionHeader>
      {TOOLS.map((t) => (
        <Card key={t.name}>
          <div className="row between">
            <div className="row">
              <span className="crest-art"><Icon name={t.icon} size={18} style={{ color: '#2a1200' }} /></span>
              <div className="col" style={{ gap: 1 }}><b style={{ fontSize: 14 }}>{t.name}</b><span className="tiny">{t.desc}</span></div>
            </div>
            <Button variant="ghost" onClick={() => toast(`${t.name} equipped`, 'good')}>{fmt(t.price)}</Button>
          </div>
        </Card>
      ))}

      <SectionHeader>Relic Packs</SectionHeader>
      <div className="row" style={{ gap: 10, alignItems: 'stretch' }}>
        {packs.map((p) => (
          <motion.div key={p.id} whileTap={{ scale: 0.96 }} style={{ flex: 1 }} onClick={() => { haptic('medium'); nav('/store/pack/' + p.id); }}>
            <Card style={{ textAlign: 'center', padding: 14, height: '100%', cursor: 'pointer', borderColor: p.glow + '55' }}>
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }} style={{ width: 46, height: 46, margin: '0 auto 8px', borderRadius: 14, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 25%, ${p.glow}, #2a1200)`, boxShadow: `0 6px 18px ${p.glow}66` }}>
                <AnimatedIcon name="flame" size={26} tone="#fff" />
              </motion.div>
              <b style={{ fontSize: 13, display: 'block' }}>{p.name}</b>
              <span className="tiny" style={{ color: 'var(--gold)' }}>{p.price} ⭐</span>
            </Card>
          </motion.div>
        ))}
      </div>

      <SectionHeader>Relic NFTs</SectionHeader>
      <div className="row" style={{ gap: 10 }}>
        {RELICS.map((r) => (
          <motion.div key={r.name} whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            <Card style={{ textAlign: 'center', padding: 14, borderColor: r.tone + '55' }}>
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }} style={{ width: 40, height: 40, margin: '0 auto 6px', borderRadius: 12, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 25%, ${r.tone}, #2a1200)`, boxShadow: `0 6px 18px ${r.tone}55` }}>
                <Icon name="bolt" size={20} style={{ color: '#fff' }} />
              </motion.div>
              <b style={{ fontSize: 13 }}>{r.name}</b>
              <span className="tiny" style={{ display: 'block', color: r.tone }}>{r.tier}</span>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card style={{ textAlign: 'center', marginTop: 4 }}>
        <span className="tiny">Connect a TON wallet to mint relics and claim your <b style={{ color: 'var(--ember-200)' }}>airdrop</b>.</span>
        <Button variant="ghost" block style={{ marginTop: 10 }} onClick={() => toast('TON Connect coming next', 'info')}>Connect Wallet</Button>
      </Card>
    </div>
  );
}
