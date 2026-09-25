/* =====================================================================
   TRIBES — Icon system.
   Usage:
     <span data-icon="res-ember"></span>                 → auto-hydrates
     renderIcon('war-swords', { class:'ico-lg' })        → returns SVG node
   Stroke width is 1.63 by default (iOS sweet spot).
===================================================================== */
(function(){
'use strict';

const SPRITE = '/assets/icons.svg';
const CACHE = new Map();   // name -> symbol node (parsed once)
let SPRITE_LOADED = false;
let HYDRATE_OBSERVER = null;

/* ---------- sprite loader (fetch + inline so <use> works cross-origin safe) ---------- */
async function loadSprite(){
  if (SPRITE_LOADED) return;
  try {
    const r = await fetch(SPRITE);
    const text = await r.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = doc.querySelector('svg');
    if (!root) return;
    // inject defs + symbols once
    const host = document.createElement('div');
    host.id = 'tribes-icon-sprite';
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    host.innerHTML = root.innerHTML;
    document.body.insertBefore(host, document.body.firstChild);
    // cache symbol nodes
    host.querySelectorAll('symbol').forEach(sym => CACHE.set(sym.id, sym.cloneNode(true)));
    SPRITE_LOADED = true;
    hydrateAll();
  } catch(e){ console.warn('[icons] sprite load failed', e); }
}

/* ---------- single icon SVG builder ---------- */
function buildSvg(name, opts){
  opts = opts || {};
  const sym = CACHE.get(name);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const cls = ['ico'];
  if (opts.class) cls.push(...String(opts.class).split(/\s+/));
  svg.setAttribute('class', cls.join(' '));
  if (opts.size){
    svg.style.width = opts.size + 'px';
    svg.style.height = opts.size + 'px';
  }
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', SPRITE + '#' + name);
  use.setAttribute('href', SPRITE + '#' + name);
  svg.appendChild(use);
  if (!sym) console.warn('[icons] unknown symbol:', name);
  return svg;
}

/* ---------- public ---------- */
function renderIcon(name, opts){
  return buildSvg(name, opts);
}

function hydrate(el){
  const targets = el.querySelectorAll
    ? el.querySelectorAll('[data-icon]:not([data-icon-done])')
    : [];
  targets.forEach(node => {
    const name = node.getAttribute('data-icon');
    const size = node.getAttribute('data-icon-size');
    const cls  = node.getAttribute('data-icon-class') || '';
    node.setAttribute('data-icon-done', '1');
    node.appendChild(buildSvg(name, { size: size ? Number(size) : null, class: cls }));
  });
}

function hydrateAll(){ hydrate(document.body || document.documentElement); }

/* ---------- auto-hydrate on DOM mutation (for SPA) ---------- */
function startObserver(){
  if (HYDRATE_OBSERVER) return;
  HYDRATE_OBSERVER = new MutationObserver(muts => {
    for (const m of muts){
      for (const n of m.addedNodes){
        if (n.nodeType === 1){
          if (n.hasAttribute && n.hasAttribute('data-icon')) hydrate(n.parentNode || document.body);
          hydrate(n);
        }
      }
    }
  });
  HYDRATE_OBSERVER.observe(document.body, { childList:true, subtree:true });
}

/* ---------- boot ---------- */
if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', () => { loadSprite(); startObserver(); });
} else {
  loadSprite(); startObserver();
}

/* ---------- expose ---------- */
window.renderIcon = renderIcon;
window.hydrateIcons = hydrateAll;

})();