import { measureRefreshRate } from './refresh.js';

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

async function testCompositor(targetFps) {
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:100px;height:100px;pointer-events:none;';
  const boxes = Array.from({ length: 20 }, () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:absolute;width:20px;height:20px;background:#f00;will-change:transform;';
    container.appendChild(d);
    return d;
  });
  document.body.appendChild(container);

  let frames = 0, running = true;
  const start = performance.now();
  function tick() {
    if (!running) return;
    const t = performance.now() - start;
    for (let i = 0; i < boxes.length; i++) {
      boxes[i].style.transform = `translate3d(${Math.sin(t / 100 + i) * 50}px, ${Math.cos(t / 100 + i) * 50}px, 0)`;
    }
    frames++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 300));
  running = false;
  container.remove();
  const fps = frames / 0.3;
  return clamp(Math.round((fps / targetFps) * 100), 0, 100);
}

async function testCanvas(targetFps) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const canvas = document.createElement('canvas');
  canvas.width = 300 * dpr; canvas.height = 300 * dpr;
  canvas.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:300px;height:300px;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const particles = Array.from({ length: 100 }, () => ({
    x: Math.random() * 300, y: Math.random() * 300,
    vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
    r: 2 + Math.random() * 4
  }));
  let frames = 0, running = true;
  function tick() {
    if (!running) return;
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, 300, 300);
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > 300) p.vx *= -1;
      if (p.y < 0 || p.y > 300) p.vy *= -1;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grad.addColorStop(0, 'rgba(255,140,60,0.8)');
      grad.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2); ctx.fill();
    }
    frames++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 300));
  running = false;
  canvas.remove();
  const fps = frames / 0.3;
  const adjusted = Math.min(fps, targetFps) * (dpr / 1.5);
  return clamp(Math.round((adjusted / targetFps) * 100), 0, 100);
}

async function testMain(targetFps) {
  let frames = 0, running = true;
  function tick() {
    if (!running) return;
    const arr = new Array(500).fill(0).map(() => Math.random());
    arr.sort();
    let sum = 0;
    for (const x of arr) sum += x;
    frames++;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 300));
  running = false;
  const fps = frames / 0.3;
  return clamp(Math.round((fps / targetFps) * 100), 0, 100);
}

async function testSvg(targetFps) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:100px;height:100px;';
  for (let i = 0; i < 10; i++) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.style.cssText = 'width:24px;height:24px;animation:pulse 1s infinite;';
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '8');
    c.setAttribute('fill', '#ff8324');
    svg.appendChild(c);
    host.appendChild(svg);
  }
  const style = document.createElement('style');
  style.textContent = '@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}';
  document.head.appendChild(style);
  document.body.appendChild(host);
  let frames = 0, running = true;
  function tick() { if (!running) return; frames++; requestAnimationFrame(tick); }
  requestAnimationFrame(tick);
  await new Promise((r) => setTimeout(r, 300));
  running = false;
  host.remove();
  style.remove();
  const fps = frames / 0.3;
  return clamp(Math.round((fps / targetFps) * 100), 0, 100);
}

export async function runBenchmark(onProgress = () => {}) {
  const refresh = await measureRefreshRate(500);
  onProgress(0.1, 'compositor');
  const compositor = await testCompositor(refresh);
  onProgress(0.3, 'canvas');
  const canvas = await testCanvas(refresh);
  onProgress(0.6, 'main');
  const main = await testMain(refresh);
  onProgress(0.8, 'svg');
  const svg = await testSvg(refresh);
  onProgress(0.95, 'done');

  const finalScore = Math.min(compositor, canvas, main, svg);
  let tier = 'balanced';
  if (finalScore >= 90 && refresh >= 120) tier = 'ultra120';
  else if (finalScore >= 90) tier = 'ultra';
  else if (finalScore >= 75) tier = 'high';
  else if (finalScore >= 55) tier = 'balanced';
  else if (finalScore >= 40) tier = 'low';
  else tier = 'potato';

  return {
    tier, score: finalScore, refresh,
    tests: { compositor, canvas, main, svg },
    device: navigator.userAgent.slice(0, 120)
  };
}