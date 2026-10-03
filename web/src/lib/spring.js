// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/spring.js
// PURPOSE: iOS-calibrated spring physics. Interruptible. Uses shared rAF.
// DEPENDS ON: raf.js
// ═══════════════════════════════════════════════════════════════════
import { subscribe as rafSubscribe } from './raf.js';

export class Spring {
  constructor(value, opts = {}) {
    this.value = value;
    this.target = value;
    this.velocity = 0;
    this.stiffness = opts.stiffness ?? 180;
    this.damping = opts.damping ?? 22;
    this.mass = opts.mass ?? 1;
    this.precision = opts.precision ?? 0.005;
    this.onUpdate = opts.onUpdate || null;
    this._settled = true;
    this._lastT = 0;
    this._unsub = null;
  }

  setTarget(t) {
    this.target = t;
    this._settled = false;
    this._start();
  }

  setValue(v) {
    this.value = v;
    this.velocity = 0;
    this.onUpdate?.(v);
  }

  _start() {
    if (this._unsub) return;
    this._lastT = performance.now();
    this._unsub = rafSubscribe((now) => this._step(now));
  }

  _step(now) {
    const dt = Math.min(0.064, (now - this._lastT) / 1000);
    this._lastT = now;
    const force = -this.stiffness * (this.value - this.target);
    const damp = -this.damping * this.velocity;
    const accel = (force + damp) / this.mass;
    this.velocity += accel * dt;
    this.value += this.velocity * dt;
    if (Math.abs(this.velocity) < this.precision && Math.abs(this.value - this.target) < this.precision) {
      this.value = this.target;
      this.velocity = 0;
      this._settled = true;
      this.onUpdate?.(this.value);
      this._unsub?.();
      this._unsub = null;
      return;
    }
    this.onUpdate?.(this.value);
  }

  stop() {
    this._unsub?.();
    this._unsub = null;
  }
}

export const SPRING_PRESETS = {
  tap:         { stiffness: 400, damping: 30, mass: 1 },
  transition:  { stiffness: 220, damping: 26, mass: 1 },
  sheetOpen:   { stiffness: 180, damping: 24, mass: 1.2 },
  sheetClose:  { stiffness: 260, damping: 32, mass: 1 },
  numberTick:  { stiffness: 500, damping: 40, mass: 0.6 },
  firePulse:   { stiffness: 60,  damping: 12, mass: 1.5 },
  buoyant:     { stiffness: 320, damping: 30, mass: 1.1 },
  ember:       { stiffness: 180, damping: 22, mass: 1.4, precision: 0.001 }
};