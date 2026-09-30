// TRIBES-FILE: web/src/games/reflexEngine.js
// PHASE: 4 — Rise of the Eternal Flame
//
// Framework-agnostic HTML5 <canvas> engine for the Ember Reflex duel/drill.
// This is PLAIN vanilla JS with ZERO framework imports on purpose: the same
// class is mounted by the React wrapper (games/CanvasReflex.jsx) AND by the
// standalone vanilla page (web/vanilla/reflex.html) — that is the "hybrid".
//
// It draws an animated molten-forge target on a real 2D canvas, measures the
// player's reaction time each round, and reports the raw times + a local
// preview score. The SERVER is still authoritative — the raw times array is
// what gets sent up so the (Python/Node) scorer decides the real result.

const PALETTE = {
  bg0: '#0b0708', bg1: '#1a0d06',
  ring: '#3a2413', gold: '#f5b840',
  live: '#ff7a1a', liveGlow: '#ffd07a',
  wait: '#5a3418', text: '#ffe9c9', dim: '#a97e57',
};

// Reference scoring formula (kept identical in the Python service + Node
// fallback). Exported so callers can show a matching preview.
export function reflexScoreLocal(times) {
  const arr = (Array.isArray(times) ? times : [])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.max(0, Math.min(100, Math.round(120 - (avg - 200) / 6)));
}

export class ReflexEngine {
  constructor(canvas, opts = {}) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.rounds = opts.rounds || 5;
    this.onScore = opts.onScore || (() => {});
    this.onProgress = opts.onProgress || (() => {});
    this.haptic = opts.haptic || (() => {});

    this.state = 'idle';        // idle | wait | live | done
    this.round = 0;
    this.times = [];
    this.liveAt = 0;
    this.flash = 0;             // 0..1 strike flash
    this.pulse = 0;            // live pulse phase
    this._raf = 0;
    this._timer = 0;
    this._t0 = performance.now();

    this._onDown = this._tap.bind(this);
    this._onResize = this._resize.bind(this);
  }

  start() {
    this._resize();
    window.addEventListener('resize', this._onResize);
    this.c.addEventListener('pointerdown', this._onDown);
    this._loop();
  }

  destroy() {
    cancelAnimationFrame(this._raf);
    clearTimeout(this._timer);
    window.removeEventListener('resize', this._onResize);
    this.c.removeEventListener('pointerdown', this._onDown);
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const r = this.c.getBoundingClientRect();
    const w = Math.max(200, r.width || 280);
    const h = Math.max(180, r.height || 220);
    this.c.width = Math.round(w * dpr);
    this.c.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = w; this.h = h;
  }

  _schedule() {
    this.state = 'wait';
    const delay = 700 + Math.random() * 1500;
    this._timer = setTimeout(() => {
      this.liveAt = performance.now();
      this.state = 'live';
      this.pulse = 0;
    }, delay);
  }

  _record(rt) {
    this.times.push(rt);
    this.round += 1;
    this.flash = 1;
    this.onProgress(this.round, this.rounds, rt);
    if (this.round >= this.rounds) {
      this.state = 'done';
      const score = reflexScoreLocal(this.times);
      setTimeout(() => this.onScore(score, this.times.slice()), 420);
    } else {
      this.state = 'idle';
      setTimeout(() => this._schedule(), 380);
    }
  }

  _tap() {
    if (this.state === 'done') return;
    if (this.state === 'idle') { this._schedule(); return; }
    if (this.state === 'wait') {          // too early — penalty
      clearTimeout(this._timer);
      this.haptic('bad');
      this._record(1000);
      return;
    }
    if (this.state === 'live') {
      this.haptic('light');
      this._record(performance.now() - this.liveAt);
    }
  }

  _label() {
    if (this.state === 'idle') return this.round === 0 ? 'TAP TO START' : 'READY\u2026';
    if (this.state === 'wait') return 'WAIT\u2026';
    if (this.state === 'live') return 'STRIKE!';
    return 'SCORING\u2026';
  }

  _loop() {
    const now = performance.now();
    const t = (now - this._t0) / 1000;
    if (this.state === 'live') this.pulse += 0.14;
    this.flash = Math.max(0, this.flash - 0.045);
    this._draw(t);
    this._raf = requestAnimationFrame(() => this._loop());
  }

  _draw(t) {
    const { ctx, w, h } = this;
    const cx = w / 2, cy = h / 2 - 6;
    const live = this.state === 'live';

    // molten background
    const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, Math.max(w, h) * 0.75);
    bg.addColorStop(0, live ? '#3a1c06' : PALETTE.bg1);
    bg.addColorStop(1, PALETTE.bg0);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // drifting ember sparks
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const sx = (i * 53 % w);
      const sy = (h - ((t * 24 + i * 40) % (h + 20)));
      const a = 0.10 + 0.10 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(255,150,60,${a})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.4 + (i % 3) * 0.5, 0, 7);
      ctx.fill();
    }
    ctx.restore();

    // target ring
    const base = Math.min(w, h) * 0.30;
    const rad = base + (live ? Math.sin(this.pulse) * 6 : 0);
    if (live) {
      const glow = ctx.createRadialGradient(cx, cy, rad * 0.4, cx, cy, rad * 1.9);
      glow.addColorStop(0, 'rgba(255,140,40,0.55)');
      glow.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = live ? PALETTE.live : PALETTE.ring;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();

    const disc = ctx.createRadialGradient(cx, cy - rad * 0.3, 4, cx, cy, rad);
    if (live) { disc.addColorStop(0, PALETTE.liveGlow); disc.addColorStop(1, PALETTE.live); }
    else if (this.state === 'wait') { disc.addColorStop(0, '#7a4a20'); disc.addColorStop(1, PALETTE.wait); }
    else { disc.addColorStop(0, '#2a1a10'); disc.addColorStop(1, '#160d08'); }
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(cx, cy, rad - 2, 0, Math.PI * 2); ctx.fill();

    // strike flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${this.flash * 0.8})`;
      ctx.beginPath(); ctx.arc(cx, cy, rad - 2, 0, Math.PI * 2); ctx.fill();
    }

    // label
    ctx.fillStyle = live ? '#2a1200' : PALETTE.text;
    ctx.font = `700 ${Math.round(base * 0.24)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._label(), cx, cy);

    // round pips
    const n = this.rounds;
    const gap = 16, pr = 5;
    const startX = cx - ((n - 1) * gap) / 2;
    const py = cy + rad + 22;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * gap, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = i < this.round ? PALETTE.gold : 'rgba(255,255,255,0.14)';
      ctx.fill();
    }
  }
}
