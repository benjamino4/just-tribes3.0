/* =====================================================================
   TRIBES — Mini App client. Ash & Bone redesign.
   Part 1 of 3: foundation, boot, onboarding, Ember Row navigation.
   Parts 2 and 3 follow in the next message(s); concatenate in order.
===================================================================== */
'use strict';

/* ---------- error surface ---------- */
window.addEventListener('error', function(e){
  const b = document.getElementById('bootMsg');
  if (b && b.style.display !== 'none') b.textContent = 'Error: ' + (e.message || 'unknown');
});

/* ---------- Telegram SDK ---------- */
const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try{
  if (TG){
    TG.ready(); TG.expand();
    TG.setHeaderColor && TG.setHeaderColor('#0a0908');
    TG.setBackgroundColor && TG.setBackgroundColor('#0a0908');
    TG.enableClosingConfirmation && TG.enableClosingConfirmation();
  }
}catch(e){}

/* ---------- primitives ---------- */
const $  = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const el = (t,c,h) => { const n = document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n; };
const fmt = n => { n = Number(n)||0; return n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':Math.floor(n).toLocaleString(); };
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const haptic = (t='light') => { try{ TG && TG.HapticFeedback && TG.HapticFeedback.impactOccurred(t); }catch(e){} };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const PERF = window.__tribes_perf || null;
const TIER = () => (document.documentElement.getAttribute('data-tier') || 'mid');

/* ---------- toast ---------- */
function toast(msg, kind='', ico){
  ico = ico || (kind==='good'?'✓':kind==='bad'?'✕':kind==='warn'?'!':'✦');
  const t = el('div','toast '+kind, '<span class="t-ico">'+ico+'</span><span>'+esc(msg)+'</span>');
  const root = $('#toastRoot'); if (!root) return;
  root.appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(), 320); }, 2600);
}

/* ---------- fx ---------- */
const fxRoot = () => $('#fxRoot');
function fxPop(text, x, y){
  const p = el('div','fx-pop', esc(text));
  p.style.left = x+'px'; p.style.top = y+'px';
  const r = fxRoot(); if (!r) return;
  r.appendChild(p);
  setTimeout(()=>p.remove(), 1000);
}
function burstEmbers(x, y, count=14, spread=110){
  const r = fxRoot(); if (!r) return;
  for (let i=0;i<count;i++){
    const a = (Math.PI*2) * (i/count) + (Math.random()*.5);
    const dist = spread * (0.55 + Math.random()*0.6);
    const dx = Math.cos(a)*dist, dy = Math.sin(a)*dist - 20;
    const e = el('div','fx-ember');
    e.style.left = (x-3)+'px'; e.style.top = (y-3)+'px';
    e.style.width = (4 + Math.random()*5)+'px';
    e.style.height = e.style.width;
    e.style.transition = 'transform 900ms cubic-bezier(.15,.75,.3,1), opacity 900ms ease-out';
    r.appendChild(e);
    requestAnimationFrame(()=>{ e.style.transform = 'translate('+dx+'px,'+dy+'px) scale(.3)'; e.style.opacity = '0'; });
    setTimeout(()=>e.remove(), 1100);
  }
}
function burstAt(node, count=14){
  if (!node) return;
  const r = node.getBoundingClientRect();
  burstEmbers(r.left+r.width/2, r.top+r.height/2, count);
}
function fxPopAt(node, text){
  if (!node) return;
  const r = node.getBoundingClientRect();
  fxPop(text, r.left+r.width/2, r.top+r.height/2);
}
function animateCounter(node, to, dur=520){
  if (!node) return;
  const from = Number(node.dataset.v || node.textContent.replace(/[^\d.-]/g,'')) || 0;
  to = Number(to) || 0;
  if (from === to){ node.dataset.v = to; node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const k = clamp((now-t0)/dur, 0, 1);
    const e = 1 - Math.pow(1-k, 3);
    const v = Math.round(from + (to-from)*e);
    node.textContent = fmt(v);
    if (k < 1) requestAnimationFrame(step);
    else { node.dataset.v = to; node.textContent = fmt(to); }
  };
  requestAnimationFrame(step);
}

/* ---------- guest ---------- */
let GUEST = localStorage.getItem('tribes.guest');
if (!GUEST){ GUEST = 'g' + String(Math.floor(Math.random()*9e9)+1e9); localStorage.setItem('tribes.guest', GUEST); }

/* ---------- API ---------- */
async function api(path, body, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if (TG && TG.initData) headers['X-Init-Data'] = TG.initData;
  headers['X-Guest-Id'] = GUEST;
  const READ_PATHS = new Set(['/state','/health','/war','/war/chronicle','/war/leaderboard','/tribes','/tribe/names','/kiva','/bonfire','/cosmetics','/trials']);
  const pathOnly = path.split('?')[0];
  const m = opts.method || (body !== undefined ? 'POST' : (READ_PATHS.has(pathOnly) ? 'GET' : 'POST'));
  const r = await fetch('/api'+path, {
    method: m,
    headers,
    body: m === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch(e){}
  if (!r.ok){
    const err = new Error(j.error || ('HTTP '+r.status));
    err.status = r.status; err.data = j;
    throw err;
  }
  return j;
}

/* ---------- SVG art (legacy, still used by non-nav icons) ---------- */
const ART = {
  totem:'<svg viewBox="0 0 60 80"><rect x="20" y="8" width="20" height="64" rx="6" fill="#5a3a24"/><circle cx="30" cy="24" r="8" fill="url(#gGold)"/><circle cx="27" cy="23" r="1.6" fill="#2a1408"/><circle cx="33" cy="23" r="1.6" fill="#2a1408"/><path d="M22 44h16M22 56h16" stroke="#ffd77a" stroke-width="3"/></svg>',
  flame:'<svg viewBox="0 0 60 80"><path d="M30 6c8 18-12 22-12 38a12 12 0 0 0 24 0c0-8-4-12-12-38z" fill="url(#gFlame)"/><circle cx="30" cy="48" r="7" fill="#fff6d6"/></svg>',
  sun:'<svg viewBox="0 0 60 80"><circle cx="30" cy="40" r="15" fill="url(#gGold)"/></svg>',
  moon:'<svg viewBox="0 0 60 80"><path d="M38 12a24 24 0 1 0 0 56 20 20 0 0 1 0-56z" fill="#dfe6ff"/></svg>',
  idol:'<svg viewBox="0 0 60 80"><rect x="20" y="20" width="20" height="52" rx="8" fill="#d8c39a"/><circle cx="30" cy="18" r="11" fill="#e8d7b5"/></svg>',
};
function artSvg(k){ return ART[k] || ART.totem; }

/* ---------- global state ---------- */
let S = null, TAB = 'home';
const RANK_KEY = 'tribes.nav.order';
const NAV_POOL = [
  { id:'home',     label:'Home',    ico:'nav-home',   filled:'nav-home-f' },
  { id:'fire',     label:'Fire',    ico:'nav-fire',   filled:'nav-fire-f' },
  { id:'trials',   label:'Trials',  ico:'chronicle',  filled:'chronicle' },
  { id:'war',      label:'War',     ico:'nav-war',    filled:'nav-war-f' },
  { id:'ranks',    label:'Ranks',   ico:'nav-ranks',  filled:'nav-ranks-f' },
  { id:'store',    label:'Store',   ico:'nav-store',  filled:'nav-store-f' },
  { id:'tribe',    label:'Tribe',   ico:'tribe',      filled:'tribe' },
  { id:'kiva',     label:'Kiva',    ico:'kiva',       filled:'kiva' },
  { id:'profile',  label:'Profile', ico:'profile',    filled:'profile' },
];

/* =====================================================================
   TON Connect
===================================================================== */
let tonUI = null, tonAddr = null;
function initTon(){
  try{
    const NS = window.TON_CONNECT_UI;
    if (!NS) return;
    tonUI = new NS.TonConnectUI({ manifestUrl: location.origin + '/tonconnect-manifest.json' });
    tonUI.onStatusChange(async w => {
      tonAddr = (w && w.account) ? w.account.address : null;
      updateTonChip();
      if (tonAddr){ try{ await api('/ton/link', { address: tonAddr }); }catch(e){} }
    });
    const acc = tonUI.account;
    if (acc){ tonAddr = acc.address; updateTonChip(); }
  }catch(e){ console.warn('TON init', e); }
}
function updateTonChip(){
  const b = $('#tonBtn'); if (!b) return;
  if (tonAddr){ b.classList.add('on'); b.textContent = '◈ ' + tonAddr.slice(0,4) + '…' + tonAddr.slice(-3); }
  else { b.classList.remove('on'); b.textContent = 'Connect'; }
}

/* =====================================================================
   Boot + onboarding
===================================================================== */
function setBoot(msg, retry){
  const b = $('#bootMsg'); if (b) b.textContent = msg;
  const rb = $('#retryBtn'); if (rb) rb.style.display = retry ? 'inline-flex' : 'none';
}

function hasOnboarded(){
  return localStorage.getItem('tribes.onboarded') === '1';
}

async function boot(){
  setBoot('loading');
  try{ await api('/health'); }catch(e){}
  try{ S = await api('/state'); }
  catch(e){
    if (e.status===401 && e.data && e.data.error==='no_username'){ showUsernameGate(); return; }
    if (e.status===401){ setBoot('Open TRIBES inside Telegram to gather at the fire.', true); return; }
    if (e.status===503){ setBoot('The elders are tending the fire — try again soon.', true); return; }
    if (e.status===403 && e.data && e.data.error==='banned'){ setBoot('You were banished: '+(e.data.reason||''), false); return; }
    setBoot('The fire could not be reached — ' + (e.message || 'try again.'), true); return;
  }
   try { initTon(); applyPalette(); }
  catch(err){ setBoot('A: ' + (err && err.message ? err.message : String(err))); console.error(err); return; }
  try { renderAll(); }
  catch(err){ setBoot('B: ' + (err && err.message ? err.message : String(err))); console.error(err); return; }
  await playBootThenShow();
}

async function playBootThenShow(){
  // Act 1 (0-400ms): pure black + "loading"
  const bootEl = $('#boot');
  if (bootEl) {
    bootEl.style.background = '#000';
    setBoot('loading');
  }
  await sleep(400);

  // Act 2 (400-1400ms): ember rises, word hidden
  if (bootEl){
    bootEl.innerHTML =
      '<div class="boot-ember"></div>' +
      '<div class="boot-title">' +
        '<span class="boot-letter">T</span>' +
        '<span class="boot-letter">R</span>' +
        '<span class="boot-letter">I</span>' +
        '<span class="boot-letter">B</span>' +
        '<span class="boot-letter">E</span>' +
        '<span class="boot-letter">S</span>' +
      '</div>' +
      '<div class="boot-sub">RISE OF THE TRIBES</div>';
  }
  await sleep(1000);

  // Act 3 (1400-2200ms): letters assemble
  const letters = $$('.boot-letter');
  letters.forEach((l, i) => { l.style.animationDelay = (i * 80) + 'ms'; });
  const sub = $('.boot-sub'); if (sub) sub.style.opacity = '1';
  await sleep(800);

  // Act 4 (2200-2600ms): app revealed behind, then boot slides up
  const app = $('#app'); if (app) app.style.display = 'block';
  const gate = $('#gate'); if (gate) gate.style.display = 'none';

  if (!hasOnboarded()){
    await runOnboarding();
    localStorage.setItem('tribes.onboarded', '1');
  } else {
        try { renderAll(); } catch(err){ setBoot('C: ' + (err && err.message ? err.message : String(err))); console.error(err); }
  }

  if (bootEl){
    bootEl.classList.add('gone');
    await sleep(600);
    bootEl.style.display = 'none';
  }
}

/* ---------- onboarding (3 steps) ---------- */
async function runOnboarding(){
  const app = $('#app'); if (!app) return;

  // Step 1: Welcome
  const step1 = el('div','ob-step', '');
  step1.innerHTML =
    '<div class="ob-ember"></div>' +
    '<p class="ob-line" id="obLine1">You wake at the fire.</p>' +
    '<p class="ob-line ob-delay" id="obLine2">But the tribe does not know your name.</p>' +
    '<button class="ob-btn" id="obBtn1">Give your name</button>';
  app.appendChild(step1);

  await new Promise(resolve => {
    $('#obBtn1').addEventListener('click', ()=>{ haptic('light'); resolve(); });
  });
  step1.classList.add('leaving');
  await sleep(400);
  step1.remove();

  // Step 2: Username
  const step2 = el('div','ob-step', '');
  const prefilled = (S && S.user && S.user.username) || '';
  step2.innerHTML =
    '<div class="ob-title">What shall we call you?</div>' +
    '<div class="ob-username-wrap">' +
      '<span class="ob-at">@</span>' +
      '<input class="ob-input" id="obUsername" maxlength="32" placeholder="username" value="' + esc(prefilled) + '"/>' +
      '<span class="ob-check" id="obCheck"></span>' +
    '</div>' +
    '<div class="ob-previews">' +
      '<div class="ob-preview"><span class="ob-label">On the Ranks</span><b id="pv1">—</b></div>' +
      '<div class="ob-preview"><span class="ob-label">In the Kiva</span><b id="pv2">—</b></div>' +
      '<div class="ob-preview"><span class="ob-label">At War</span><b id="pv3">—</b></div>' +
    '</div>' +
    '<button class="ob-btn" id="obBtn2" disabled>Enter the fire</button>';
  app.appendChild(step2);

  const inp = $('#obUsername'), chk = $('#obCheck'), btn = $('#obBtn2');
  const update = () => {
    const v = inp.value.trim();
    const ok = /^[a-z0-9_]{3,32}$/i.test(v);
    chk.textContent = ok ? '✓' : '';
    chk.classList.toggle('on', ok);
    btn.disabled = !ok;
    $('#pv1').textContent = v || '—';
    $('#pv2').textContent = v || '—';
    $('#pv3').textContent = v || '—';
  };
  inp.addEventListener('input', update);
  update();

  await new Promise(resolve => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      haptic('medium');
      const v = inp.value.trim();
      // The server verifies the actual Telegram username; here we just proceed.
      // If the user changed it, the server's initData still carries the real one.
      const ripple = el('div','ob-ripple');
      step2.appendChild(ripple);
      await sleep(500);
      resolve();
    });
  });
  step2.classList.add('leaving');
  await sleep(400);
  step2.remove();

  // Step 3: First landing — staggered reveal
  renderAll();
  const cards = $$('.dash-card');
  cards.forEach((c, i) => { c.style.animationDelay = (i*60) + 'ms'; c.classList.add('reveal'); });
}

