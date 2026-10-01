import { useEffect, useRef, useState } from 'react';
import GameFrame from '../components/GameFrame.jsx';
import { haptic } from '../lib/haptics.js';
import { subscribe as rafSubscribe } from '../lib/raf.js';
import { getDPR, isStatic } from '../lib/perf.js';

export default function EmberReflex({ onDone, onExit, rounds = 5 }) {
  const canvasRef = useRef(null);
  const [times, setTimes] = useState([]);
  const stateRef = useRef({ phase: 'idle', round: 0, liveAt: 0, timerId: 0, times: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = getDPR();
    let w = 0, h = 0;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    let running = true;
    let flash = 0;

    function tick() {
      if (!running) return;
      const s = stateRef.current;
      if (s.phase === 'live') flash = 1;
      flash = Math.max(0, flash - 0.06);
      draw(s, flash);
      raf = requestAnimationFrame(tick);
    }

    function draw(s, flash) {
      const cx = w / 2, cy = h / 2 - 10;
      const live = s.phase === 'live';
      const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.75);
      bg.addColorStop(0, live ? '#3a1c06' : '#1a0d06');
      bg.addColorStop(1, '#0b0708');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < 16; i++) {
        const t = performance.now() / 1000;
        const sx = (i * 53) % w;
        const sy = h - ((t * 24 + i * 40) % (h + 20));
        const a = 0.1 + 0.1 * Math.sin(t * 2 + i);
        ctx.fillStyle = `rgba(255,150,60,${a})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.4 + (i % 3) * 0.5, 0, 7);
        ctx.fill();
      }

      const base = Math.min(w, h) * 0.3;
      const rad = base + (live ? Math.sin(performance.now() / 90) * 6 : 0);
      if (live) {
        const glow = ctx.createRadialGradient(cx, cy, rad * 0.4, cx, cy, rad * 1.9);
        glow.addColorStop(0, 'rgba(255,140,40,0.55)');
        glow.addColorStop(1, 'rgba(255,140,40,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = live ? '#ff7a1a' : '#3a2413';
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();

      const disc = ctx.createRadialGradient(cx, cy - rad * 0.3, 4, cx, cy, rad);
      if (live) { disc.addColorStop(0, '#ffd07a'); disc.addColorStop(1, '#ff7a1a'); }
      else if (s.phase === 'wait') { disc.addColorStop(0, '#7a4a20'); disc.addColorStop(1, '#5a3418'); }
      else { disc.addColorStop(0, '#2a1a10'); disc.addColorStop(1, '#160d08'); }
      ctx.fillStyle = disc;
      ctx.beginPath(); ctx.arc(cx, cy, rad - 2, 0, Math.PI * 2); ctx.fill();

      if (flash > 0) {
        ctx.fillStyle = `rgba(255,240,200,${flash * 0.8})`;
        ctx.beginPath(); ctx.arc(cx, cy, rad - 2, 0, Math.PI * 2); ctx.fill();
      }

      const label = s.phase === 'idle' ? (s.round === 0 ? 'TAP TO START' : 'READY…')
        : s.phase === 'wait' ? 'WAIT…' : s.phase === 'live' ? 'STRIKE!' : 'DONE';
      ctx.fillStyle = live ? '#2a1200' : '#ffe9c9';
      ctx.font = `700 ${Math.round(base * 0.24)}px system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, cx, cy);

      const gap = 16, pr = 5;
      const startX = cx - ((rounds - 1) * gap) / 2;
      const py = cy + rad + 22;
      for (let i = 0; i < rounds; i++) {
        ctx.beginPath();
        ctx.arc(startX + i * gap, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = i < s.round ? '#f5b840' : 'rgba(255,255,255,0.14)';
        ctx.fill();
      }
    }

    function schedule() {
      const s = stateRef.current;
      s.phase = 'wait';
      s.timerId = setTimeout(() => {
        s.phase = 'live';
        s.liveAt = performance.now();
      }, 700 + Math.random() * 1500);
    }

    function record(rt) {
      const s = stateRef.current;
      s.times.push(rt);
      s.round += 1;
      flash = 1;
      if (s.round >= rounds) {
        s.phase = 'done';
        const score = scoreTimes(s.times);
        setTimeout(() => onDone?.(score, { times: s.times.slice() }), 420);
      } else {
        s.phase = 'idle';
        setTimeout(schedule, 380);
      }
    }

    function tap() {
      const s = stateRef.current;
      if (s.phase === 'done') return;
      if (s.phase === 'idle') { schedule(); return; }
      if (s.phase === 'wait') {
        clearTimeout(s.timerId);
        haptic('medium');
        record(1000);
        return;
      }
      if (s.phase === 'live') {
        haptic('light');
        record(performance.now() - s.liveAt);
      }
    }

    canvas.addEventListener('pointerdown', tap);
    raf = requestAnimationFrame(tick);
    setReady(true);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(stateRef.current.timerId);
      canvas.removeEventListener('pointerdown', tap);
      window.removeEventListener('resize', resize);
    };
  }, [rounds, onDone]);

  return (
    <GameFrame title="Ember Reflex" onExit={onExit} material="ember">
      <canvas ref={canvasRef} className="game-canvas" />
      <p className="tiny" style={{ marginTop: 12, textAlign: 'center' }}>
        Tap the fire the moment it lights.
      </p>
    </GameFrame>
  );
}

function scoreTimes(times) {
  const arr = times.filter((n) => Number.isFinite(n) && n > 0);
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.max(0, Math.min(100, Math.round(120 - (avg - 200) / 6)));
}