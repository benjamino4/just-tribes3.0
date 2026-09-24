// =====================================================================
// TRIBES — perf.js
// Small DOM helpers + device-tier detection.
// Exposes window.__tribes_perf.* for app.js to consume.
// If this script fails to load, app.js falls back to innerHTML rendering.
// =====================================================================
(function(){
'use strict';

/* ---------- element creation ---------- */
function h(tag, props, ...children){
  const el = document.createElement(tag);
  if (props){
    for (const k in props){
      if (k === 'class') el.className = props[k];
      else if (k === 'style' && typeof props[k] === 'object'){
        for (const sk in props[k]) el.style[sk] = props[k][sk];
      }
      else if (k === 'text') el.textContent = props[k];
      else if (k === 'html') el.innerHTML = props[k];
      else if (k.startsWith('on') && typeof props[k] === 'function'){
        el.addEventListener(k.slice(2).toLowerCase(), props[k]);
      }
      else if (k === 'dataset' && typeof props[k] === 'object'){
        for (const dk in props[k]) el.dataset[dk] = props[k][dk];
      }
      else el.setAttribute(k, props[k]);
    }
  }
  for (const c of children.flat()){
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c))
      : c);
  }
  return el;
}

/* ---------- attribute patching ---------- */
// Only sets properties that changed. Avoids reflow when nothing changed.
function patch(el, props){
  if (!el || !props) return;
  for (const k in props){
    const v = props[k];
    if (k === 'text'){
      if (el.textContent !== String(v)) el.textContent = String(v);
    } else if (k === 'class'){
      if (el.className !== v) el.className = v;
    } else if (k === 'style' && typeof v === 'object'){
      for (const sk in v){
        const cur = el.style[sk];
        const next = String(v[sk]);
        if (cur !== next) el.style[sk] = next;
      }
    } else if (k === 'html'){
      if (el.innerHTML !== v) el.innerHTML = v;
    } else if (k.startsWith('data-')){
      const dk = k.slice(5).replace(/-([a-z])/g, (_, c)=>c.toUpperCase());
      if (el.dataset[dk] !== String(v)) el.dataset[dk] = String(v);
    } else if (k.startsWith('on') && typeof v === 'function'){
      // listeners are attached once in h() and not patched
    } else {
      const cur = el.getAttribute(k);
      const next = String(v);
      if (cur !== next) el.setAttribute(k, next);
    }
  }
}

/* ---------- cheap text setter ---------- */
function setText(el, v){
  if (!el) return;
  const s = String(v);
  if (el.textContent !== s) el.textContent = s;
}

/* ---------- mount / unmount ---------- */
function mount(parent, node){
  if (!parent || !node) return;
  // Replace all children of parent with node in one operation.
  parent.replaceChildren(node);
}

function unmount(node){
  if (node && node.parentNode) node.parentNode.removeChild(node);
}

/* ---------- device tier detection ---------- */
function detectTier(){
  const override = localStorage.getItem('tribes.perf');
  if (override === 'high' || override === 'mid' || override === 'low') return override;

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'low';

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory || 0;

  if (isIOS) return (mem && mem <= 2) ? 'mid' : 'high';
  if (!isAndroid) return 'high';

  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  else if (cores <= 4) score -= 1;
  if (mem >= 6) score += 2;
  else if (mem >= 4) score += 1;
  else if (mem && mem <= 2) score -= 1;

  if (score >= 3) return 'high';
  if (score >= 0) return 'mid';
  return 'low';
}

function applyTier(tier){
  document.documentElement.setAttribute('data-perf', tier);
}

/* ---------- frame-time probe (downgrades only) ---------- */
function measureAndRefine(){
  let frames = 0, longFrames = 0;
  const start = performance.now();
  let last = start;
  function tick(now){
    const dt = now - last; last = now;
    frames++;
    if (dt > 22) longFrames++;
    if (now - start < 2000) requestAnimationFrame(tick);
    else {
      const avgFps = frames / ((now - start) / 1000);
      const longPct = longFrames / frames;
      const current = localStorage.getItem('tribes.perf.resolved') || detectTier();
      let next = current;
      if (avgFps < 30) next = 'low';
      else if ((avgFps < 42 || longPct > 0.25) && current === 'high') next = 'mid';
      if (next !== current){
        localStorage.setItem('tribes.perf.resolved', next);
        applyTier(next);
      }
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- FPS overlay (debug) ---------- */
function installFpsOverlay(){
  if (window.__tribesFpsBox) return;
  const box = document.createElement('div');
  box.id = 'tribes-fps';
  box.style.cssText = 'position:fixed;top:6px;right:6px;z-index:99999;background:rgba(0,0,0,.7);color:#ffcf7a;font:11px monospace;padding:4px 6px;border-radius:6px;pointer-events:none';
  document.body.appendChild(box);
  window.__tribesFpsBox = box;
  let last = performance.now(), frames = 0, acc = 0;
  function loop(now){
    const dt = now - last; last = now;
    frames++; acc += dt;
    if (acc >= 500){
      const fps = Math.round(frames * 1000 / acc);
      box.textContent = fps + ' fps';
      frames = 0; acc = 0;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

/* ---------- public API ---------- */
const api = {
  h, patch, setText, mount, unmount,
  detectTier, applyTier, measureAndRefine,
  installFpsOverlay,
};

window.__tribes_perf = api;

// install tier immediately so CSS can react on first paint
const initialTier = localStorage.getItem('tribes.perf.resolved') || detectTier();
applyTier(initialTier);

// expose dev toggles
window.__tribesSetPerf = function(mode){
  if (mode === 'auto'){ localStorage.removeItem('tribes.perf'); localStorage.removeItem('tribes.perf.resolved'); }
  else localStorage.setItem('tribes.perf', mode);
  location.reload();
};
Object.defineProperty(window, '__tribesFPS', {
  set(v){
    if (v) installFpsOverlay();
    else if (window.__tribesFpsBox){ window.__tribesFpsBox.remove(); window.__tribesFpsBox = null; }
  },
  get(){ return !!window.__tribesFpsBox; }
});

// run measurement once, after the app has had time to settle
setTimeout(measureAndRefine, 3000);
})();