/* =====================================================================
   Username gate (hard block)
===================================================================== */
function showUsernameGate(){
  const boot = $('#boot'); if (boot) boot.style.display = 'none';
  const gate = $('#gate'); if (gate) gate.style.display = 'grid';
}

/* =====================================================================
   Ember Row navigation
===================================================================== */
let navMinimized = false;
let navRecessed = false;
let navHidden = false;

function currentNavOrder(){
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return ['home','fire','war','ranks','store'];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr[0] !== 'home') return ['home','fire','war','ranks','store'];
    return arr.slice(0, 5);
  } catch(e){ return ['home','fire','war','ranks','store']; }
}
function saveNavOrder(arr){
  localStorage.setItem(RANK_KEY, JSON.stringify(arr));
  buildNav();
}

function buildNav(){
  const nav = $('.tabbar');
  if (!nav) return;
  const order = currentNavOrder();
  nav.innerHTML = '';
  order.forEach(id => {
    const meta = NAV_POOL.find(n => n.id === id);
    if (!meta) return;
    const btn = el('button','tab');
    btn.dataset.tab = meta.id;
    btn.setAttribute('data-active', meta.id === TAB ? 'true' : 'false');
    btn.innerHTML =
      '<div class="tab-icon">' +
        '<svg class="outline"><use href="/assets/icons.svg#' + meta.ico + '"/></svg>' +
        '<svg class="filled"><use href="/assets/icons.svg#' + meta.filled + '"/></svg>' +
      '</div>' +
      '<div class="tab-label">' + esc(meta.label) + '</div>' +
      '<div class="tab-heatline"></div>';
    nav.appendChild(btn);
    attachTabHandlers(btn, meta.id);
  });
  updateNavSpotlight();
}

function updateNavSpotlight(){
  const nav = $('.tabbar');
  if (!nav) return;
  const active = nav.querySelector('[data-active="true"]');
  if (!active) return;
  const navRect = nav.getBoundingClientRect();
  const tabRect = active.getBoundingClientRect();
  const center = tabRect.left + tabRect.width/2 - navRect.left;
  nav.style.setProperty('--tab-x', center + 'px');
}

function attachTabHandlers(btn, id){
  let longTimer = null;
  let longFired = false;
  let doubleTimer = null;
  let lastTap = 0;

  btn.addEventListener('pointerdown', () => {
    longFired = false;
    longTimer = setTimeout(()=>{
      longFired = true;
      haptic('medium');
      showTabMenu(id, btn);
    }, 500);
  });

  const cancel = () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } };
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('pointerleave', cancel);

  btn.addEventListener('click', () => {
    if (longFired) return;
    const now = Date.now();
    if (now - lastTap < 280){
      // double tap
      if (doubleTimer){ clearTimeout(doubleTimer); doubleTimer = null; }
      scrollToTop();
      haptic('light');
      lastTap = 0;
      return;
    }
    lastTap = now;
    doubleTimer = setTimeout(() => {
      // single tap
      haptic('light');
      setTab(id);
      const nav = $('.tabbar');
      if (nav){
        nav.dataset.surge = 'true';
        setTimeout(()=> nav.dataset.surge = 'false', 300);
      }
      doubleTimer = null;
    }, 260);
  });
}

