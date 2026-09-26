import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { toast } from '../../components/Toast.jsx';
import { useConfig } from '../../lib/config.js';
import { haptic } from '../../lib/telegram.js';

const RARITY_TONE = { Common: '#9fb0c4', Rare: '#7cc4ff', Epic: '#c39bff', Legendary: '#ffd27a', Cursed: '#8b5cf6' };

function roll(rates) {
  const total = Object.values(rates).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, v] of Object.entries(rates)) { if ((r -= v) <= 0) return k; }
  return Object.keys(rates)[0];
}

export default function PackOpen() {
  const { id } = useParams();
  const nav = useNavigate();
  const cfg = useConfig((s) => s.cfg);
  const pack = cfg.packs.find((p) => p.id === id) || cfg.packs[0];
  const [phase, setPhase] = useState('idle'); // idle | shaking | revealed
  const [result, setResult] = useState(null);

  function open() {
    if (phase === 'shaking') return;
    haptic('heavy'); setPhase('shaking');
    const rarity = roll(pack.rates);
    const pool = cfg.relics.filter((r) => r.rarity === rarity);
    const relic = pool[Math.floor(Math.random() * pool.length)] || cfg.relics[0];
    setTimeout(() => { setResult({ rarity, relic }); setPhase('revealed'); haptic('success'); toast(`${rarity} relic!`, rarity === 'Cursed' ? 'error' : 'good'); }, 1600);
  }

  const tone = result ? RARITY_TONE[result.rarity] : pack.glow;

  return (
    <SubPage title={pack.name} hint="Open a relic pack for a chance at Blessed or Cursed relics. Rarer relics give bigger buffs. Drop rates are shown below and are set by tribe admins.">
      <Card strong style={{ textAlign: 'center', overflow: 'hidden', paddingTop: 30, paddingBottom: 30, position: 'relative' }}>
        <motion.div animate={{ opacity: phase === 'revealed' ? 0.9 : 0.3 }} style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 45%, ${tone}44, transparent 65%)` }} />
        <div style={{ position: 'relative', height: 190, display: 'grid', placeItems: 'center' }}>
          <AnimatePresence mode="wait">
            {phase !== 'revealed' ? (
              <motion.div key="box" exit={{ scale: 0, opacity: 0 }}
                animate={phase === 'shaking' ? { rotate: [-6, 6, -6, 6, 0], scale: [1, 1.08, 1] } : { y: [0, -8, 0] }}
                transition={phase === 'shaking' ? { duration: 1.5 } : { duration: 2.5, repeat: Infinity }}
                style={{ width: 120, height: 120, borderRadius: 26, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 35% 25%, ${pack.glow}, #2a1200)`, boxShadow: `0 12px 40px ${pack.glow}66` }}>
                <AnimatedIcon name="flame" size={60} tone="#fff" />
              </motion.div>
            ) : (
              <motion.div key="relic" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="col center" style={{ gap: 10 }}>
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.4, repeat: Infinity }}
                  style={{ width: 100, height: 100, borderRadius: 24, display: 'grid', placeItems: 'center', background: `radial-gradient(circle at 30% 25%, ${tone}, #2a1200)`, boxShadow: `0 10px 36px ${tone}88` }}>
                  <AnimatedIcon name={result.relic.glyph} size={54} tone="#fff" />
                </motion.div>
                <span className="chip" style={{ color: tone, borderColor: tone + '66' }}>{result.rarity}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {phase === 'revealed' ? (
          <>
            <h2 className="display" style={{ fontSize: 22, marginTop: 6 }}>{result.relic.name}</h2>
            <p className="tiny" style={{ margin: '4px 0 16px', color: tone }}>{result.relic.buff}</p>
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" block onClick={() => { setPhase('idle'); setResult(null); }}>Open another</Button>
              <Button variant="primary" block onClick={() => nav('/store')}>Keep</Button>
            </div>
          </>
        ) : (
          <Button variant="primary" size="lg" block style={{ marginTop: 10 }} onClick={open} disabled={phase === 'shaking'} haptic="heavy">
            {phase === 'shaking' ? 'Opening…' : `Open · ${pack.price} ⭐`}
          </Button>
        )}
      </Card>

      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Drop rates</b>
        <div className="col" style={{ gap: 8, marginTop: 10 }}>
          {Object.entries(pack.rates).map(([k, v]) => (
            <div key={k} className="row between">
              <span className="row" style={{ gap: 8 }}><span style={{ width: 10, height: 10, borderRadius: 99, background: RARITY_TONE[k] }} />{k}</span>
              <b className="tabular" style={{ color: RARITY_TONE[k] }}>{v}%</b>
            </div>
          ))}
        </div>
      </Card>
    </SubPage>
  );
}
