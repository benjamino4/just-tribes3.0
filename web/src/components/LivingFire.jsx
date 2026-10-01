import { useMemo, useEffect, useRef, useState } from 'react';
import { useApp } from '../lib/store.jsx';
import { subscribe as rafSubscribe } from '../lib/raf.js';
import { getDPR, isStatic } from '../lib/perf.js';

export function fireStateFor(streak) {
  const s = Number(streak) || 0;
  if (s <= 0)   return { stage: 0, size: 130, flames: 0,  embers: 0,  colour: '#4a4235', core: '#2e2920', label: 'cold' };
  if (s < 3)    return { stage: 1, size: 165, flames: 2,  embers: 3,  colour: '#8f3402', core: '#cc4f05', label: 'flicker' };
  if (s < 7)    return { stage: 2, size: 185, flames: 3,  embers: 5,  colour: '#cc4f05', core: '#f26a10', label: 'warm' };
  if (s < 14)   return { stage: 3, size: 205, flames: 4,  embers: 8,  colour: '#f26a10', core: '#ff8324', label: 'bright' };
  if (s < 30)   return { stage: 4, size: 225, flames: 5,  embers: 12, colour: '#ff8324', core: '#ffc37f', label: 'hot' };
  if (s < 60)   return { stage: 5, size: 245, flames: 6,  embers: 16, colour: '#ffc37f', core: '#ffe2a1', label: 'white' };
  if (s < 100)  return { stage: 6, size: 265, flames: 8,  embers: 22, colour: '#ffc37f', core: '#fff3d0', label: 'gold' };
  return             { stage: 7, size: 300, flames: 10, embers: 30, colour: '#efc168', core: '#fff3d0', label: 'eternal' };
}

export default function LivingFire({ streak = 0, extended = false }) {
  const { data } = useApp();
  const canvasRef = useRef(null);
  const [state] = useState(() => fireStateFor(streak));
  const warActive = !!data?.war?.war;
  const liveRef = useRef(state);
  liveRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (isStatic()) return;

    let raf;
    let running = true;
    const ctx = canvas.getContext('2d');
    const dpr = getDPR();
    const size = 260;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = [];
    const emberCount = liveRef.current.embers;
    for (let i = 0; i < emberCount; i++) {
      particles.push({
        x: size / 2 + (Math.random() - 0.5) * 80,
        y: size - 40,
        vy: -0.3 - Math.random() * 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        life: Math.random() * 120,
        max: 140 + Math.random() * 80,
        r: 1 + Math.random() * 1.6
      });
    }

    function tick() {
      if (!running) return;
      const s = liveRef.current;
      ctx.clearRect(0, 0, size, size);

      // Background glow
      const bg = ctx.createRadialGradient(size / 2, size * 0.8, 10, size / 2, size * 0.8, size * 0.7);
      if (s.stage > 0) {
        bg.addColorStop(0, s.core + '55');
        bg.addColorStop(0.4, s.colour + '33');
        bg.addColorStop(1, 'transparent');
      } else {
        bg.addColorStop(0, '#2e292044');
        bg.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      // Logs
      ctx.save();
      ctx.translate(size / 2, size - 40);
      ctx.fillStyle = '#3c2718';
      ctx.fillRect(-40, 0, 80, 12);
      ctx.restore();

      // Flames
      if (s.stage > 0) {
        const t = performance.now() / 400;
        for (let i = 0; i < s.flames; i++) {
          const base = Math.min(size, 60 + i * 8);
          const h = base + Math.sin(t + i) * 6;
          const grad = ctx.createLinearGradient(size / 2, size - 40, size / 2, size - 40 - h);
          grad.addColorStop(0, s.colour);
          grad.addColorStop(0.5, s.core);
          grad.addColorStop(1, s.core + '00');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(size / 2 - 18 - i * 2, size - 40);
          ctx.quadraticCurveTo(size / 2 - 10 - i, size - 40 - h, size / 2, size - 40 - h - 10);
          ctx.quadraticCurveTo(size / 2 + 10 + i, size - 40 - h, size / 2 + 18 + i * 2, size - 40);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Embers
      if (s.stage > 0) {
        for (const p of particles) {
          p.life += 1;
          p.y += p.vy;
          p.x += p.vx;
          if (p.life > p.max || p.y < size - 200) {
            p.x = size / 2 + (Math.random() - 0.5) * 80;
            p.y = size - 40;
            p.life = 0;
          }
          const alpha = Math.max(0, 1 - p.life / p.max);
          ctx.fillStyle = s.core + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [streak, warActive]);

  return (
    <div
      className="living-fire"
      style={{
        position: 'relative', width: 200, height: 200,
        display: 'grid', placeItems: 'center', margin: '4px auto 0',
        transform: `scale(${extended ? 1.55 : 1})`,
        transformOrigin: 'center top',
        transition: 'transform .45s cubic-bezier(.34,1.32,.56,1)'
      }}
    >
      <canvas ref={canvasRef} style={{ position: 'relative', zIndex: 2 }} />
    </div>
  );
}