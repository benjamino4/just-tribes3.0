import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '../../components/UI.jsx';
import Icon from '../../components/Icon.jsx';
import Toggle from '../../components/Toggle.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { useConfig } from '../../lib/config.js';
import { haptic } from '../../lib/telegram.js';

const SHAPES = ['blob', 'circle', 'curved', 'shield'];
const PREVIEW = { blob: '46% 54% 42% 58% / 55% 45% 55% 45%', circle: '50%', curved: '14px', shield: '10px 10px 46% 46% / 10px 10px 60% 60%' };

export default function LayoutTab() {
  const cfg = useConfig((s) => s.cfg);
  const update = useConfig((s) => s.update);

  const move = (i, dir) => update((c) => {
    const arr = c.home.sections; const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  });

  return (
    <div className="col" style={{ gap: 8 }}>
      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Home fire shape</b>
        <div className="row" style={{ gap: 10, marginTop: 12 }}>
          {SHAPES.map((s) => (
            <motion.button key={s} whileTap={{ scale: 0.92 }} onClick={() => { haptic('select'); update((c) => { c.home.heroShape = s; }); }}
              className="col center" style={{ flex: 1, gap: 6, background: 'none' }}>
              <span style={{ width: 46, height: 46, borderRadius: PREVIEW[s], background: cfg.home.heroShape === s ? `radial-gradient(circle at 35% 30%, var(--ember-400), var(--ember-700))` : 'rgba(255,255,255,.08)', border: cfg.home.heroShape === s ? '2px solid var(--ember-300)' : '1px solid var(--glass-brd)' }} />
              <span className="tiny" style={{ textTransform: 'capitalize' }}>{s}</span>
            </motion.button>
          ))}
        </div>
      </Card>

      <Card>
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Home sections</b>
        <div className="col" style={{ gap: 10, marginTop: 12 }}>
          {cfg.home.sections.map((s, i) => (
            <div key={s.id} className="row between">
              <div className="row" style={{ gap: 8 }}>
                <AnimatedIcon name={s.icon} size={26} tone={cfg.home.accent} />
                <b style={{ fontSize: 14 }}>{s.name}</b>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="chip" style={{ padding: 7 }} onClick={() => { haptic('light'); move(i, -1); }} disabled={i === 0} aria-label="Up"><Icon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} /></button>
                <button className="chip" style={{ padding: 7 }} onClick={() => { haptic('light'); move(i, 1); }} disabled={i === cfg.home.sections.length - 1} aria-label="Down"><Icon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} /></button>
                <Toggle on={s.on} onChange={(v) => update((c) => { c.home.sections[i].on = v; })} />
              </div>
            </div>
          ))}
        </div>
      </Card>
      <p className="tiny" style={{ color: 'var(--ink-faint)', padding: '2px 2px' }}>Reorder or hide the tiles that appear on the Home Fire screen. Changes show instantly.</p>
    </div>
  );
}
