import { getDPR } from './perf.js';

export class AdaptiveCanvas {
  constructor(canvas, targetFps = 60) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.targetFps = targetFps;
    this.frameBudget = 1000 / targetFps;
    this.maxDpr = getDPR();
    this.dpr = this.maxDpr;
    this._lastFrameStart = 0;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  checkFrame() {
    const now = performance.now();
    const delta = now - this._lastFrameStart;
    if (delta > this.frameBudget * 1.15 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.resize(this.w, this.h);
    } else if (delta < this.frameBudget * 0.7 && this.dpr < this.maxDpr) {
      this.dpr = Math.min(this.maxDpr, this.dpr + 0.1);
      this.resize(this.w, this.h);
    }
    this._lastFrameStart = now;
  }
}