function showTabMenu(id, btn){
  closeTabMenu();
  const menu = el('div','tab-menu');
  const options = MENU_FOR[id] || [{ label:'Open', action: () => setTab(id) }];
  options.forEach(o => {
    const b = el('button', '', '<svg class="icon icon-sm"><use href="/assets/icons.svg#' + (o.ico || 'check') + '"/></svg><span>' + esc(o.label) + '</span>');
    b.addEventListener('click', () => { closeTabMenu(); o.action(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  menu.style.left = Math.max(12, Math.min(window.innerWidth - 200, r.left + r.width/2 - 90)) + 'px';
  setTimeout(()=>{
    document.addEventListener('pointerdown', outsideMenu, true);
  }, 10);
}
function closeTabMenu(){
  const m = $('.tab-menu'); if (m) m.remove();
  document.removeEventListener('pointerdown', outsideMenu, true);
}
function outsideMenu(e){
  const m = $('.tab-menu'); if (m && m.contains(e.target)) return;
  closeTabMenu();
}

const MENU_FOR = {
  home:     [{ label:'Reset dashboard', ico:'refresh', action: scrollToTop }],
  fire:     [{ label:'Check in now',   ico:'flame', action: () => { setTab('fire'); } }],
  war:      [{ label:'War status',     ico:'war',   action: () => setTab('war') }],
  ranks:    [{ label:'My rank',        ico:'ranks', action: () => setTab('ranks') }],
  store:    [{ label:'Featured item',  ico:'store', action: () => setTab('store') }],
  trials:   [{ label:'Open trials',    ico:'chronicle', action: () => setTab('trials') }],
  tribe:    [{ label:'My tribe',       ico:'tribe', action: () => setTab('tribe') }],
  kiva:     [{ label:'Open Kiva',      ico:'kiva',  action: () => openKiva() }],
  profile:  [{ label:'My profile',     ico:'profile', action: () => setTab('profile') }],
};

function scrollToTop(){
  window.scrollTo({ top:0, behavior:'smooth' });
  const nav = $('.tabbar');
  if (nav){
    nav.classList.remove('nav-reheat');
    void nav.offsetWidth;
    nav.classList.add('nav-reheat');
    setTimeout(()=> nav.classList.remove('nav-reheat'), 700);
  }
}

/* Peek behavior on scroll */
let lastScrollY = 0;
window.addEventListener('scroll', () => {
  const nav = $('.tabbar'); if (!nav) return;
  const y = window.scrollY;
  if (y > lastScrollY + 8 && y > 40){
    if (!navMinimized){ navMinimized = true; nav.dataset.minimized = 'true'; }
  } else if (y < lastScrollY - 8){
    if (navMinimized){ navMinimized = false; nav.dataset.minimized = 'false'; }
  }
  lastScrollY = y;
}, { passive:true });

/* =====================================================================
   Tab switching
===================================================================== */
function setTab(tab){
  TAB = tab;
  buildNav();
  $$('.dash-card').forEach(c => c.classList.toggle('active', c.dataset.tab === tab));
  renderAll();
}

/* =====================================================================
   Palette
===================================================================== */
function applyPalette(){
  const p = (S && S.tribe && S.tribe.palette) || 'ember';
  document.documentElement.setAttribute('data-palette', p);
  const hue = (S && S.tribe && S.tribe.hue) || 0;
  document.documentElement.style.setProperty('--thue', hue + 'deg');
}

/* End of Part 1. Parts 2 and 3 arrive in the next message. */

/* =====================================================================
   PART 2 — Home dashboard with peelable cards
===================================================================== */

/* ---------- dashboard layout ---------- */
const DASH_LAYOUT = [
  { id:'campfire', tab:'fire',   size:'hero',  fixed:true },
  { id:'war',      tab:'war',    size:'pair',  fixed:false },
  { id:'ranks',    tab:'ranks',  size:'pair',  fixed:false },
  { id:'tribe',    tab:'tribe',  size:'wide',  fixed:false },
  { id:'trials',   tab:'trials', size:'wide',  fixed:false },
  { id:'store',    tab:'store',  size:'pair',  fixed:false },
  { id:'profile',  tab:'profile',size:'pair',  fixed:false },
];

function dashCard(id){
  return $('#dash-' + id);
}

/* ---------- render dispatcher ---------- */
function renderAll(){
  renderTop();
  renderDashboard();
}

function renderTop(){
  const u = S.user, t = S.tribe;
  const crest = $('#crestArt'); if (crest) crest.innerHTML = artSvg(t ? t.crest : 'totem');
  const tn = $('#tribeName'); if (tn) tn.textContent = t ? t.name : 'No Tribe';
  const rn = $('#roleName'); if (rn) rn.textContent = u.role || 'Wanderer';
  animateCounter($('#emberVal'), u.ember);
  updateTonChip();
}

/* ---------- dashboard ---------- */
function renderDashboard(){
  const host = $('#screens'); if (!host) return;
  if (!host.dataset.built){
    host.innerHTML = '<section class="screen on" id="sc-home"></section>' +
                     '<section class="screen" id="sc-fire"></section>' +
                     '<section class="screen" id="sc-tribe"></section>' +
                     '<section class="screen" id="sc-war"></section>' +
                     '<section class="screen" id="sc-ranks"></section>' +
                     '<section class="screen" id="sc-store"></section>' +
                     '<section class="screen" id="sc-trials"></section>' +
                     '<section class="screen" id="sc-profile"></section>';
    host.dataset.built = '1';
  }
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'sc-' + TAB));

  // Home is special: dashboard grid
  const home = $('#sc-home');
  if (home){
    home.innerHTML = '<div class="dash-grid">' +
      DASH_LAYOUT.map(meta => renderCard(meta)).join('') +
      '</div>';
  }

  // Non-home screens render on demand
  if (TAB === 'fire')    renderFireScreen($('#sc-fire'));
  if (TAB === 'tribe')   renderTribeScreen($('#sc-tribe'));
  if (TAB === 'war')     renderWarScreen($('#sc-war'));
  if (TAB === 'ranks')   renderRanksScreen($('#sc-ranks'));
  if (TAB === 'store')   renderStoreScreen($('#sc-store'));
  if (TAB === 'trials')  renderTrialsScreen($('#sc-trials'));
  if (TAB === 'profile') renderProfileScreen($('#sc-profile'));
}

/* =====================================================================
   Card renderers
===================================================================== */
function renderCard(meta){
  switch(meta.id){
    case 'campfire': return cardCampfire();
    case 'war':      return cardWar();
    case 'ranks':    return cardRanks();
    case 'tribe':    return cardTribe();
    case 'trials':   return cardTrials();
    case 'store':    return cardStore();
    case 'profile':  return cardProfile();
    default:         return '';
  }
}

function cardCampfire(){
  const u = S.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const readyIn = (last + 20*3600*1000) - Date.now();
  const ready = readyIn <= 0;
  const pct = clamp(100*(1 - readyIn/(20*3600*1000)), 0, 100);
  const substate = ready ? 'Tap to feed it' : 'Feeds again in ' + fmtDur(readyIn);
  return '<div class="dash-card dash-campfire reveal" id="dash-campfire" data-tab="fire" data-act="peel" data-val="fire">' +
    '<div class="dash-campfire-inner">' +
      '<div class="campfire">' +
        '<div class="halo"></div>' +
        '<div class="logs"></div>' +
        '<div class="flame"></div><div class="flame f2"></div><div class="flame f3"></div>' +
      '</div>' +
      '<div class="dash-streak">' +
        '<div class="dash-streak-num" data-v="' + (u.streak || 0) + '">' + (u.streak || 0) + '</div>' +
        '<div class="dash-streak-lbl">DAY STREAK</div>' +
      '</div>' +
    '</div>' +
    '<div class="dash-campfire-foot">' + esc(substate) + '</div>' +
    '<div class="dash-ring" style="--p:' + (ready ? 100 : pct).toFixed(0) + '"></div>' +
  '</div>';
}

function cardWar(){
  const u = S.user;
  const noTribe = !u.tribe_id;
  if (noTribe){
    return '<div class="dash-card dash-war muted" data-tab="war" data-act="peel" data-val="war">' +
      '<div class="dash-card-head"><svg class="icon icon-sm icon-ash"><use href="/assets/icons.svg#nav-war"/></svg><span>WAR</span></div>' +
      '<div class="dash-card-body"><div class="dash-card-big">—</div><div class="dash-card-sub">Join a tribe</div></div>' +
    '</div>';
  }
  // We may not have live war data yet; use cached from S if present
  const w = (S && S.war) || null;
  const fronts = (w && w.fronts) || [{}, {}, {}];
  const dots = fronts.map(f => {
    const a = Number(f.attacker_score || 0), d = Number(f.defender_score || 0);
    if (a > d) return '<span class="war-dot lit"></span>';
    if (d > a) return '<span class="war-dot"></span>';
    return '<span class="war-dot half"></span>';
  }).join('');
  const timeLeft = w && w.end_at ? fmtDur(new Date(w.end_at).getTime() - Date.now()) : '—';
  return '<div class="dash-card dash-war" data-tab="war" data-act="peel" data-val="war">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#nav-war"/></svg><span>WAR</span></div>' +
    '<div class="war-dots">' + dots + '</div>' +
    '<div class="dash-card-foot">' + esc(timeLeft) + '</div>' +
  '</div>';
}

function cardRanks(){
  const u = S.user, t = S.tribe;
  const lb = (S.leaderboard || []);
  const mine = t ? Number(t.id) : null;
  let rank = '—';
  if (mine){
    const i = lb.findIndex(x => Number(x.id) === mine);
    if (i >= 0) rank = '#' + (i+1);
  }
  const topThree = lb.slice(0, 3).map(x => '<div class="mini-row">' + esc(x.name) + '</div>').join('') || '';
  return '<div class="dash-card dash-ranks" data-tab="ranks" data-act="peel" data-val="ranks">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#nav-ranks"/></svg><span>RANKS</span></div>' +
    '<div class="dash-card-body"><div class="dash-card-big">' + esc(rank) + '</div>' +
    '<div class="dash-card-sub">' + esc(t ? t.name : 'No tribe') + '</div></div>' +
    '<div class="mini-list">' + topThree + '</div>' +
  '</div>';
}

function cardTribe(){
  const t = S.tribe;
  if (!t){
    return '<div class="dash-card dash-tribe invite" data-tab="tribe" data-act="peel" data-val="tribe">' +
      '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#tribe"/></svg><span>TRIBE</span></div>' +
      '<div class="dash-card-body"><div class="dash-card-big">🪨</div><div class="dash-card-sub">Found or join a tribe</div></div>' +
    '</div>';
  }
  const lvl = (t.level||1);
  const cap = (S.config.levelTable.caps[lvl-1] || 5);
  const pct = clamp((Number(t.treasury) || 0) / Math.max(1, Number(t.treasury) + 25000) * 100, 3, 100);
  return '<div class="dash-card dash-tribe" data-tab="tribe" data-act="peel" data-val="tribe">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#tribe"/></svg><span>' + esc(t.name) + '</span></div>' +
    '<div class="dash-card-foot">' + (t.members||0) + '/' + cap + ' kin</div>' +
    '<div class="pyre-bar"><i style="width:' + pct + '%"></i></div>' +
  '</div>';
}

function cardTrials(){
  const ts = S.trials || [];
  const ready = ts.filter(t => t.available).length;
  const cooling = ts.length - ready;
  const dots = ts.slice(0, 5).map(t => '<span class="trial-dot ' + (t.available ? 'lit' : '') + '"></span>').join('');
  const names = ts.filter(t => t.available).map(t => esc(t.name)).join(' · ') || 'All on cooldown';
  return '<div class="dash-card dash-trials" data-tab="trials" data-act="peel" data-val="trials">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#chronicle"/></svg><span>TRIALS</span></div>' +
    '<div class="trial-dots">' + dots + '</div>' +
    '<div class="dash-card-foot">' + ready + ' ready' + (cooling ? ' · ' + cooling + ' cooling' : '') + '</div>' +
    '<div class="trial-names">' + names + '</div>' +
  '</div>';
}

function cardStore(){
  const p = (S.payments && S.payments.starItems) || {};
  const featuredKey = 'starter_bundle';
  const featured = p[featuredKey];
  const stars = S.user.stars || 0;
  return '<div class="dash-card dash-store" data-tab="store" data-act="peel" data-val="store">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#nav-store"/></svg><span>STORE</span></div>' +
    '<div class="dash-card-body">' +
      '<div class="dash-card-big">' + (featured ? '⭐' : '🪓') + '</div>' +
      '<div class="dash-card-sub">' + (featured ? esc(featured.title) : 'Trading Post') + '</div>' +
    '</div>' +
    '<div class="dash-card-foot">⭐ ' + fmt(stars) + '</div>' +
  '</div>';
}

function cardProfile(){
  const u = S.user;
  const roleLbl = u.role || 'Wanderer';
  return '<div class="dash-card dash-profile" data-tab="profile" data-act="peel" data-val="profile">' +
    '<div class="dash-card-head"><svg class="icon icon-sm icon-rust"><use href="/assets/icons.svg#profile"/></svg><span>YOU</span></div>' +
    '<div class="profile-chip">' +
      '<div class="profile-avatar">' + esc((u.first_name||'?').slice(0,1).toUpperCase()) + '</div>' +
      '<div class="profile-meta"><b>' + esc(u.first_name || u.username || 'Kin') + '</b><span>' + esc(roleLbl) + '</span></div>' +
    '</div>' +
    '<div class="dash-card-foot">🔥 ' + fmt(u.ember) + '</div>' +
  '</div>';
}

/* =====================================================================
   Peel animation
===================================================================== */
let peelState = { active: false, from: null };

function peelTo(tab, sourceEl){
  if (peelState.active) return;
  peelState.active = true;

  const nav = $('.tabbar');
  if (nav) nav.dataset.recessed = 'true';

  // Card lift
  if (sourceEl) sourceEl.classList.add('lifting');
  haptic('light');

  // Use view-transition if available for the morph
  const doSwap = () => {
    setTab(tab);
    if (sourceEl) sourceEl.classList.remove('lifting');
    if (nav) nav.dataset.recessed = 'false';
    peelState.active = false;
  };

  if (document.startViewTransition && TIER() !== 'low' && TIER() !== 'ultra-saver'){
    document.startViewTransition(doSwap);
  } else {
    doSwap();
  }
}

/* =====================================================================
   On-demand screens (Fire, Tribe, War, Ranks, Store, Trials, Profile)
===================================================================== */

function fmtDur(ms){
  ms = Math.max(0, ms);
  const d = Math.floor(ms/86400000), h = Math.floor(ms%86400000/3600000), m = Math.floor(ms%3600000/60000);
  return d > 0 ? (d + 'd ' + h + 'h') : h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
}

/* Fire detail screen */
function renderFireScreen(box){
  if (!box) return;
  const u = S.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const readyIn = (last + 20*3600*1000) - Date.now();
  const ready = readyIn <= 0;
  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">The Fire</div>' +
      '<div class="fire-detail">' +
        '<div class="campfire campfire-large' + (ready?' ready':'') + '" id="campfireBig" data-act="tapFire">' +
          '<div class="halo"></div><div class="logs"></div>' +
          '<div class="flame"></div><div class="flame f2"></div><div class="flame f3"></div>' +
        '</div>' +
        '<div class="fire-hint">' + (ready ? 'Tap to feed it' : 'Feeds again in ' + fmtDur(readyIn)) + '</div>' +
      '</div>' +
      '<div class="card"><div class="checkin">' +
        '<div class="dial" style="--p:' + (ready?100:clamp(100*(1-readyIn/(20*3600*1000)),0,100)) + '"><b>' + (u.streak||0) + '<i>STREAK</i></b></div>' +
        '<div style="flex:1"><h3 style="margin:0 0 4px">Keeper of the Flame</h3>' +
        '<p class="tiny" style="margin:0">Feed the fire daily to grow your streak.</p></div>' +
      '</div></div>' +
      '<div class="card">' +
        '<div class="hd" style="margin:0 0 10px"><h2 style="font-size:1.05rem">The Ash Pit</h2>' +
        '<span class="pill pill-gold">Idle</span></div>' +
        '<div class="ash-row">' +
          '<div class="dial" style="--p:' + ((S.ashPending/S.config.ashCap)*100).toFixed(0) + '"><b>' + S.ashPending + '<i>ASH</i></b></div>' +
          '<button class="btn ' + (S.ashPending>0?'btn-primary btn-shine':'btn-stone') + ' btn-block" data-act="ash">' +
            (S.ashPending>0 ? 'Gather +' + fmt(S.ashPending * S.ashUnit) : 'Smouldering…') +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
}

/* Tribe detail screen */
function renderTribeScreen(box){
  if (!box) return;
  const u = S.user, t = S.tribe;
  if (!t){
    box.innerHTML =
      '<div class="screen-body">' +
        '<div class="screen-title">Tribe</div>' +
        '<div class="empty"><span class="big">🪨</span>' +
        '<h2 style="margin:0;color:var(--gold);font-weight:800">You wander alone</h2>' +
        '<p class="tiny" style="margin-top:8px">Found your own tribe or join an existing fire.</p></div>' +
        '<button class="btn btn-primary btn-shine btn-block" data-act="openCreate">Found a Tribe · ' + fmt(S.config.foundEmber) + ' Ember</button>' +
        '<div id="joinList" style="margin-top:20px"></div>' +
      '</div>';
    api('/tribes').then(d => {
      const host = $('#joinList'); if (!host) return;
      const list = (d.tribes||[]).slice(0,20);
      host.innerHTML = list.map(x =>
        '<div class="card" style="padding:14px;margin-bottom:10px">' +
          '<div class="row" style="border:0;padding:0">' +
            '<span class="crest-art">' + artSvg(x.crest) + '</span>' +
            '<div style="flex:1;min-width:0"><b style="color:var(--gold)">' + esc(x.name) + '</b>' +
            '<div class="tiny">' + fmt(x.members) + ' kin · ' + fmt(x.loyalty_total) + ' loyalty</div></div>' +
            '<button class="btn btn-stone" data-act="join" data-val="' + x.id + '">Join</button>' +
          '</div>' +
        '</div>'
      ).join('');
    }).catch(()=>{});
    return;
  }
  const lvl = t.level || 1;
  const cap = S.config.levelTable.caps[lvl-1] || 5;
  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">' + esc(t.name) + '</div>' +
      '<div class="card" style="text-align:center">' +
        '<div class="crest-art" style="width:88px;height:88px;margin:0 auto 10px;border-radius:22px">' + artSvg(t.crest) + '</div>' +
        '<h2 style="font-size:1.5rem;margin:0;color:var(--gold);font-weight:800">' + esc(t.name) + '</h2>' +
        '<p class="muted" style="margin:6px 0 12px">' + esc(t.motto || 'We rise from the ash.') + '</p>' +
        '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">' +
          '<span class="pill pill-gold">' + esc(u.role) + '</span>' +
          '<span class="pill pill-jade">🏆 ' + (t.wins||0) + 'W</span>' +
          '<span class="pill pill-blood">💀 ' + (t.losses||0) + 'L</span>' +
        '</div>' +
      '</div>' +
      '<div class="card"><h3>Kiva</h3><button class="btn btn-primary btn-shine btn-block" data-act="openKiva">Open the Kiva</button></div>' +
      '<div class="card"><h3>Stoke the Great Pyre</h3>' +
        '<button class="btn btn-primary btn-shine btn-block" data-act="openDonate">Donate Ember</button></div>' +
      '<button class="btn btn-danger btn-block" data-act="leave" style="margin-top:8px">Leave the Tribe</button>' +
    '</div>';
}

/* War detail screen */
function renderWarScreen(box){
  if (!box) return;
  const u = S.user;
  if (!u.tribe_id){
    box.innerHTML = '<div class="screen-body"><div class="screen-title">War</div>' +
      '<div class="empty"><span class="big">⚔️</span><h2>No banner</h2>' +
      '<p class="tiny">Join a tribe to wage war.</p></div></div>';
    return;
  }
  box.innerHTML = '<div class="screen-body"><div class="screen-title">War</div>' +
    '<div id="warBody"><div class="skeleton"></div><div class="skeleton"></div></div></div>';
  loadWar();
}

async function loadWar(){
  const box = $('#warBody'); if (!box) return;
  let war;
  try { war = (await api('/war')).war; }
  catch(e){ box.innerHTML = '<p class="tiny">Could not reach the war drums.</p>'; return; }
  if (!war){
    box.innerHTML = '<div class="war-arena">' +
      '<div class="war-emblem"><div class="vs">WAR DRUMS</div></div>' +
      '<button class="btn btn-danger btn-shine btn-block" data-act="declareWar">⚔️ Declare War</button>' +
    '</div>';
    return;
  }
  if (war.status === 'resolved'){
    const myId = S.tribe ? Number(S.tribe.id) : null;
    const won = war.winner_id && Number(war.winner_id) === myId;
    box.innerHTML = '<div class="war-arena" style="text-align:center">' +
      '<div class="war-emblem"><div class="vs">' + (won?'VICTORY':'DEFEAT') + '</div></div>' +
      '<span style="font-size:3rem;display:block;margin:8px 0">' + (won?'🏆':'💀') + '</span>' +
    '</div>';
    return;
  }
  // Active war
  const mineA = war.mine === 'attacker';
  const me = mineA ? war.attacker : war.defender;
  const foe = mineA ? war.defender : war.attacker;
  const fronts = war.fronts || [];
  box.innerHTML =
    '<div class="war-arena">' +
      '<div class="war-emblem"><div class="vs">⚔️ WAR ⚔️</div></div>' +
      '<div class="versus">' +
        '<div class="war-totem"><div class="tm">' + artSvg(me.crest) + '</div><b>' + esc(me.name) + '</b></div>' +
        '<div class="clash">🔥</div>' +
        '<div class="war-totem foe"><div class="tm">' + artSvg(foe.crest) + '</div><b>' + esc(foe.name) + '</b></div>' +
      '</div>' +
      '<div class="wmeta">' +
        '<div class="box"><b id="warCd">…</b><span>Time left</span></div>' +
        '<div class="box"><b>' + war.stake_pct + '%</b><span>Stake</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="fronts-wrap">' + fronts.map((f,i) => frontHtml(f,i)).join('') + '</div>' +
    '<div class="war-action-panel">' +
      '<div class="wact-head">Push a front</div>' +
      '<div class="wact-front-pick" id="frontPick">' +
        fronts.map((f,i) => '<button class="fp-btn ' + (i===0?'active':'') + '" data-act="pickFront" data-val="' + i + '">' + esc(f.name) + '</button>').join('') +
      '</div>' +
      '<div class="wact-btns">' +
        '<button class="wact-btn" data-act="warAction" data-val="rally"><b>Rally</b><span>+25</span></button>' +
        '<button class="wact-btn" data-act="warAction" data-val="chant"><b>Chant</b><span>+150</span></button>' +
        '<button class="wact-btn raid" data-act="warAction" data-val="raid"><b>Raid</b><span>+800</span></button>' +
      '</div>' +
    '</div>';
  startWarTicker(new Date(war.end_at).getTime());
}

function frontHtml(f, i){
  const tot = Math.max(1, Number(f.attacker_score) + Number(f.defender_score));
  const aPct = clamp((Number(f.attacker_score) / tot) * 100, 0, 100);
  return '<div class="front-card" data-front="' + i + '">' +
    '<div class="front-head"><span class="front-name">' + esc(f.name) + '</span>' +
    '<span class="front-scores"><b>' + fmt(f.attacker_score) + '</b> vs <b>' + fmt(f.defender_score) + '</b></span></div>' +
    '<div class="front-bar"><i style="width:' + aPct + '%"></i><i style="width:' + (100-aPct) + '%"></i></div>' +
  '</div>';
}

let warTimer = null;
function startWarTicker(endAt){
  if (warTimer) clearInterval(warTimer);
  const tick = () => {
    const e = $('#warCd'); if (!e) { clearInterval(warTimer); warTimer = null; return; }
    const ms = endAt - Date.now();
    e.textContent = ms <= 0 ? 'resolving…' : fmtDur(ms);
  };
  tick();
  warTimer = setInterval(tick, 1000);
}

/* Ranks detail screen */
function renderRanksScreen(box){
  if (!box) return;
  const lb = S.leaderboard || [];
  const top = lb.length ? (Number(lb[0].loyalty_total) || 1) : 1;
  const mine = S.tribe ? Number(S.tribe.id) : null;
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Hall of Tribes</div>' +
    (lb.length ? lb.map((t,i) => {
      const pct = clamp(Number(t.loyalty_total)/top*100, 4, 100);
      const me = mine && mine === Number(t.id);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i+1);
      return '<div class="card" style="padding:14px;margin-bottom:10px;' + (me?'border-color:rgba(255,207,122,.4)':'') + '">' +
        '<div class="row" style="border:0;padding:0 0 10px">' +
          '<span class="avatar">' + medal + '</span>' +
          '<div style="flex:1;min-width:0"><b style="color:var(--gold)">' + esc(t.name) + (me?' · you':'') + '</b>' +
          '<div class="tiny">' + fmt(t.members) + ' kin · Pyre ' + fmt(t.treasury) + '</div></div>' +
          '<b style="color:var(--gold);white-space:nowrap">' + fmt(t.loyalty_total) + '</b>' +
        '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '</div>';
    }).join('') : '<div class="empty"><span class="big">🏆</span><p class="tiny">No tribes yet.</p></div>') +
  '</div>';
}

/* Store detail screen */
function renderStoreScreen(box){
  if (!box) return;
  const p = S.payments || {};
  const star = p.starItems || {};
  const ton = p.tonItems || {};
  const featuredKey = 'starter_bundle';
  const featured = star[featuredKey];
  const ART_FOR = { spark:'flame', flame:'torch', blaze:'firestone', inferno:'sun', charm:'charm', firestone:'firestone', boneidol:'idol', sundisc:'sun', moonshard:'moon', war_chest_topup:'firestone', rally_burst:'flame' };
  const sections = { ember:[], relics:[], boosts:[], war:[], cosmetics:[] };
  const sectionFor = (k) => {
    if (k === featuredKey) return 'featured';
    if (k.startsWith('name_color_') || k.startsWith('glow_')) return 'cosmetics';
    if (k === 'pyreboost') return 'boosts';
    if (k === 'war_chest_topup' || k === 'rally_burst') return 'war';
    if (['firestone','boneidol','sundisc','moonshard'].includes(k)) return 'relics';
    return 'ember';
  };
  for (const [k,it] of Object.entries(star)){
    if (k === featuredKey) continue;
    const s = sectionFor(k);
    if (sections[s]) sections[s].push([k,it]);
  }
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Trading Post</div>' +
    (featured ? '<div class="featured"><span class="ft-badge">ONE-TIME</span>' +
      '<h3>' + esc(featured.title) + '</h3><p>' + esc(featured.desc) + '</p>' +
      '<button class="b" data-act="buyStars" data-val="' + featuredKey + '">⭐ ' + fmt(featured.stars) + '</button></div>' : '') +
    '<div class="shop-tabs">' +
      Object.keys(sections).filter(s => sections[s].length).map((s,i) =>
        '<button class="shop-tab' + (i===0?' active':'') + '" data-act="shopTab" data-val="' + s + '">' + ({ember:'Ember',relics:'Relics',boosts:'Boosts',war:'War',cosmetics:'Looks'})[s] + '</button>').join('') +
    '</div>' +
    Object.entries(sections).map(([s,arr]) =>
      '<div class="shop-section" data-section="' + s + '" style="' + (s === 'ember' ? '' : 'display:none') + '">' +
        arr.map(([k,it]) =>
          '<div class="shop-card"><div class="sc-art">' + artSvg(ART_FOR[k] || 'flame') + '</div>' +
          '<b>' + esc(it.title) + '</b><p>' + esc(it.desc) + '</p>' +
          '<button class="b star" data-act="buyStars" data-val="' + k + '">⭐ ' + fmt(it.stars) + '</button>' +
          '</div>'
        ).join('') +
      '</div>'
    ).join('') +
  '</div>';
}

/* Trials detail screen */
function renderTrialsScreen(box){
  if (!box) return;
  const ts = S.trials || [];
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Trials</div>' +
    '<div class="trials">' + ts.map(t => {
      const disabled = !t.available;
      const reason = !t.available && t.nextIn ? fmtDur(t.nextIn) : '';
      return '<button class="trial' + (disabled?' claimed':'') + '" data-act="trial" data-val="' + esc(t.slug) + '" ' + (disabled?'disabled':'') + '>' +
        '<span class="ti-ico">' + esc(t.glyph || '🔥') + '</span>' +
        '<span class="ti-body"><b>' + esc(t.name) + '</b><span>' + esc(t.hint || '') + '</span></span>' +
        '<span class="ti-rew">' + (t.reward_ember ? '<span class="rw">🔥 +' + fmt(t.reward_ember) + '</span>' : '') +
        (t.reward_loyalty ? '<span class="rw loy">❤ +' + fmt(t.reward_loyalty) + '</span>' : '') +
        (reason ? '<span class="ti-cd">' + reason + '</span>' : '') + '</span>' +
        '<span class="ti-chev">' + (t.available ? '›' : '✓') + '</span>' +
      '</button>';
    }).join('') + '</div>' +
  '</div>';
}

/* Profile detail screen */
function renderProfileScreen(box){
  if (!box) return;
  const u = S.user, t = S.tribe;
  box.innerHTML = '<div class="screen-body"><div class="screen-title">You</div>' +
    '<div class="card" style="text-align:center">' +
      '<div class="profile-avatar-large">' + esc((u.first_name||'?').slice(0,1).toUpperCase()) + '</div>' +
      '<h2 style="margin:8px 0 4px;font-size:1.4rem;color:var(--gold)">' + esc(u.first_name || u.username || 'Kin') + '</h2>' +
      '<div class="muted" style="font-size:.8rem">' + esc(u.role || 'Wanderer') + (t ? ' · ' + esc(t.name) : '') + '</div>' +
    '</div>' +
    '<div class="wmeta">' +
      '<div class="box"><b>' + fmt(u.ember) + '</b><span>Ember</span></div>' +
      '<div class="box"><b>' + fmt(u.loyalty) + '</b><span>Loyalty</span></div>' +
      '<div class="box"><b>' + fmt(u.streak || 0) + '</b><span>Streak</span></div>' +
    '</div>' +
  '</div>';
}

/* End of Part 2. Part 3 (trial mini-games, action registry, init) follows. */

/* =====================================================================
   PART 3 — Trial mini-games, sheets, Kiva, action registry, init
===================================================================== */

/* ---------- shared sheet helper ---------- */
function sheet(html){
  const root = $('#sheetRoot'); if (!root) return;
  root.innerHTML = '<div class="sheet-bg" data-act="bgClose"><div class="sheet"><div class="handle"></div>' + html + '</div></div>';
}
function closeSheet(){
  cleanupCry();
  const root = $('#sheetRoot'); if (root) root.innerHTML = '';
}

/* ---------- reward sequence (shared) ---------- */
async function rewardSequence(container, payload, onComplete){
  // 4 acts over 1.8s
  const overlay = el('div','reward-overlay');
  overlay.innerHTML =
    '<div class="reward-bloom"></div>' +
    '<div class="reward-card reward-drop">' +
      '<div class="reward-ico emoji-pop">' + (payload.ico || '🔥') + '</div>' +
      '<div class="reward-title">' + esc(payload.title || 'Trial complete') + '</div>' +
      '<div class="reward-amount">' + esc(payload.amount || '') + '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  haptic('heavy');
  // Act 1: freeze (already done by overlay)
  await sleep(200);
  // Act 2: bloom
  overlay.querySelector('.reward-bloom').classList.add('active');
  await sleep(400);
  // Act 3: reveal
  overlay.querySelector('.reward-card').classList.add('revealed');
  await sleep(600);
  // Act 4: collect
  overlay.classList.add('collecting');
  await sleep(600);
  overlay.remove();
  if (typeof onComplete === 'function') onComplete();
}

/* =====================================================================
   Trial dispatcher
===================================================================== */
function actTrial(btn, slug){
  const t = (S.trials || []).find(x => x.slug === slug);
  if (!t) return;
  if (t.kind === 'rewarded_ad') return openAdSheet(t);
  const mg = t.minigame || 'hold';
  if (mg === 'stoke') return openStokeSheet(t);
  if (mg === 'feed')  return openFeedSheet(t);
  if (mg === 'cry')   return openCryTapSheet(t);
  if (mg === 'sift')  return openSiftSheet(t);
  return openHoldSheet(t);
}

/* ---------- 1) STOKE THE FIRE — drag logs with physics ---------- */
function openStokeSheet(trial){
  const LOGS = 4;
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Drag ' + LOGS + ' logs into the fire</div>' +
    '<div class="stoke-wrap" id="stokeWrap">' +
      '<div class="stoke-logs" id="stokeLogs">' +
        Array.from({length:LOGS}).map((_,i) =>
          '<div class="stoke-log" data-log="' + i + '">' +
            '<svg viewBox="0 0 40 16" width="54" height="22">' +
              '<rect x="2" y="4" width="36" height="8" rx="4" fill="#6b4326"/>' +
              '<rect x="2" y="4" width="36" height="3" rx="1.5" fill="#8a5a1c"/>' +
              '<circle cx="20" cy="8" r="1.5" fill="#4a2f19" opacity=".6"/>' +
            '</svg>' +
          '</div>'
        ).join('') +
      '</div>' +
      '<div class="stoke-fire" id="stokeFire">' +
        '<div class="stoke-pit"></div>' +
        '<div class="stoke-flame" id="stokeFlame"></div>' +
      '</div>' +
      '<div class="stoke-progress" id="stokeProgress">0 / ' + LOGS + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(() => attachStoke(trial), 30);
}

let stokeCount = 0;
function attachStoke(trial){
  stokeCount = 0;
  const fire = $('#stokeFire');
  const progress = $('#stokeProgress');
  const wrap = $('#stokeWrap');
  if (!fire || !wrap) return;
  const total = 4;

  $$('.stoke-log').forEach(log => {
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false, lastX = 0, lastY = 0;

    const onDown = e => {
      if (log.dataset.used) return;
      dragging = true; moved = false;
      const p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      lastX = sx; lastY = sy;
      const r = log.getBoundingClientRect();
      ox = r.left; oy = r.top;
      log.style.position = 'fixed';
      log.style.left = ox + 'px';
      log.style.top = oy + 'px';
      log.style.width = r.width + 'px';
      log.style.height = r.height + 'px';
      log.style.zIndex = 9999;
      log.style.pointerEvents = 'none';
      log.classList.add('dragging');
      haptic('light');
      e.preventDefault();
    };
    const onMove = e => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - sx, dy = p.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      const vx = p.clientX - lastX, vy = p.clientY - lastY;
      lastX = p.clientX; lastY = p.clientY;
      const tilt = clamp(vx * 0.6, -20, 20);
      log.style.left = (ox + dx) + 'px';
      log.style.top = (oy + dy) + 'px';
      log.style.transform = 'rotate(' + tilt + 'deg) scale(1.08)';
      const fr = fire.getBoundingClientRect();
      const inFire = p.clientX > fr.left && p.clientX < fr.right && p.clientY > fr.top && p.clientY < fr.bottom;
      fire.classList.toggle('over', inFire);
      e.preventDefault();
    };
    const onUp = e => {
      if (!dragging) return;
      dragging = false;
      const p = e.changedTouches ? e.changedTouches[0] : e;
      const fr = fire.getBoundingClientRect();
      const inFire = p.clientX > fr.left - 20 && p.clientX < fr.right + 20 && p.clientY > fr.top - 20 && p.clientY < fr.bottom + 20;
      log.classList.remove('dragging');
      fire.classList.remove('over');
      if (inFire){
        log.style.transition = 'all .35s cubic-bezier(.2,.9,.2,1)';
        log.style.left = (fr.left + fr.width/2 - log.offsetWidth/2) + 'px';
        log.style.top = (fr.top + fr.height/2) + 'px';
        log.style.transform = 'rotate(20deg) scale(.4)';
        log.style.opacity = '0';
        log.dataset.used = '1';
        setTimeout(() => {
          stokeCount++;
          const flame = $('#stokeFlame');
          if (flame) flame.setAttribute('data-logs', String(stokeCount));
          burstAt(fire, 16);
          if (wrap) {
            wrap.classList.remove('screen-shake');
            void wrap.offsetWidth;
            wrap.classList.add('screen-shake');
          }
          if (progress) progress.textContent = stokeCount + ' / ' + total;
          haptic('medium');
          if (stokeCount >= total) completeStoke(trial);
        }, 350);
      } else {
        log.style.transition = 'all .3s cubic-bezier(.2,.9,.2,1)';
        log.style.position = '';
        log.style.left = '';
        log.style.top = '';
        log.style.width = '';
        log.style.height = '';
        log.style.transform = '';
        log.style.zIndex = '';
        log.style.pointerEvents = '';
      }
      e.preventDefault();
    };
    log.addEventListener('pointerdown', onDown);
    log.addEventListener('pointermove', onMove);
    log.addEventListener('pointerup', onUp);
    log.addEventListener('pointercancel', onUp);
  });
}

async function completeStoke(trial){
  haptic('heavy');
  const wrap = $('#stokeWrap');
  if (wrap) wrap.classList.add('camera-push');
  await sleep(400);
  try {
    const r = await api('/trials/' + encodeURIComponent(trial.slug));
    if (!r.ok){ toast('Not ready','warn'); return; }
    const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                   (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    closeSheet();
    rewardSequence(null, { ico:'🔥', title:'Fire stoked!', amount: amount }, () => refresh());
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- 2) FEED THE KIN — hold bowl, three bites ---------- */
function openFeedSheet(trial){
  const BITES = 3;
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Hold the bowl to feed</div>' +
    '<div class="feed-wrap">' +
      '<div class="feed-bowl" id="feedBowl">' +
        '<div class="feed-fill" id="feedFill"></div>' +
        '<div class="feed-steam" id="feedSteam"></div>' +
        '<div class="feed-bowl-ico">🥣</div>' +
      '</div>' +
      '<div class="feed-bites" id="feedBites">' +
        Array.from({length:BITES}).map((_,i) => '<span class="fb" data-i="' + i + '">🥩</span>').join('') +
      '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(() => attachFeed(trial), 30);
}

let feedRAF = null, feedStart = 0, feedBites = 0, feedDone = false;
function attachFeed(trial){
  const bowl = $('#feedBowl'); if (!bowl) return;
  const fill = $('#feedFill');
  const bites = $$('#feedBites .fb');
  feedBites = 0; feedDone = false;
  const BITE_MS = 800;

  const down = e => {
    if (feedDone) return;
    feedStart = performance.now();
    bowl.classList.add('holding');
    haptic('light');
    const paint = () => {
      if (feedDone) return;
      const elapsed = performance.now() - feedStart;
      const pct = Math.min(100, (elapsed / BITE_MS) * 100);
      if (fill) fill.style.height = pct + '%';
      if (pct >= 100){
        feedBites++;
        if (bites[feedBites-1]) bites[feedBites-1].classList.add('on');
        haptic('medium');
        if (fill) fill.style.height = '0%';
        burstAt(bowl, 8);
        bowl.classList.remove('screen-shake');
        void bowl.offsetWidth;
        bowl.classList.add('screen-shake');
        if (feedBites >= bites.length){
          feedDone = true;
          completeFeed(trial);
          return;
        }
        feedStart = performance.now();
      }
      feedRAF = requestAnimationFrame(paint);
    };
    feedRAF = requestAnimationFrame(paint);
    e.preventDefault();
  };
  const up = () => {
    if (feedRAF){ cancelAnimationFrame(feedRAF); feedRAF = null; }
    bowl.classList.remove('holding');
    if (fill) fill.style.height = '0%';
  };
  bowl.addEventListener('pointerdown', down);
  document.addEventListener('pointerup', up, { once:true });
  document.addEventListener('pointercancel', up, { once:true });
}

async function completeFeed(trial){
  haptic('heavy');
  await sleep(400);
  try {
    const r = await api('/trials/' + encodeURIComponent(trial.slug));
    if (!r.ok){ toast('Not ready','warn'); return; }
    const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                   (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    closeSheet();
    rewardSequence(null, { ico:'🥣', title:'Kin fed!', amount: amount }, () => refresh());
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- 3) DAWN CRY — tap drum on beat ---------- */
function openCryTapSheet(trial){
  const BEATS = 3;
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Tap the drum on the beat</div>' +
    '<div class="cry-wrap">' +
      '<div class="cry-pulse"><span class="cry-pulse-ring" id="cryPulse"></span></div>' +
      '<button class="cry-drum" id="cryDrum"><span class="cry-drum-ico">🥁</span></button>' +
      '<div class="cry-score" id="cryScore">0 / ' + BEATS + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(() => attachCry(trial), 30);
}

let cryRAF = null, cryBeatTimer = null, cryScore = 0, cryBeatOn = false;
function attachCry(trial){
  const drum = $('#cryDrum'); if (!drum) return;
  const pulse = $('#cryPulse');
  const scoreEl = $('#cryScore');
  cryScore = 0;
  const BEATS = 3;
  const BEAT_MS = 900;
  const ON_WINDOW = 280;

  let cycleT = performance.now();
  const loop = () => {
    const now = performance.now();
    const phase = (now - cycleT) % BEAT_MS;
    const on = phase < ON_WINDOW;
    if (on !== cryBeatOn){
      cryBeatOn = on;
      if (pulse) pulse.classList.toggle('on', on);
    }
    cryRAF = requestAnimationFrame(loop);
  };
  cryRAF = requestAnimationFrame(loop);

  drum.addEventListener('pointerdown', e => {
    e.preventDefault();
    if (cryScore >= BEATS) return;
    if (cryBeatOn){
      cryScore++;
      haptic('medium');
      burstAt(drum, 10);
      drum.classList.remove('hit'); void drum.offsetWidth; drum.classList.add('hit');
      if (scoreEl) scoreEl.textContent = cryScore + ' / ' + BEATS;
      if (cryScore >= BEATS) completeCry(trial);
    } else {
      haptic('soft');
      cryScore = 0;
      if (scoreEl) scoreEl.textContent = '0 / ' + BEATS;
      drum.classList.remove('miss'); void drum.offsetWidth; drum.classList.add('miss');
    }
  });
}
function cleanupCry(){
  if (cryRAF){ cancelAnimationFrame(cryRAF); cryRAF = null; }
}
async function completeCry(trial){
  haptic('heavy');
  cleanupCry();
  await sleep(300);
  try {
    const r = await api('/trials/' + encodeURIComponent(trial.slug));
    if (!r.ok){ toast('Not ready','warn'); return; }
    const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                   (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    closeSheet();
    rewardSequence(null, { ico:'🥁', title:'Dawn Cry raised!', amount: amount }, () => refresh());
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- 4) SIFT THE ASH — pick one of 5 piles ---------- */
function openSiftSheet(trial){
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Pick a pile. One hides an ember.</div>' +
    '<div class="sift-grid">' +
      Array.from({length:5}).map((_,i) =>
        '<button class="sift-pile" data-act="siftPick" data-val="' + i + '">' +
          '<span class="sift-dust"></span>' +
          '<span class="sift-ico">🪨</span>' +
        '</button>'
      ).join('') +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
}

async function doSift(btn, idx){
  const pile = btn.closest ? btn.closest('.sift-pile') : btn;
  if (!pile || pile.disabled) return;
  $$('.sift-pile').forEach(p => p.disabled = true);
  try {
    const t = (S.trials || []).find(x => x.minigame === 'sift');
    if (!t){ toast('No sift trial available', 'warn'); return; }
    const r = await api('/trials/' + encodeURIComponent(t.slug), { pick: Number(idx) });

    // Dust flies
    pile.classList.add('sifting');
    await sleep(800);

    if (r.hit){
      pile.classList.add('hit');
      pile.querySelector('.sift-ico').textContent = '💎';
      haptic('heavy');
      burstAt(pile, 30);
      await sleep(400);
      const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                     (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
      closeSheet();
      rewardSequence(null, { ico:'💎', title:'Ember found!', amount: amount }, () => refresh());
    } else {
      pile.classList.add('miss');
      pile.querySelector('.sift-ico').textContent = '🖤';
      haptic('soft');
      const correct = $$('.sift-pile')[r.correct];
      if (correct){
        correct.classList.add('reveal');
        correct.querySelector('.sift-ico').textContent = '💎';
      }
      await sleep(1100);
      closeSheet();
      toast('The ash was cold — try again tomorrow', 'warn');
      refresh();
    }
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- fallback: HOLD ---------- */
function openHoldSheet(trial){
  const parts = [];
  if (trial.reward_ember)   parts.push('🔥 +' + fmt(trial.reward_ember));
  if (trial.reward_loyalty) parts.push('❤ +' + fmt(trial.reward_loyalty));
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">' + esc(trial.hint || '') + '</div>' +
    '<div class="hold-wrap">' +
      '<button class="hold-btn" id="holdBtn" data-act="holdStart" data-val="' + esc(trial.slug) + '" type="button">' +
        '<span class="hold-ring"></span>' +
        '<span class="hold-inner">' +
          '<span class="hold-ico">' + esc(trial.glyph || '🔥') + '</span>' +
          '<span class="hold-txt">Hold 2s</span>' +
        '</span>' +
      '</button>' +
      '<div class="hold-reward">' + (parts.join(' · ') || 'Reward') + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:14px">Cancel</button>'
  );
}

let holdRAF = null, holdStartAt = 0;
function holdStart(btn, slug){
  const HOLD_MS = 2000;
  const ring = btn.querySelector('.hold-ring');
  if (!ring) return;
  holdStartAt = performance.now();
  btn.classList.add('holding');
  haptic('light');
  const paint = () => {
    const elapsed = performance.now() - holdStartAt;
    const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
    ring.style.setProperty('--p', pct.toFixed(1));
    if (pct >= 100){
      holdCancelSilent();
      haptic('heavy');
      burstAt(btn, 12);
      api('/trials/' + encodeURIComponent(slug)).then(r => {
        if (!r.ok){ toast('Not ready yet','warn'); return; }
        const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                       (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
        closeSheet();
        rewardSequence(null, { ico:'✓', title:'Trial complete', amount: amount }, () => refresh());
      }).catch(e => toast(e.message, 'bad'));
      return;
    }
    holdRAF = requestAnimationFrame(paint);
  };
  holdRAF = requestAnimationFrame(paint);
}
function holdCancel(){
  const el = document.querySelector('.hold-btn');
  if (el) el.classList.remove('holding');
  holdCancelSilent();
}
function holdCancelSilent(){
  if (holdRAF){ cancelAnimationFrame(holdRAF); holdRAF = null; }
  const el = document.querySelector('.hold-btn');
  if (el){
    el.classList.remove('holding');
    const ring = el.querySelector('.hold-ring');
    if (ring) ring.style.setProperty('--p', '0');
  }
}

/* ---------- ad placeholder ---------- */
function openAdSheet(trial){
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">' + esc(trial.hint || 'Watch a short ad to claim.') + '</div>' +
    '<div class="ad-placeholder"><div class="ad-ico">📺</div>' +
    '<p class="tiny" style="margin:8px 0 0">Rewarded ads are coming soon.</p></div>' +
    '<button class="btn btn-stone btn-block" disabled style="margin-top:14px">Watch ad — coming soon</button>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Close</button>'
  );
}

/* =====================================================================
   Other actions
===================================================================== */
async function actAsh(btn){
  if (btn) btn.disabled = true;
  try {
    const r = await api('/ash/collect');
    if (!r.ok){ toast('The ash pit is still smouldering','warn'); return; }
    burstAt(btn, 18); fxPopAt(btn, '+' + fmt(r.gain)); haptic();
    toast('Gathered ' + r.units + ' Ash → +' + fmt(r.gain) + ' Ember', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}

let tapLock = false;
function tapFire(campfire){
  if (tapLock) return;
  tapLock = true; setTimeout(() => tapLock = false, 420);
  if (campfire){
    campfire.classList.remove('tap');
    void campfire.offsetWidth;
    campfire.classList.add('tap');
  }
  const rect = (campfire || document.body).getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  burstEmbers(cx, cy, 16, 130);

  const u = S.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20*3600*1000){
    haptic('soft');
    fxPop('⏳', cx, cy - 30);
    return;
  }
  api('/checkin').then(r => {
    if (!r.ok){ haptic('soft'); fxPop('⏳', cx, cy - 30); return; }
    haptic('heavy');
    burstEmbers(cx, cy, 24, 170);
    fxPop('+' + fmt(r.reward), cx, cy - 40);
    toast('Daily blessing! +' + fmt(r.reward) + ' Ember · streak ' + r.streak, 'good');
    refresh();
  }).catch(e => toast(e.message, 'bad'));
}

async function actShare(btn){
  try {
    await api('/share');
    if (btn) fxPopAt(btn, '+12 ❤');
    haptic();
    try {
      const link = 'https://t.me/share/url?url=' + encodeURIComponent('https://t.me') + '&text=' + encodeURIComponent('Join my tribe in TRIBES 🔥⚔️');
      if (TG && TG.openTelegramLink) TG.openTelegramLink(link);
    } catch(e){}
    toast('War Chant spread! +12 Loyalty', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- sheet content: create tribe, donate, etc. ---------- */
async function openCreate(){
  sheet(
    '<h3>Found a Tribe</h3>' +
    '<div class="sub">Costs ' + fmt(S.config.foundEmber) + ' Ember · you become Chief</div>' +
    '<div class="field"><input id="tMotto" maxlength="80" placeholder="Battle motto (optional)"/></div>' +
    '<div class="tiny" style="margin:6px 0 8px">Pick a name</div>' +
    '<div id="nameGrid" class="grid2" style="grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"><div class="skeleton" style="height:36px"></div><div class="skeleton" style="height:36px"></div></div>' +
    '<button class="btn btn-primary btn-shine btn-block" data-act="doCreate">Light the First Fire</button>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>'
  );
  try {
    const d = await api('/tribe/names');
    const grid = $('#nameGrid'); if (!grid) return;
    const names = (d.names || []).slice(0, 60);
    if (!names.length){ grid.innerHTML = '<p class="tiny" style="grid-column:span 2">All names claimed.</p>'; return; }
    let pickedId = null;
    grid.innerHTML = names.map(n => '<button class="btn btn-stone" data-act="pickName" data-val="' + n.id + '" style="padding:10px;font-size:.82rem">' + esc(n.name) + '</button>').join('');
    window.__pickName = (id) => { pickedId = id; };
    grid.querySelectorAll('[data-act="pickName"]').forEach(b => {
      b.addEventListener('click', () => {
        grid.querySelectorAll('.btn').forEach(x => x.style.borderColor = 'var(--line)');
        b.style.borderColor = 'var(--gold)';
        pickedId = Number(b.dataset.val);
      });
    });
    const doCreate = $('#doCreateBtn') || null;
    window.__doCreate = async (btn) => {
      if (!pickedId){ toast('Pick a name', 'warn'); return; }
      const motto = ($('#tMotto')?.value || '').trim();
      try {
        await api('/tribe/create', { nameId: pickedId, motto, palette: 'ember', banner: 'sun', crest: 'totem' });
        closeSheet(); haptic('medium'); toast('Your tribe is born!', 'good'); await refresh();
      } catch(e){ toast(e.message, 'bad'); }
    };
  } catch(e){}
}

function openDonate(){
  sheet(
    '<h3>Stoke the Great Pyre</h3>' +
    '<div class="sub">You hold ' + fmt(S.user.ember) + ' Ember</div>' +
    '<div class="field"><input id="dAmt" type="number" min="1" placeholder="Ember to donate"/></div>' +
    '<button class="btn btn-primary btn-shine btn-block" data-act="doDonate">Donate to the Pyre</button>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>'
  );
}
async function doDonate(btn){
  const amt = Math.floor(Number($('#dAmt')?.value) || 0);
  if (amt < 1){ toast('Enter an amount', 'warn'); return; }
  try {
    const r = await api('/tribe/donate', { amount: amt });
    closeSheet(); haptic('medium');
    toast('Donated ' + fmt(r.donated) + ' Ember to the Pyre', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

async function actJoin(btn, id){
  try {
    await api('/tribe/join', { tribeId: Number(id) });
    haptic(); toast('You joined the fire!', 'good'); await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}
async function actLeave(){
  try { await api('/tribe/leave'); toast('You left the tribe', 'warn'); await refresh(); }
  catch(e){ toast(e.message, 'bad'); }
}

async function actUpgrade(){
  try {
    const r = await api('/tribe/upgrade');
    haptic('heavy');
    toast('Risen to ' + r.name + '!', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- Kiva ---------- */
let kivaEs = null, kivaPoll = null, kivaLastId = 0, kivaOpen = false;
async function openKiva(){
  if (!S.tribe) return;
  kivaOpen = true;
  sheet(
    '<div class="kiva-sheet">' +
      '<div class="kiva-head"><b>' + esc(S.tribe.name) + ' — Kiva</b>' +
      '<button class="btn btn-ghost" data-act="closeSheet" style="padding:6px 10px;font-size:.72rem">Close</button></div>' +
      '<div class="kiva-feed" id="kivaFeed"><div class="skeleton" style="height:44px"></div></div>' +
      '<div class="kiva-compose"><input id="kivaInput" maxlength="280" placeholder="Say something…"/>' +
      '<button class="send" data-act="sendKiva">➤</button></div>' +
    '</div>'
  );
  await loadKiva(); connectKivaStream();
}
async function loadKiva(){
  try {
    const d = await api('/kiva');
    const rows = d.messages || [];
    kivaLastId = rows.length ? rows[rows.length-1].id : 0;
    renderKivaFeed(rows);
  } catch(e){ const f = $('#kivaFeed'); if (f) f.innerHTML = '<p class="tiny">Could not reach the Kiva.</p>'; }
}
function renderKivaFeed(rows){
  const feed = $('#kivaFeed'); if (!feed) return;
  feed.innerHTML = rows.map(m => kivaMsgHtml(m)).join('');
  feed.scrollTop = feed.scrollHeight;
}
function kivaMsgHtml(m){
  if (m.kind === 'system' || m.kind === 'war' || m.kind === 'level'){
    return '<div class="kiva-msg system"><b>' + esc(m.body) + '</b></div>';
  }
  const mine = S.user && m.user_id === S.user.id;
  const role = (m.role || '').toLowerCase();
  const roleTag = (role && role !== 'toddler') ? '<span class="km-role">' + esc(m.role) + '</span>' : '';
  const canPin = ['Chief','Head','Elder'].includes(S.user.role);
  return '<div class="kiva-msg ' + (mine?'self':'') + '" data-mid="' + m.id + '">' +
    '<div class="km-av">' + esc((m.first_name || '?').slice(0,1).toUpperCase()) + '</div>' +
    '<div class="km-body"><div class="km-meta"><span class="km-name">' + esc(m.first_name || m.username || 'Kin') + '</span>' + roleTag + '</div>' +
    '<div class="km-text">' + esc(m.body) + '</div>' +
    (canPin ? '<div class="km-actions"><button data-act="pinKiva" data-val="' + m.id + '">Pin</button></div>' : '') +
    '</div></div>';
}
function connectKivaStream(){
  if (!S.tribe) return;
  try {
    kivaEs = new EventSource('/api/kiva/stream?tribeId=' + encodeURIComponent(S.tribe.id));
    let opened = false;
    const guard = setTimeout(() => { if (!opened && kivaEs){ kivaEs.close(); kivaEs = null; startKivaPoll(); } }, 3000);
    kivaEs.onopen = () => { opened = true; clearTimeout(guard); if (kivaPoll){ clearInterval(kivaPoll); kivaPoll = null; } };
    kivaEs.onmessage = ev => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'message' && msg.message && msg.message.id > kivaLastId){
          kivaLastId = msg.message.id;
          const feed = $('#kivaFeed');
          if (feed){ feed.insertAdjacentHTML('beforeend', kivaMsgHtml(msg.message)); feed.scrollTop = feed.scrollHeight; }
        }
      } catch(e){}
    };
  } catch(e){ startKivaPoll(); }
}
function startKivaPoll(){
  if (kivaPoll) return;
  kivaPoll = setInterval(async () => {
    if (!kivaOpen){ clearInterval(kivaPoll); kivaPoll = null; return; }
    try {
      const d = await api('/kiva?since=' + kivaLastId);
      const rows = d.messages || [];
      const feed = $('#kivaFeed');
      for (const m of rows){
        if (m.id > kivaLastId){ kivaLastId = m.id; if (feed){ feed.insertAdjacentHTML('beforeend', kivaMsgHtml(m)); feed.scrollTop = feed.scrollHeight; } }
      }
    } catch(e){}
  }, 6000);
}
async function sendKiva(){
  const inp = $('#kivaInput'); if (!inp) return;
  const body = inp.value.trim(); if (!body) return;
  inp.value = '';
  try { await api('/kiva', { body }); haptic(); }
  catch(e){ toast(e.message, 'bad'); inp.value = body; }
}
async function pinKiva(id){
  try { await api('/kiva/pin', { id: Number(id), pinned: true }); toast('Pinned'); }
  catch(e){ toast(e.message, 'bad'); }
}

/* ---------- War actions ---------- */
let selectedFront = 0;
function pickFront(btn, idx){
  selectedFront = Number(idx);
  $$('.fp-btn').forEach(b => b.classList.toggle('active', Number(b.dataset.val) === selectedFront));
  haptic('light');
}
async function actWarAction(btn, kind){
  if (btn) btn.disabled = true;
  try {
    const r = await api('/war/action', { front: selectedFront, kind });
    haptic('heavy'); burstAt(btn, 18); fxPopAt(btn, '+' + fmt(r.points));
    toast(kind + ' · +' + fmt(r.points), 'good');
    loadWar();
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}
async function actDeclare(){
  try {
    const chosen = 'skirmish';
    const r = await api('/war/declare', { stance: chosen });
    haptic('heavy');
    toast('War declared against ' + r.war.defender.name + '!', 'good');
    await refresh(); loadWar();
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- payments ---------- */
async function buyStars(itemId){
  if (!TG){ toast('Open in Telegram to pay with Stars', 'warn'); return; }
  try {
    const link = (await api('/stars/invoice', { itemId })).link;
    haptic('medium');
    TG.openInvoice(link, async status => {
      if (status === 'paid'){ toast('Payment complete!', 'good'); setTimeout(refresh, 1400); }
      else if (status === 'failed') toast('Payment failed', 'bad');
      else if (status === 'cancelled') toast('Payment cancelled', 'warn');
    });
  } catch(e){ toast(e.message, 'bad'); }
}
async function shopTab(btn, key){
  $$('.shop-tab').forEach(b => b.classList.toggle('active', b.dataset.val === key));
  $$('.shop-section').forEach(s => s.style.display = (s.dataset.section === key ? '' : 'none'));
}

/* ---------- refresh ---------- */
async function refresh(){
  try {
    S = await api('/state');
    applyPalette();
    renderAll();
  } catch(e){ console.warn(e); }
}
window.refresh = refresh;

/* =====================================================================
   Action registry
===================================================================== */
const ACTS = {
  peel:        (btn, tab) => peelTo(tab, btn.closest('.dash-card')),
  tapFire:     (btn) => tapFire(btn),
  ash:         actAsh,
  trial:       actTrial,
  holdStart:   (btn, slug) => holdStart(btn, slug),
  siftPick:    (btn, i) => doSift(btn, i),
  share:       actShare,
  openCreate, doCreate: (btn) => window.__doCreate && window.__doCreate(btn),
  pickName:    (btn, id) => window.__pickName && window.__pickName(id),
  join:        actJoin, leave: actLeave,
  openDonate, doDonate,
  openKiva, sendKiva, pinKiva,
  upgrade:     actUpgrade,
  buyStars:    (btn, id) => buyStars(id),
  declareWar:  actDeclare,
  pickFront,
  warAction:   actWarAction,
  shopTab,
  closeSheet:  () => closeSheet(),
  bgClose:     (btn, v, e) => { if (e && e.target && e.target.classList && e.target.classList.contains('sheet-bg')) closeSheet(); },
};

/* =====================================================================
   Init
===================================================================== */
function init(){
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b){ const f = ACTS[b.dataset.act]; if (f){ f(b, b.dataset.val, e); return; } }
    const card = e.target.closest('.dash-card');
    if (card){ peelTo(card.dataset.tab, card); return; }
  });

  document.addEventListener('pointerdown', e => {
    const holdBtn = e.target.closest('.hold-btn');
    if (holdBtn){ e.preventDefault(); holdStart(holdBtn, holdBtn.dataset.val); return; }
  });
  document.addEventListener('pointerup', holdCancel);
  document.addEventListener('pointercancel', holdCancel);

  const rb = $('#retryBtn'); if (rb) rb.addEventListener('click', () => boot());
  const gr = $('#gateRetry'); if (gr) gr.addEventListener('click', () => boot());

  boot();
  buildNav();
}

init();

/* End of file. Last line should be: init(); */