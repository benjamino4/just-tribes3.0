import React, { useState } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button } from '../../components/UI.jsx';
import { toast } from '../../components/Toast.jsx';
import { haptic } from '../../lib/telegram.js';

const SEGMENTS = [
  { label: '50', tone: '#ff9f45' }, { label: '200', tone: '#c39bff' }, { label: '10', tone: '#7cc4ff' },
  { label: '500', tone: '#ffd27a' }, { label: '30', tone: '#5ce39a' }, { label: 'JACKPOT', tone: '#ff5a3c' },
  { label: '100', tone: '#ff9f45' }, { label: '5', tone: '#7cc4ff' },
];
const SEG = 360 / SEGMENTS.length;

export default function SpinPage() {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  function spin() {
    if (spinning) return;
    setSpinning(true); haptic('heavy');
    const idx = Math.floor(Math.random() * SEGMENTS.length);
    const target = 360 * 5 + (360 - idx * SEG - SEG / 2);
    setRot((r) => r - (r % 360) + target);
    setTimeout(() => { setSpinning(false); haptic('success'); toast(`You won ${SEGMENTS[idx].label} Ember!`, 'good'); }, 4200);
  }

  return (
    <SubPage title="Wheel of Ash" hint="One free spin daily. Land on a segment to win Ember — or hit the Jackpot. Extra spins can be bought with Stars.">
      <Card strong style={{ textAlign: 'center', overflow: 'hidden', paddingBottom: 24 }}>
        <div style={{ position: 'relative', width: 250, height: 250, margin: '10px auto 0' }}>
          <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: '11px solid transparent', borderRight: '11px solid transparent', borderTop: '20px solid var(--gold)' }} />
          <motion.div animate={{ rotate: rot }} transition={{ duration: 4, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: 250, height: 250, borderRadius: '50%', position: 'relative', boxShadow: 'var(--sh-3), inset 0 0 0 6px rgba(255,255,255,.08)', background: `conic-gradient(${SEGMENTS.map((s, i) => `${s.tone} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(',')})` }}>
            {SEGMENTS.map((s, i) => (
              <span key={i} style={{ position: 'absolute', left: '50%', top: '50%', transformOrigin: '0 0', transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-96px)`, color: '#2a1200', fontWeight: 800, fontSize: s.label === 'JACKPOT' ? 9 : 13 }}>{s.label}</span>
            ))}
            <span style={{ position: 'absolute', inset: '42%', borderRadius: '50%', background: 'var(--bg-1)', border: '3px solid rgba(255,255,255,.15)' }} />
          </motion.div>
        </div>
        <Button variant="primary" size="lg" block style={{ marginTop: 20 }} onClick={spin} disabled={spinning}>{spinning ? 'Spinning…' : 'Free Spin'}</Button>
      </Card>
      <Button variant="ghost" block>Buy 5 spins · 100 ⭐</Button>
    </SubPage>
  );
}
