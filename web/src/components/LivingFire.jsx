import { useEffect, useRef } from 'react';

export function fireStateFor(streak) {
  const s = Number(streak) || 0;
  if (s <= 0)   return { stage: 0, color: '#5a6675', core: '#3a4452', embers: 0 };
  if (s < 3)    return { stage: 1, color: '#a85420', core: '#d46f2c', embers: 3 };
  if (s < 7)    return { stage: 2, color: '#d46f2c', core: '#f7a259', embers: 5 };
  if (s < 14)   return { stage: 3, color: '#f7a259', core: '#ffc78a', embers: 8 };
  if (s < 30)   return { stage: 4, color: '#ffc78a', core: '#ffe7c2', embers: 12 };
  if (s < 60)   return { stage: 5, color: '#ffe7c2', core: '#fff4d6', embers: 16 };
  if (s < 100)  return { stage: 6, color: '#ffd27a', core: '#ffe9b8', embers: 22 };
  return             { stage: 7, color: '#ffe9b8', core: '#ffffff', embers: 30 };
}

export default function LivingFire({ streak = 0 }) {
  const canvasRef = useRef(null);
  const state = fireStateFor(streak);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = 240;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles = [];
    for (let i = 0; i < state.embers; i++) {
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

    let running = true;
    let raf;
    function tick() {
      if (!running) return;
      ctx.clearRect(0, 0, size, size);
      const bg = ctx.createRadialGradient(size / 2, size * 0.8, 10, size / 2, size * 0.8, size * 0.7);
      if (state.stage > 0) {
        bg.addColorStop(0, state.core + '55');
        bg.addColorStop(0.4, state.color + '33');
        bg.addColorStop(1, 'transparent');
      } else {
        bg.addColorStop(0, '#2e292044');
        bg.addColorStop(1, 'transparent');
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, size, size);

      ctx.save();
      ctx.translate(size / 2, size - 40);
      ctx.fillStyle = '#3c2718';
      ctx.fillRect(-40, 0, 80, 12);
      ctx.restore();

      if (state.stage > 0) {
        const t = performance.now() / 400;
        const flameCount = Math.min(6, 2 + state.stage);
        for (let i = 0; i < flameCount; i++) {
          const base = Math.min(size, 60 + i * 8);
          const h = base + Math.sin(t + i) * 6;
          const grad = ctx.createLinearGradient(size / 2, size - 40, size / 2, size - 40 - h);
          grad.addColorStop(0, state.color);
          grad.addColorStop(0.5, state.core);
          grad.addColorStop(1, state.core + '00');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(size / 2 - 18 - i * 2, size - 40);
          ctx.quadraticCurveTo(size / 2 - 10 - i, size - 40 - h, size / 2, size - 40 - h - 10);
          ctx.quadraticCurveTo(size / 2 + 10 + i, size - 40 - h, size / 2 + 18 + i * 2, size - 40);
          ctx.closePath();
          ctx.fill();
        }
      }

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
        ctx.fillStyle = state.core + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [streak]);

  return (
    <div style={{ position: 'relative', width: 240, height: 240, margin: '0 auto' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}