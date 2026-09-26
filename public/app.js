/* =====================================================================
   TRIBES — Mini App client.
   Sections: boot → onboarding → Ember Row nav → dashboard → detail screens
   → trials → X quests → spin → daily quests → profile → settings.
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
    TG.ready();
    TG.expand();
    TG.setHeaderColor && TG.setHeaderColor('#0a0908');
    TG.setBackgroundColor && TG.setBackgroundColor('#0a0908');
    TG.enableClosingConfirmation && TG.enableClosingConfirmation();
  }
}catch(e){}

/* ---------- primitives ---------- */
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const el = (t, c, h) => { const n = document.createElement(t); if (c) n.className = c; if (h != null) n.innerHTML = h; return n; };
const fmt = n => {
  n = Number(n) || 0;
  return n >= 1e6 ? (n/1e6).toFixed(2) + 'M'
       : n >= 1e3 ? (n/1e3).toFixed(1) + 'k'
       : Math.floor(n).toLocaleString();
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PERF = window.__tribes_perf || null;
const TIER = () => document.documentElement.getAttribute('data-tier') || 'mid';

/* ---------- settings ---------- */
const SETTINGS_KEY = 'tribes.settings';
function getSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch(e){ return {}; }
}
function saveSettings(patch){
  const s = { ...getSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  applySettings();
  return s;
}
function applySettings(){
  const s = getSettings();
  window.__hapticsEnabled = s.haptics !== false;
  window.__soundEnabled   = s.sound !== false;
  document.documentElement.setAttribute('data-fx', s.reducedFx ? 'reduced' : 'full');
}

/* ---------- haptics (respects setting) ---------- */
function haptic(tier){
  try{
    if (window.__hapticsEnabled === false) return;
    if (!TG || !TG.HapticFeedback) return;
    tier = tier || 'light';
    if (tier === 'select')     TG.HapticFeedback.selectionChanged();
    else if (tier === 'heavy') TG.HapticFeedback.impactOccurred('heavy');
    else if (tier === 'medium')TG.HapticFeedback.impactOccurred('medium');
    else                       TG.HapticFeedback.impactOccurred('light');
  }catch(e){}
}

/* ---------- toast ---------- */
function toast(msg, kind, ico){
  kind = kind || '';
  ico = ico || (kind === 'good' ? 'status-approved'
            : kind === 'bad'   ? 'status-rejected'
            : kind === 'warn'  ? 'status-warn'
            : 'status-info');
  const root = $('#toastRoot');
  if (!root) return;
  const t = el('div', 'toast ' + kind,
    '<span class="t-ico"><span data-icon="' + ico + '" data-icon-size="14"></span></span>' +
    '<span>' + esc(msg) + '</span>');
  root.appendChild(t);
  if (window.hydrateIcons) window.hydrateIcons();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2600);
}

/* ---------- FX ---------- */
const fxRoot = () => $('#fxRoot');
function fxPop(text, x, y){
  const r = fxRoot(); if (!r) return;
  const p = el('div', 'fx-pop', esc(text));
  p.style.left = x + 'px'; p.style.top = y + 'px';
  r.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}
function burstEmbers(x, y, count, spread){
  count = count || 14; spread = spread || 110;
  const r = fxRoot(); if (!r) return;
  if (TIER() === 'low' || TIER() === 'ultra-saver') return;
  for (let i = 0; i < count; i++){
    const a = (Math.PI * 2) * (i / count) + (Math.random() * 0.5);
    const dist = spread * (0.55 + Math.random() * 0.6);
    const dx = Math.cos(a) * dist, dy = Math.sin(a) * dist - 20;
    const e = el('div', 'fx-ember');
    e.style.left = (x - 3) + 'px'; e.style.top = (y - 3) + 'px';
    const sz = 4 + Math.random() * 5;
    e.style.width = sz + 'px'; e.style.height = sz + 'px';
    e.style.transition = 'transform 900ms cubic-bezier(.15,.75,.3,1), opacity 900ms ease-out';
    r.appendChild(e);
    requestAnimationFrame(() => {
      e.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(.3)';
      e.style.opacity = '0';
    });
    setTimeout(() => e.remove(), 1100);
  }
}
function burstAt(node, count){
  if (!node) return;
  const r = node.getBoundingClientRect();
  burstEmbers(r.left + r.width/2, r.top + r.height/2, count);
}
function fxPopAt(node, text){
  if (!node) return;
  const r = node.getBoundingClientRect();
  fxPop(text, r.left + r.width/2, r.top + r.height/2);
}
function animateCounter(node, to, dur){
  if (!node) return;
  dur = dur || 520;
  const from = Number(node.dataset.v || node.textContent.replace(/[^\d.-]/g, '')) || 0;
  to = Number(to) || 0;
  if (from === to){ node.dataset.v = to; node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = now => {
    const k = clamp((now - t0) / dur, 0, 1);
    const e = 1 - Math.pow(1 - k, 3);
    node.textContent = fmt(Math.round(from + (to - from) * e));
    if (k < 1) requestAnimationFrame(step);
    else { node.dataset.v = to; node.textContent = fmt(to); }
  };
  requestAnimationFrame(step);
}

/* ---------- guest ---------- */
let GUEST = localStorage.getItem('tribes.guest');
if (!GUEST){
  GUEST = 'g' + String(Math.floor(Math.random() * 9e9) + 1e9);
  localStorage.setItem('tribes.guest', GUEST);
}

/* ---------- API ---------- */
async function api(path, body, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if (TG && TG.initData) headers['X-Init-Data'] = TG.initData;
  headers['X-Guest-Id'] = GUEST;

  const READ_PATHS = new Set(['/state','/health','/war','/war/chronicle','/war/leaderboard','/war/tactics','/war/hint','/war/wiki','/war/vengeance','/war/alliances','/tribes','/tribe/names','/kiva','/bonfire','/cosmetics','/trials','/referral','/relics/state','/relics/packs','/relics/events','/relics/fusion','/spies']);
  const pathOnly = path.split('?')[0];
  const method = opts.method
    || (body !== undefined ? 'POST' : (READ_PATHS.has(pathOnly) ? 'GET' : 'POST'));

  const r = await fetch('/api' + path, {
    method,
    headers,
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
  });
  let j = {};
  try { j = await r.json(); } catch(e){}
  if (!r.ok){
    const err = new Error(j.error || ('HTTP ' + r.status));
    err.status = r.status;
    err.data = j;
    throw err;
  }
  return j;
}

/* ---------- icon helpers ---------- */
function iconSpan(name, cls, size){
  const parts = ['data-icon="' + name + '"'];
  if (cls) parts.push('data-icon-class="' + cls + '"');
  if (size) parts.push('data-icon-size="' + size + '"');
  return '<span ' + parts.join(' ') + '></span>';
}

/* ---------- global state ---------- */
let S = null;
let TAB = 'home';
const RANK_KEY = 'tribes.nav.order';

const NAV_POOL = [
  { id:'fire',    label:'Home',   ico:'home-fire',      filled:'home-fire' },
  { id:'war',     label:'War',    ico:'war-swords',     filled:'war-swords' },
  { id:'trials',  label:'Trials', ico:'trials-scroll',  filled:'trials-scroll' },
  { id:'ranks',   label:'Ranks',  ico:'ranks-crown',    filled:'ranks-crown' },
  { id:'tribe',   label:'Tribe',  ico:'tribe-shield',   filled:'tribe-shield' },
  { id:'kiva',    label:'Kiva',   ico:'kiva-flame',     filled:'kiva-flame' },
  { id:'store',   label:'Store',  ico:'store-bag',      filled:'store-bag' },
  { id:'profile', label:'You',    ico:'profile-user',   filled:'profile-user' },
];

const TAB_TO_SCREEN = {
  fire:'home', home:'home', war:'war', trials:'trials',
  ranks:'ranks', tribe:'tribe', kiva:'kiva',
  store:'store', profile:'profile', settings:'settings', relics:'relics',
};

/* =====================================================================
   Boot + onboarding
===================================================================== */
function setBoot(msg, retry){
  const b = $('#bootMsg');
  if (b) b.textContent = msg;
  const rb = $('#retryBtn');
  if (rb) rb.style.display = retry ? 'inline-flex' : 'none';
}

function hasOnboarded(){ return localStorage.getItem('tribes.onboarded') === '1'; }

async function boot(){
  applySettings();
  setBoot('loading');
  try { await api('/health'); } catch(e){}
  try { S = await api('/state'); }
  catch(e){
    if (e.status === 401 && e.data && e.data.error === 'no_username'){ showUsernameGate(); return; }
    if (e.status === 401){ setBoot('Open TRIBES inside Telegram to gather at the fire.', true); return; }
    if (e.status === 503){ setBoot('The elders are tending the fire — try again soon.', true); return; }
    if (e.status === 403 && e.data && e.data.error === 'banned'){
      setBoot('You were banished: ' + (e.data.reason || ''), false); return;
    }
    setBoot('The fire could not be reached — ' + (e.message || 'try again.'), true);
    return;
  }
  try { initTon(); applyPalette(); } catch(e){ console.error(e); }
  await playBootThenShow();
}

async function playBootThenShow(){
  const bootEl = $('#boot');
  if (bootEl){ bootEl.style.background = '#000'; setBoot('loading'); }
  await sleep(400);

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

  const letters = $$('.boot-letter');
  letters.forEach((l, i) => { l.style.animationDelay = (i * 80) + 'ms'; });
  const sub = $('.boot-sub');
  if (sub) sub.style.opacity = '1';
  await sleep(800);

  if (bootEl){
    bootEl.classList.add('gone');
    setTimeout(() => { bootEl.style.display = 'none'; }, 600);
  }
  const app = $('#app'); if (app) app.style.display = 'block';
  const gate = $('#gate'); if (gate) gate.style.display = 'none';
  await sleep(600);

  if (!hasOnboarded()){
    try { await runOnboarding(); localStorage.setItem('tribes.onboarded', '1'); }
    catch(err){ console.error('Onboarding error:', err); renderAll(); }
  } else {
    renderAll();
  }
  buildNav();
}

async function runOnboarding(){
  const app = $('#app'); if (!app) return;

  const step1 = el('div', 'ob-step');
  step1.innerHTML =
    '<div class="ob-ember"></div>' +
    '<p class="ob-line">You wake at the fire.</p>' +
    '<p class="ob-line ob-delay">But the tribe does not know your name.</p>' +
    '<button class="ob-btn" id="obBtn1">Give your name</button>';
  app.appendChild(step1);
  await new Promise(resolve => {
    $('#obBtn1').addEventListener('click', () => { haptic('light'); resolve(); });
  });
  step1.classList.add('leaving');
  await sleep(400);
  step1.remove();

  const step2 = el('div', 'ob-step');
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
      const ripple = el('div', 'ob-ripple');
      step2.appendChild(ripple);
      await sleep(500);
      resolve();
    });
  });
  step2.classList.add('leaving');
  await sleep(400);
  step2.remove();

  renderAll();
  const cards = $$('.dash-card');
  cards.forEach((c, i) => {
    c.style.animationDelay = (i * 60) + 'ms';
    c.classList.add('reveal');
  });
}

function showUsernameGate(){
  const boot = $('#boot'); if (boot) boot.style.display = 'none';
  const gate = $('#gate'); if (gate) gate.style.display = 'grid';
  if (window.hydrateIcons) window.hydrateIcons();
}

/* =====================================================================
   Ember Row navigation
===================================================================== */
let navMinimized = false;
let lastScrollY = 0;
let activeNavId = 'fire';

function currentNavOrder(){
  try {
    const raw = localStorage.getItem(RANK_KEY);
    if (!raw) return ['fire','war','trials','ranks','profile'];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr[0] !== 'fire') return ['fire','war','trials','ranks','profile'];
    return arr.slice(0, 5);
  } catch(e){ return ['fire','war','trials','ranks','profile']; }
}

function buildNav(){
  const nav = $('.tabbar');
  if (!nav) return;
  const order = currentNavOrder();
  nav.innerHTML = '';
  order.forEach(id => {
    const meta = NAV_POOL.find(n => n.id === id);
    if (!meta) return;
    const btn = el('button', 'tab');
    btn.dataset.tab = meta.id;
    btn.setAttribute('data-active', meta.id === activeNavId ? 'true' : 'false');
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
  const nav = $('.tabbar'); if (!nav) return;
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

  btn.addEventListener('pointerdown', () => {
    longFired = false;
    longTimer = setTimeout(() => {
      longFired = true;
      haptic('medium');
      showTabMenu(id, btn);
    }, 500);
  });

  const cancel = () => { if (longTimer){ clearTimeout(longTimer); longTimer = null; } };
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointercancel', cancel);
  btn.addEventListener('pointerleave', cancel);

  btn.addEventListener('click', () => {
    if (longFired) return;
    haptic('light');
    setTab(id);
    const nav = $('.tabbar');
    if (nav){
      nav.dataset.surge = 'true';
      setTimeout(() => nav.dataset.surge = 'false', 300);
    }
  });
}

function showTabMenu(id, btn){
  closeTabMenu();
  const menu = el('div', 'tab-menu');
  const options = MENU_FOR[id] || [{ label:'Open', icon:'arrow-right', action: () => setTab(id) }];
  options.forEach(o => {
    const b = el('button', '',
      '<span data-icon="' + (o.icon || 'arrow-right') + '"></span>' +
      '<span>' + esc(o.label) + '</span>');
    b.addEventListener('click', () => { closeTabMenu(); o.action(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  if (window.hydrateIcons) window.hydrateIcons();
  const r = btn.getBoundingClientRect();
  menu.style.left = Math.max(12, Math.min(window.innerWidth - 200, r.left + r.width/2 - 90)) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', outsideMenu, true), 10);
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
  fire:    [{ label:'Scroll to top', icon:'arrow-up', action: () => window.scrollTo({ top:0, behavior:'smooth' }) }],
  war:     [{ label:'War status',   icon:'war-swords', action: () => setTab('war') }],
  trials:  [{ label:'Open trials',  icon:'trials-scroll', action: () => setTab('trials') }],
  ranks:   [{ label:'My rank',      icon:'ranks-crown', action: () => setTab('ranks') }],
  tribe:   [{ label:'My tribe',     icon:'tribe-shield', action: () => setTab('tribe') }],
  kiva:    [{ label:'Open Kiva',    icon:'kiva-flame', action: () => openKiva() }],
  store:   [{ label:'Featured item',icon:'store-bag', action: () => setTab('store') }],
  profile: [{ label:'My profile',   icon:'profile-user', action: () => setTab('profile') }],
};

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
function setTab(navId){
  activeNavId = navId;
  const screenId = TAB_TO_SCREEN[navId] || navId;
  TAB = screenId;
  buildNav();
  renderAll();
}

/* =====================================================================
   Palette + TON
===================================================================== */
function applyPalette(){
  const p = (S && S.tribe && S.tribe.palette) || 'ember';
  document.documentElement.setAttribute('data-palette', p);
  const hue = (S && S.tribe && S.tribe.hue) || 0;
  document.documentElement.style.setProperty('--thue', hue + 'deg');
}

let tonUI = null, tonAddr = null;
function initTon(){
  try {
    const NS = window.TON_CONNECT_UI;
    if (!NS) return;
    tonUI = new NS.TonConnectUI({ manifestUrl: location.origin + '/tonconnect-manifest.json' });
    tonUI.onStatusChange(async w => {
      tonAddr = (w && w.account) ? w.account.address : null;
      updateTonChip();
      if (tonAddr){ try { await api('/ton/link', { address: tonAddr }); } catch(e){} }
    });
    const acc = tonUI.account;
    if (acc){ tonAddr = acc.address; updateTonChip(); }
  } catch(e){ console.warn('TON init', e); }
}
function updateTonChip(){
  const b = $('#tonBtn'); if (!b) return;
  if (tonAddr){ b.classList.add('on'); b.textContent = '◈ ' + tonAddr.slice(0,4) + '…' + tonAddr.slice(-3); }
  else { b.classList.remove('on'); b.textContent = 'Connect'; }
}

/* =====================================================================
   Render dispatcher
===================================================================== */
let SCREENS_BUILT = false;

function renderAll(){
  renderTop();
  renderDashboard();
}

function renderTop(){
  const u = S.user, t = S.tribe;
  const crest = $('#crestArt');
  if (crest) crest.innerHTML = iconSpan(t ? 'tribe-shield' : 'profile-user', '', 20);
  const tn = $('#tribeName'); if (tn) tn.textContent = t ? t.name : 'No Tribe';
  const rn = $('#roleName'); if (rn) rn.textContent = u.role || 'Wanderer';
  animateCounter($('#emberVal'), u.ember);
  updateTonChip();
  if (window.hydrateIcons) window.hydrateIcons();
}

const DASH_LAYOUT = [
  { id:'campfire', tab:'fire',    size:'hero',  fixed:true },
  { id:'war',      tab:'war',     size:'pair' },
  { id:'ranks',    tab:'ranks',   size:'pair' },
  { id:'daily',    tab:'trials',  size:'wide' },
  { id:'spin',     tab:'trials',  size:'pair' },
  { id:'tribe',    tab:'tribe',   size:'pair' },
  { id:'trials',   tab:'trials',  size:'pair' },
  { id:'store',    tab:'store',   size:'pair' },
  { id:'profile',  tab:'profile', size:'pair' },
];

function renderDashboard(){
  const host = $('#screens'); if (!host) return;

  if (!SCREENS_BUILT){
    host.innerHTML =
      '<section class="screen" id="sc-home"></section>' +
      '<section class="screen" id="sc-war"></section>' +
      '<section class="screen" id="sc-trials"></section>' +
      '<section class="screen" id="sc-ranks"></section>' +
      '<section class="screen" id="sc-tribe"></section>' +
      '<section class="screen" id="sc-kiva"></section>' +
      '<section class="screen" id="sc-store"></section>' +
      '<section class="screen" id="sc-relics"></section>' +
      '<section class="screen" id="sc-profile"></section>' +
      '<section class="screen" id="sc-settings"></section>';
    buildHomeGrid();
    SCREENS_BUILT = true;
  }

  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'sc-' + TAB));

  if (TAB === 'home')    patchHomeCards();
  if (TAB === 'trials')  renderTrialsScreen($('#sc-trials'));
  if (TAB === 'war')     renderWarScreen($('#sc-war'));
  if (TAB === 'ranks')   renderRanksScreen($('#sc-ranks'));
  if (TAB === 'tribe')   renderTribeScreen($('#sc-tribe'));
  if (TAB === 'kiva')    renderKivaScreen($('#sc-kiva'));
  if (TAB === 'store')   renderStoreScreen($('#sc-store'));
  if (TAB === 'relics')  renderRelicsScreen($('#sc-relics'));
  if (TAB === 'profile') renderProfileScreen($('#sc-profile'));
  if (TAB === 'settings')renderSettingsScreen($('#sc-settings'));

  if (window.hydrateIcons) window.hydrateIcons();
}

function buildHomeGrid(){
  const home = $('#sc-home');
  home.innerHTML = '<div class="dash-grid">' +
    DASH_LAYOUT.map(meta => renderCardShell(meta)).join('') +
    '</div>';
  requestAnimationFrame(() => {
    $$('#sc-home .dash-card').forEach((c, i) => {
      c.style.animationDelay = (i * 60) + 'ms';
      c.classList.add('reveal');
    });
  });
}

function renderCardShell(meta){
  switch(meta.id){
    case 'campfire': return '<div class="dash-card dash-campfire" id="dash-campfire" data-tab="fire" data-act="peel" data-val="fire"></div>';
    case 'war':      return '<div class="dash-card dash-war" id="dash-war" data-tab="war" data-act="peel" data-val="war"></div>';
    case 'ranks':    return '<div class="dash-card dash-ranks" id="dash-ranks" data-tab="ranks" data-act="peel" data-val="ranks"></div>';
    case 'daily':    return '<div class="dash-card dash-daily" id="dash-daily" data-tab="trials" data-act="peel" data-val="trials"></div>';
    case 'spin':     return '<div class="dash-card dash-spin" id="dash-spin" data-tab="trials" data-act="peel" data-val="trials"></div>';
    case 'tribe':    return '<div class="dash-card dash-tribe" id="dash-tribe" data-tab="tribe" data-act="peel" data-val="tribe"></div>';
    case 'trials':   return '<div class="dash-card dash-trials" id="dash-trials" data-tab="trials" data-act="peel" data-val="trials"></div>';
    case 'store':    return '<div class="dash-card dash-store" id="dash-store" data-tab="store" data-act="peel" data-val="store"></div>';
    case 'profile':  return '<div class="dash-card dash-profile" id="dash-profile" data-tab="profile" data-act="peel" data-val="profile"></div>';
    default: return '';
  }
}

/* ---------- patch dashboard cards ---------- */
function patchHomeCards(){
  const u = S.user, t = S.tribe;

  // campfire
  const cf = $('#dash-campfire');
  if (cf){
    const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
    const readyIn = (last + 20*3600*1000) - Date.now();
    const ready = readyIn <= 0;
    const pct = clamp(100 * (1 - readyIn/(20*3600*1000)), 0, 100);
    cf.innerHTML =
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
      '<div class="dash-campfire-foot">' + (ready ? 'Tap to feed it' : 'Feeds again in ' + fmtDur(readyIn)) + '</div>' +
      '<div class="dash-ring" style="--p:' + (ready ? 100 : pct).toFixed(0) + '"></div>';
  }

  // war
  const wr = $('#dash-war');
  if (wr){
    if (!u.tribe_id){
      wr.classList.add('muted');
      wr.innerHTML =
        '<div class="dash-card-head">' +
          iconSpan('war-swords', 'ico-rust', 16) +
          '<span>WAR</span>' +
        '</div>' +
        '<div class="dash-card-body"><div class="dash-card-big">—</div>' +
        '<div class="dash-card-sub">Join a tribe</div></div>';
    } else {
      wr.classList.remove('muted');
      const w = S.war || null;
      const fronts = (w && w.fronts) || [{}, {}, {}];
      const dots = fronts.map(f => {
        const a = Number(f.attacker_score || 0), d = Number(f.defender_score || 0);
        if (a > d) return '<span class="war-dot lit"></span>';
        if (d > a) return '<span class="war-dot"></span>';
        return '<span class="war-dot half"></span>';
      }).join('');
      const timeLeft = w && w.end_at ? fmtDur(new Date(w.end_at).getTime() - Date.now()) : '—';
      wr.innerHTML =
        '<div class="dash-card-head">' + iconSpan('war-swords', 'ico-rust', 16) + '<span>WAR</span></div>' +
        '<div class="war-dots">' + dots + '</div>' +
        '<div class="dash-card-foot">' + esc(timeLeft) + '</div>';
    }
  }

  // ranks
  const rk = $('#dash-ranks');
  if (rk){
    const lb = S.leaderboard || [];
    const mine = t ? Number(t.id) : null;
    let rank = '—';
    if (mine){
      const i = lb.findIndex(x => Number(x.id) === mine);
      if (i >= 0) rank = '#' + (i+1);
    }
    const topThree = lb.slice(0, 3).map(x => '<div class="mini-row">' + esc(x.name) + '</div>').join('') || '';
    rk.innerHTML =
      '<div class="dash-card-head">' + iconSpan('ranks-crown', 'ico-rust', 16) + '<span>RANKS</span></div>' +
      '<div class="dash-card-body"><div class="dash-card-big">' + esc(rank) + '</div>' +
      '<div class="dash-card-sub">' + esc(t ? t.name : 'No tribe') + '</div></div>' +
      '<div class="mini-list">' + topThree + '</div>';
  }

  // daily
  const dl = $('#dash-daily');
  if (dl){
    const dq = S.dailyQuests || [];
    const done = dq.filter(q => q.claimed).length;
    dl.innerHTML =
      '<div class="dash-card-head">' + iconSpan('trials-scroll', 'ico-rust', 16) + '<span>DAILY</span></div>' +
      '<div class="dash-card-body">' +
        '<div class="dash-card-big">' + done + '/' + dq.length + '</div>' +
        '<div class="dash-card-sub">' + (dq.length - done > 0 ? (dq.length - done) + ' remaining today' : 'All done — nice!') + '</div>' +
      '</div>';
  }

  // spin
  const sp = $('#dash-spin');
  if (sp){
    const spin = S.spin || { freeAvailable: false };
    sp.innerHTML =
      '<div class="dash-card-head">' + iconSpan('spin-stone', 'ico-rust', 16) + '<span>SPIN</span></div>' +
      '<div class="dash-card-body">' +
        '<div class="dash-card-big">' + (spin.freeAvailable ? 'FREE' : '⏳') + '</div>' +
        '<div class="dash-card-sub">' + (spin.freeAvailable ? 'Ready now' : 'Come back tomorrow') + '</div>' +
      '</div>';
  }

  // tribe
  const tr = $('#dash-tribe');
  if (tr){
    if (!t){
      tr.innerHTML =
        '<div class="dash-card-head">' + iconSpan('tribe-shield', 'ico-rust', 16) + '<span>TRIBE</span></div>' +
        '<div class="dash-card-body"><div class="dash-card-big">—</div>' +
        '<div class="dash-card-sub">Found or join a tribe</div></div>';
    } else {
      const lvl = (t.level || 1);
      const cap = (S.config.levelTable.caps[lvl-1] || 5);
      const pct = clamp((Number(t.treasury) || 0) / Math.max(1, Number(t.treasury) + 25000) * 100, 3, 100);
      tr.innerHTML =
        '<div class="dash-card-head">' + iconSpan('tribe-shield', 'ico-rust', 16) + '<span>' + esc(t.name) + '</span></div>' +
        '<div class="dash-card-foot">' + (t.members || 0) + '/' + cap + ' kin</div>' +
        '<div class="pyre-bar"><i style="width:' + pct + '%"></i></div>';
    }
  }

  // trials
  const tl = $('#dash-trials');
  if (tl){
    const ts = S.trials || [];
    const ready = ts.filter(t => t.available).length;
    const cooling = ts.length - ready;
    const dots = ts.slice(0, 5).map(t => '<span class="trial-dot ' + (t.available ? 'lit' : '') + '"></span>').join('');
    const names = ts.filter(t => t.available).map(t => esc(t.name)).join(' · ') || 'All on cooldown';
    tl.innerHTML =
      '<div class="dash-card-head">' + iconSpan('trials-scroll', 'ico-rust', 16) + '<span>TRIALS</span></div>' +
      '<div class="trial-dots">' + dots + '</div>' +
      '<div class="dash-card-foot">' + ready + ' ready' + (cooling ? ' · ' + cooling + ' cooling' : '') + '</div>' +
      '<div class="trial-names">' + names + '</div>';
  }

  // store
  const st = $('#dash-store');
  if (st){
    st.innerHTML =
      '<div class="dash-card-head">' + iconSpan('store-bag', 'ico-rust', 16) + '<span>STORE</span></div>' +
      '<div class="dash-card-body"><div class="dash-card-big">' +
      iconSpan('res-stars', '', 32) + '</div>' +
      '<div class="dash-card-sub">Trading Post</div></div>' +
      '<div class="dash-card-foot">⭐ ' + fmt(u.stars || 0) + '</div>';
  }

  // profile
  const pr = $('#dash-profile');
  if (pr){
    const roleLbl = u.role || 'Wanderer';
    pr.innerHTML =
      '<div class="dash-card-head">' + iconSpan('profile-user', 'ico-rust', 16) + '<span>YOU</span></div>' +
      '<div class="profile-chip">' +
        '<div class="profile-avatar">' + esc((u.first_name || '?').slice(0,1).toUpperCase()) + '</div>' +
        '<div class="profile-meta"><b>' + esc(u.first_name || u.username || 'Kin') + '</b><span>' + esc(roleLbl) + '</span></div>' +
      '</div>' +
      '<div class="dash-card-foot">' + fmt(u.ember) + ' Ember</div>';
  }
}

/* =====================================================================
   Peel transition — cross-platform ghost-clone morph
===================================================================== */
let peelBusy = false;
function peelTo(tab, sourceEl){
  if (peelBusy) return;
  peelBusy = true;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowTier = TIER() === 'low' || TIER() === 'ultra-saver';

  if (reduced || lowTier || !sourceEl){
    setTab(tab);
    peelBusy = false;
    return;
  }

  const nav = $('.tabbar');
  if (nav) nav.dataset.recessed = 'true';

  const rect = sourceEl.getBoundingClientRect();
  const ghost = sourceEl.cloneNode(true);
  ghost.style.cssText =
    'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;' +
    'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
    'margin:0;z-index:400;pointer-events:none;border-radius:24px;' +
    'transform-origin:top left;' +
    'transition:transform 360ms cubic-bezier(.2,.9,.2,1), opacity 220ms ease-out 180ms, border-radius 360ms cubic-bezier(.2,.9,.2,1);';
  document.body.appendChild(ghost);
  sourceEl.style.visibility = 'hidden';

  const dest = $('#sc-' + TAB_TO_SCREEN[tab]);
  if (dest){
    dest.style.opacity = '0';
    dest.style.transform = 'scale(.98)';
    dest.style.transition = 'opacity 240ms ease-out 120ms, transform 320ms cubic-bezier(.2,.9,.2,1) 120ms';
  }

  haptic('light');
  setTab(tab);

  void ghost.offsetWidth;

  const screens = $('#screens').getBoundingClientRect();
  const targetW = screens.width;
  const targetH = Math.min(220, screens.height * 0.35);
  const scaleX = targetW / rect.width;
  const scaleY = targetH / rect.height;

  ghost.style.transform = 'translate(' + (screens.left - rect.left) + 'px,' +
                          (screens.top - rect.top + 8) + 'px) scale(' + scaleX + ',' + scaleY + ')';
  ghost.style.borderRadius = '16px';
  ghost.style.opacity = '0.35';

  if (dest){
    dest.style.opacity = '1';
    dest.style.transform = 'none';
  }

  setTimeout(() => {
    ghost.remove();
    sourceEl.style.visibility = '';
    if (nav) nav.dataset.recessed = 'false';
    if (dest){ dest.style.transition = ''; }
    peelBusy = false;
  }, 380);
}

/* =====================================================================
   Detail screens
===================================================================== */
function fmtDur(ms){
  ms = Math.max(0, ms);
  const d = Math.floor(ms/86400000);
  const h = Math.floor((ms % 86400000)/3600000);
  const m = Math.floor((ms % 3600000)/60000);
  return d > 0 ? (d + 'd ' + h + 'h') : h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
}

/* ---------- Trials ---------- */
function renderTrialsScreen(box){
  if (!box) return;
  const ts = S.trials || [];
  const dq = S.dailyQuests || [];
  const xq = S.xQuests || [];

  const dailyHtml = dq.length ? (
    '<div class="section-head"><b>Daily Quests</b><span class="muted">resets at midnight UTC</span></div>' +
    '<div class="daily-list">' + dq.map(d => {
      const complete = d.progress >= d.goal_amount;
      return '<div class="daily-card' + (d.claimed ? ' done' : '') + '">' +
        '<div class="dc-ico">' + iconSpan(d.icon || 'trials-scroll', 'ico-rust', 20) + '</div>' +
        '<div class="dc-body">' +
          '<b>' + esc(d.title) + '</b>' +
          '<span>' + esc(d.description || '') + '</span>' +
          '<div class="dc-bar"><i style="width:' + clamp((d.progress/d.goal_amount)*100, 0, 100) + '%"></i></div>' +
          '<div class="dc-meta"><span>' + d.progress + '/' + d.goal_amount + '</span>' +
          '<span class="dc-rw">+' + fmt(d.reward_ember) + 'E' + (d.reward_loyalty ? ' · +' + d.reward_loyalty + '❤' : '') + '</span></div>' +
        '</div>' +
        (d.claimed
          ? '<div class="dc-check">' + iconSpan('status-approved', '', 18) + '</div>'
          : complete
            ? '<button class="btn btn-primary btn-sm" data-act="claimDaily" data-val="' + d.id + '">Claim</button>'
            : '') +
      '</div>';
    }).join('') + '</div>'
  ) : '';

  const trialHtml = ts.map(t => {
    const disabled = !t.available;
    const reason = !t.available && t.nextIn ? fmtDur(t.nextIn) : '';
    return '<button class="trial' + (disabled ? ' claimed' : '') + '" data-act="trial" data-val="' + esc(t.slug) + '" ' + (disabled ? 'disabled' : '') + '>' +
      '<span class="ti-ico">' + iconSpan('trials-scroll', '', 20) + '</span>' +
      '<span class="ti-body"><b>' + esc(t.name) + '</b><span>' + esc(t.hint || '') + '</span></span>' +
      '<span class="ti-rew">' +
        (t.reward_ember ? '<span class="rw">' + iconSpan('res-ember', '', 12) + ' +' + fmt(t.reward_ember) + '</span>' : '') +
        (t.reward_loyalty ? '<span class="rw loy">' + iconSpan('res-loyalty', '', 12) + ' +' + fmt(t.reward_loyalty) + '</span>' : '') +
        (reason ? '<span class="ti-cd">' + reason + '</span>' : '') +
      '</span>' +
      '<span class="ti-chev">' + iconSpan(t.available ? 'chevron-right' : 'check', '', 16) + '</span>' +
    '</button>';
  }).join('');

  const xqHtml = xq.length ? (
    '<div class="section-head"><b>X Quests</b><span class="muted">admin-reviewed within 24h</span></div>' +
    '<div class="x-quests">' + xq.map(x => renderXQuest(x)).join('') + '</div>'
  ) : '';

  box.innerHTML = '<div class="screen-body">' +
    '<div class="screen-title">Trials</div>' +
    xqHtml +
    dailyHtml +
    '<div class="section-head"><b>Trials</b></div>' +
    '<div class="trials">' + trialHtml + '</div>' +
  '</div>';
}

function renderXQuest(x){
  const status = x.claim ? x.claim.status : 'available';
  const kindIco = ({
    follow:'quest-follow', retweet:'quest-retweet', like:'quest-like',
    tweet:'quest-tweet', hashtag:'quest-hashtag', quote:'quest-quote',
  })[x.kind] || 'brand-x';

  const statusChip = status === 'pending'
    ? '<span class="x-status pending">' + iconSpan('status-pending','',14) + 'Pending review</span>'
    : status === 'approved'
      ? '<span class="x-status approved">' + iconSpan('status-approved','',14) + 'Approved</span>'
      : status === 'rejected'
        ? '<span class="x-status rejected">' + iconSpan('status-rejected','',14) + 'Rejected</span>'
        : '';

  return '<div class="x-quest' + (x.expanded ? ' open' : '') + (status !== 'available' ? ' done' : '') + '" data-act="xQuestToggle" data-val="' + x.id + '">' +
    '<div class="xq-head">' +
      '<div class="xq-ico">' + iconSpan(kindIco, '', 20) + '</div>' +
      '<div class="xq-body">' +
        '<b>' + esc(x.title) + '</b>' +
        '<span>' + esc(x.description || '') + '</span>' +
      '</div>' +
      '<div class="xq-rew">' + iconSpan('res-ember', '', 12) + ' +' + fmt(x.reward_ember) + '</div>' +
      '<div class="xq-chev">' + iconSpan('chevron-down', '', 14) + '</div>' +
    '</div>' +
    '<div class="xq-expand">' +
      statusChip +
      (status === 'available' ? (
        '<div class="xq-actions">' +
          (x.target ? '<button class="btn btn-primary btn-block" data-act="xOpen" data-val="' + esc(x.target) + '" data-kind="' + esc(x.kind) + '">' +
            iconSpan('external', '', 14) + ' Open @' + esc(x.target) + '</button>' : '') +
          '<div class="field"><input id="xHandle' + x.id + '" class="winput" placeholder="@yourhandle" autocomplete="off"/></div>' +
          '<button class="btn btn-stone btn-block" data-act="xSubmit" data-val="' + x.id + '">Submit for review</button>' +
        '</div>'
      ) : status === 'pending' ? (
        '<div class="xq-note">Claim submitted as <b>@' + esc(x.claim.x_handle || '') + '</b>. A Warden will verify shortly.</div>'
      ) : status === 'approved' ? (
        '<div class="xq-note">Rewarded ' + fmt(x.claim.reward_paid?.ember || 0) + ' Ember.</div>'
      ) : (
        '<div class="xq-note xq-rejected">Rejected: ' + esc(x.claim.reject_reason || 'not verified') +
        '<button class="btn btn-stone btn-sm" style="margin-top:8px" data-act="xRetry" data-val="' + x.id + '">Retry</button></div>'
      )) +
    '</div>' +
  '</div>';
}

/* ---------- Ranks ---------- */
function renderRanksScreen(box){
  if (!box) return;
  const lb = S.leaderboard || [];
  const top = lb.length ? (Number(lb[0].loyalty_total) || 1) : 1;
  const mine = S.tribe ? Number(S.tribe.id) : null;
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Hall of Tribes</div>' +
    (lb.length ? lb.map((t, i) => {
      const pct = clamp(Number(t.loyalty_total) / top * 100, 4, 100);
      const me = mine && mine === Number(t.id);
      const medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : (i+1);
      return '<div class="card" style="padding:14px;margin-bottom:10px;' + (me ? 'border-color:rgba(255,207,122,.4)' : '') + '">' +
        '<div class="row" style="border:0;padding:0 0 10px">' +
          '<span class="avatar">' + medal + '</span>' +
          '<div style="flex:1;min-width:0"><b class="rk-name">' + esc(t.name) + (me ? ' · you' : '') + '</b>' +
          '<div class="tiny">' + fmt(t.members) + ' kin · Pyre ' + fmt(t.treasury) + '</div></div>' +
          '<b class="rk-score">' + fmt(t.loyalty_total) + '</b>' +
        '</div>' +
        '<div class="bar"><i class="rk-fill" style="width:' + pct + '%"></i></div>' +
      '</div>';
    }).join('') : '<div class="empty"><p class="tiny">No tribes yet.</p></div>') +
  '</div>';
}

/* ---------- War ---------- */
function renderWarScreen(box){
  if (!box) return;
  if (!S.user.tribe_id){
    box.innerHTML = '<div class="screen-body"><div class="screen-title">War</div>' +
      '<div class="empty"><h2>No banner</h2>' +
      '<p class="tiny">Join a tribe to wage war.</p></div></div>';
    return;
  }
  box.innerHTML = '<div class="screen-body"><div class="screen-title">War</div>' +
    '<div id="warBody"><div class="skeleton"></div><div class="skeleton"></div></div></div>';
  loadWar();
}

async function loadWar(){
  const box = $('#warBody'); if (!box) return;
  await ensureTactics();
  let war;
  try { war = (await api('/war')).war; }
  catch(e){ box.innerHTML = '<p class="tiny">Could not reach the war drums.</p>'; return; }

  S.war = war;

  if (!war){
    box.innerHTML = '<div class="war-arena">' +
      '<div class="war-emblem"><div class="vs">WAR DRUMS</div></div>' +
      '<button class="btn btn-danger btn-block" data-act="declareWar">Declare War</button>' +
    '</div>';
    return;
  }
  if (war.status === 'resolved'){
    const myId = S.tribe ? Number(S.tribe.id) : null;
    const won = war.winner_id && Number(war.winner_id) === myId;
    box.innerHTML = '<div class="war-arena" style="text-align:center">' +
      '<div class="war-emblem"><div class="vs">' + (won ? 'VICTORY' : 'DEFEAT') + '</div></div>' +
    '</div>';
    return;
  }

  const mineA = war.mine === 'attacker';
  const me = mineA ? war.attacker : war.defender;
  const foe = mineA ? war.defender : war.attacker;
  const fronts = war.fronts || [];

  // BATCH A: vengeance grudge banner against the current foe
  let grudgeBanner = '';
  try {
    const vg = await api('/war/vengeance');
    const foeId = foe && foe.id != null ? Number(foe.id) : null;
    const g = (vg.grudges || []).find(x => Number(x.target_id) === foeId);
    if (g && g.tokens > 0){
      grudgeBanner = '<div class="grudge-banner">☠️ Blood debt against <b>' + esc(g.target_name || (foe && foe.name) || 'them') +
        '</b> — <b>' + fmt(g.tokens) + '</b> Vengeance in play. Your strikes hit harder.</div>';
    }
  } catch(e){ /* vengeance is optional flavour */ }

  box.innerHTML =
    '<div class="war-arena">' +
      '<div class="war-emblem"><div class="vs">WAR</div></div>' +
      '<div class="versus">' +
        '<div class="war-totem"><div class="tm">' + iconSpan('tribe-shield','',40) + '</div><b>' + esc(me.name) + '</b></div>' +
        '<div class="clash">' + iconSpan('war-swords','',24) + '</div>' +
        '<div class="war-totem foe"><div class="tm">' + iconSpan('tribe-shield','',40) + '</div><b>' + esc(foe.name) + '</b></div>' +
      '</div>' +
      '<div class="wmeta">' +
        '<div class="box"><b id="warCd">…</b><span>Time left</span></div>' +
        '<div class="box"><b>' + war.stake_pct + '%</b><span>Stake</span></div>' +
      '</div>' +
    '</div>' +
    (grudgeBanner || '') +
    '<div class="fronts-wrap">' + fronts.map((f, i) => frontHtml(f, i)).join('') + '</div>' +
    '<div class="war-tools">' +
      '<button class="war-tool" data-act="warHint"><span class="wt-ico">💡</span> Hint</button>' +
      '<button class="war-tool" data-act="warWiki"><span class="wt-ico">📖</span> War Wiki</button>' +
    '</div>' +
    '<div class="war-action-panel">' +
      '<div class="wact-head">Choose a front</div>' +
      '<div class="wact-front-pick" id="frontPick">' +
        fronts.map((f, i) => '<button class="fp-btn' + (i === 0 ? ' active' : '') + '" data-act="pickFront" data-val="' + i + '">' + esc(f.name) + '</button>').join('') +
      '</div>' +
      '<div class="wact-head">Tactics</div>' +
      '<div class="tactic-grid">' + offensiveTacticsHtml() + '</div>' +
      (mineA ? '' :
        '<div class="wact-head">Defensive tactics</div>' +
        '<div class="tactic-grid def">' + defensiveTacticsHtml() + '</div>') +
    '</div>';
  startWarTicker(new Date(war.end_at).getTime());
  if (window.hydrateIcons) window.hydrateIcons();
}

function frontHtml(f, i){
  const tot = Math.max(1, Number(f.attacker_score) + Number(f.defender_score));
  const aPct = clamp((Number(f.attacker_score) / tot) * 100, 0, 100);
  const terr = f.terrain ? terrainInfo(f.terrain) : null;
  const terrTag = terr ? '<span class="front-terrain" title="' + esc(terr.desc || '') + '">' + terr.glyph + ' ' + esc(terr.name) + '</span>' : '';
  return '<div class="front-card" data-front="' + i + '">' +
    '<div class="front-head"><span class="front-name">' + esc(f.name) + terrTag + '</span>' +
    '<span class="front-scores"><b>' + fmt(f.attacker_score) + '</b> vs <b>' + fmt(f.defender_score) + '</b></span></div>' +
    '<div class="front-bar"><i data-fr="a" style="width:' + aPct + '%"></i><i data-fr="d" style="width:' + (100 - aPct) + '%"></i></div>' +
  '</div>';
}

/* ---------- BATCH A: tactics catalog cache + terrain lookup ---------- */
let TACTICS_CACHE = null;
async function ensureTactics(){
  if (TACTICS_CACHE) return TACTICS_CACHE;
  try { TACTICS_CACHE = await api('/war/tactics'); }
  catch(e){ TACTICS_CACHE = { terrain:[], offensive:[], defensive:[] }; }
  return TACTICS_CACHE;
}
function terrainInfo(id){
  const list = (TACTICS_CACHE && TACTICS_CACHE.terrain) || [];
  return list.find(t => t.id === id) || null;
}
function offensiveTacticsHtml(){
  const list = (TACTICS_CACHE && TACTICS_CACHE.offensive) || [];
  if (!list.length) return '<button class="wact-btn" data-act="warAction" data-val="rally"><b>Rally</b><span>+25</span></button>';
  return list.map(t =>
    '<button class="tactic-btn" data-act="warAction" data-val="' + esc(t.id) + '" title="' + esc(t.desc || '') + '">' +
      '<span class="tg">' + (t.glyph || '⚔️') + '</span>' +
      '<b>' + esc(t.name) + '</b>' +
      '<span class="tc">+' + fmt(t.base) + ' · ' + fmt(t.cost) + '⭐️</span>' +
    '</button>'
  ).join('');
}
function defensiveTacticsHtml(){
  const list = (TACTICS_CACHE && TACTICS_CACHE.defensive) || [];
  return list.map(t =>
    '<button class="tactic-btn def" data-act="warDefend" data-val="' + esc(t.id) + '" title="' + esc(t.desc || '') + '">' +
      '<span class="tg">' + (t.glyph || '🛡️') + '</span>' +
      '<b>' + esc(t.name) + '</b>' +
    '</button>'
  ).join('');
}

let warTimer = null;
function startWarTicker(endAt){
  if (warTimer) clearInterval(warTimer);
  const tick = () => {
    const e = $('#warCd');
    if (!e){ clearInterval(warTimer); warTimer = null; return; }
    const ms = endAt - Date.now();
    e.textContent = ms <= 0 ? 'resolving…' : fmtDur(ms);
  };
  tick();
  warTimer = setInterval(tick, 1000);
}

/* ---------- Tribe ---------- */
function renderTribeScreen(box){
  if (!box) return;
  const u = S.user, t = S.tribe;
  if (!t){
    box.innerHTML =
      '<div class="screen-body">' +
        '<div class="screen-title">Tribe</div>' +
        '<div class="empty"><h2>You wander alone</h2>' +
        '<p class="tiny">Found your own tribe or join an existing fire.</p></div>' +
        '<button class="btn btn-primary btn-shine btn-block" data-act="openCreate">Found a Tribe · ' + fmt(S.config.foundEmber) + ' Ember</button>' +
        '<div id="joinList" style="margin-top:20px"></div>' +
      '</div>';
    api('/tribes').then(d => {
      const host = $('#joinList'); if (!host) return;
      const list = (d.tribes || []).slice(0, 20);
      host.innerHTML = '<div class="section-head"><b>Available Tribes</b></div>' +
        list.map(x =>
          '<div class="card" style="padding:14px;margin-bottom:10px">' +
            '<div class="row" style="border:0;padding:0">' +
              '<span class="crest-art">' + iconSpan('tribe-shield','',20) + '</span>' +
              '<div style="flex:1;min-width:0"><b class="rk-name">' + esc(x.name) + '</b>' +
              '<div class="tiny">' + fmt(x.members) + ' kin · ' + fmt(x.loyalty_total) + ' loyalty</div></div>' +
              '<button class="btn btn-stone btn-sm" data-act="join" data-val="' + x.id + '">Join</button>' +
            '</div>' +
          '</div>'
        ).join('');
      if (window.hydrateIcons) window.hydrateIcons();
    }).catch(() => {});
    return;
  }
  const lvl = t.level || 1;
  const cap = S.config.levelTable.caps[lvl-1] || 5;
  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">' + esc(t.name) + '</div>' +
      '<div class="card" style="text-align:center">' +
        '<div class="crest-art" style="width:88px;height:88px;margin:0 auto 10px;border-radius:22px">' + iconSpan('tribe-shield','',44) + '</div>' +
        '<h2 style="font-size:1.5rem;margin:0;color:var(--gold);font-weight:800">' + esc(t.name) + '</h2>' +
        '<p class="muted" style="margin:6px 0 12px">' + esc(t.motto || 'We rise from the ash.') + '</p>' +
        '<div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">' +
          '<span class="pill pill-gold">' + esc(u.role) + '</span>' +
          '<span class="pill pill-jade">' + (t.wins || 0) + 'W</span>' +
          '<span class="pill pill-blood">' + (t.losses || 0) + 'L</span>' +
        '</div>' +
      '</div>' +
      '<div class="card"><h3>Kiva</h3><button class="btn btn-primary btn-shine btn-block" data-act="openKiva">Open the Kiva</button></div>' +
      '<div class="card"><h3>Spy Network</h3>' +
        '<p class="tiny">Send spies against rival tribes for intel or sabotage — and raise a counter-spy shield to catch theirs.</p>' +
        '<button class="btn btn-stone btn-shine btn-block" data-act="openSpies">Open the Spy Network</button></div>' +
      '<div class="card"><h3>Stoke the Great Pyre</h3>' +
        '<button class="btn btn-primary btn-shine btn-block" data-act="openDonate">Donate Ember</button></div>' +
      '<button class="btn btn-danger btn-block" data-act="leave" style="margin-top:8px">Leave the Tribe</button>' +
    '</div>';
}

/* ---------- Kiva ---------- */
function renderKivaScreen(box){
  if (!box) return;
  if (!S.tribe){
    box.innerHTML = '<div class="screen-body"><div class="screen-title">Kiva</div>' +
      '<div class="empty"><p class="tiny">Join a tribe to open the Kiva.</p></div></div>';
    return;
  }
  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">Kiva</div>' +
      '<div class="kiva-hero" data-act="openKiva">' +
        '<div class="kh-ico">' + iconSpan('kiva-flame','',26) + '</div>' +
        '<div class="kh-body"><b>' + esc(S.tribe.name) + '</b><span>Talk with your kin</span></div>' +
        '<div class="kh-badge">›</div>' +
      '</div>' +
    '</div>';
}

/* ---------- Store ---------- */
function renderStoreScreen(box){
  if (!box) return;
  const p = S.payments || {};
  const star = p.starItems || {};
  const featured = star['starter_bundle'];
  const sections = { ember:[], relics:[], boosts:[], war:[], cosmetics:[] };
  const sectionFor = k => {
    if (k === 'starter_bundle') return 'featured';
    if (k.startsWith('name_color_') || k.startsWith('glow_')) return 'cosmetics';
    if (k === 'pyreboost') return 'boosts';
    if (k === 'war_chest_topup' || k === 'rally_burst') return 'war';
    if (['firestone','boneidol','sundisc','moonshard'].includes(k)) return 'relics';
    return 'ember';
  };
  for (const [k, it] of Object.entries(star)){
    if (k === 'starter_bundle' || k === 'streak_insurance_buy') continue;
    const s = sectionFor(k);
    if (sections[s]) sections[s].push([k, it]);
  }
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Trading Post</div>' +
    '<button class="btn btn-primary btn-shine btn-block" data-act="goRelics" style="margin-bottom:12px">' +
      iconSpan('sparkles','',16) + ' Relic Vault — packs, shards &amp; loadout</button>' +
    '<button class="btn btn-primary btn-shine btn-block" data-act="goRelics" style="margin-bottom:12px">' +
      iconSpan('sparkles','',16) + ' Relic Vault — packs, shards &amp; loadout</button>' +
    (featured ? '<div class="featured"><span class="ft-badge">ONE-TIME</span>' +
      '<h3>' + esc(featured.title) + '</h3><p>' + esc(featured.desc) + '</p>' +
      '<button class="b" data-act="buyStars" data-val="starter_bundle">' +
      iconSpan('res-stars','',14) + ' ' + fmt(featured.stars) + '</button></div>' : '') +
    '<div class="shop-tabs">' +
      Object.keys(sections).filter(s => sections[s].length).map((s, i) =>
        '<button class="shop-tab' + (i === 0 ? ' active' : '') + '" data-act="shopTab" data-val="' + s + '">' +
        ({ember:'Ember',relics:'Relics',boosts:'Boosts',war:'War',cosmetics:'Looks'})[s] + '</button>').join('') +
    '</div>' +
    Object.entries(sections).map(([s, arr]) =>
      '<div class="shop-section" data-section="' + s + '" style="' + (s === 'ember' ? '' : 'display:none') + '">' +
        arr.map(([k, it]) =>
          '<div class="shop-card">' +
          '<div class="sc-art">' + iconSpan('sparkles','',34) + '</div>' +
          '<b>' + esc(it.title) + '</b><p>' + esc(it.desc) + '</p>' +
          '<button class="b star" data-act="buyStars" data-val="' + k + '">' +
          iconSpan('res-stars','',12) + ' ' + fmt(it.stars) + '</button>' +
          '</div>'
        ).join('') +
      '</div>'
    ).join('') +
  '</div>';
}

/* ---------- Relics (Batch B1: foundation, art added by admin later) ---------- */
const RELIC_RARITY_LABEL = { common:'Common', rare:'Rare', epic:'Epic', legendary:'Legendary' };
const RELIC_CAT_LABEL = { war:'War Relics', tribe:'Tribe Relics', personal:'Personal Relics' };

// Art placeholder box. Admin fills image_url or svg later; until then we show a
// rarity-tinted glyph so the layout is complete without generating any art.
function relicArt(r){
  if (r.image_url) return '<div class="relic-art"><img src="' + esc(r.image_url) + '" alt="" loading="lazy"></div>';
  if (r.svg) return '<div class="relic-art relic-art-svg">' + r.svg + '</div>';
  const glyph = r.cursed ? '\u2620\uFE0F' : (r.category === 'war' ? '\u2694\uFE0F' : r.category === 'tribe' ? '\uD83D\uDEE1\uFE0F' : '\u2728');
  return '<div class="relic-art relic-art-ph" data-rarity="' + esc(r.rarity || 'common') + '">' +
    '<span class="relic-glyph">' + glyph + '</span></div>';
}

function relicCard(r){
  const rar = esc(r.rarity || 'common');
  const owned = !!r.owned;
  const equipped = !!r.equipped;
  const badges =
    '<span class="relic-rar" data-rarity="' + rar + '">' + esc(RELIC_RARITY_LABEL[r.rarity] || r.rarity || '') + '</span>' +
    (r.cursed ? '<span class="relic-cursed">Cursed</span>' : '') +
    (r.pause_in_war ? '<span class="relic-pause">Pauses in war</span>' : '');
  let action;
  if (!owned) action = '<span class="relic-locked tiny">' + esc(r.earn_hint || 'Not yet owned') + '</span>';
  else if (equipped) action = '<button class="btn btn-stone btn-sm btn-block" data-act="relicUnequip">Equipped — Unequip</button>';
  else action = '<button class="btn btn-primary btn-sm btn-block" data-act="relicEquip" data-val="' + r.id + '">Equip</button>';
  return '<div class="relic-card' + (equipped ? ' on' : '') + (r.cursed ? ' cursed' : '') + '">' +
    relicArt(r) +
    '<div class="relic-body">' +
      '<div class="relic-name">' + esc(r.name) + (owned && r.count > 1 ? ' <span class="tiny">×' + fmt(r.count) + '</span>' : '') + '</div>' +
      '<div class="relic-badges">' + badges + '</div>' +
      '<p class="relic-desc tiny">' + esc(r.description || '') + '</p>' +
      action +
    '</div>' +
  '</div>';
}

function renderRelicsScreen(box){
  if (!box) return;
  box.innerHTML = '<div class="screen-body"><div class="screen-title">Relic Vault</div>' +
    '<div id="relicBody"><div class="skeleton"></div><div class="skeleton"></div></div></div>';
  loadRelics();
}

async function loadRelics(){
  const box = $('#relicBody'); if (!box) return;
  let st, packs, fusion;
  try {
    st = await api('/relics/state');
    packs = (await api('/relics/packs')).packs || [];
    try { fusion = await api('/relics/fusion'); } catch(e){ fusion = null; }
  } catch(e){ box.innerHTML = '<p class="tiny">The vault is sealed right now. Try again shortly.</p>'; return; }
  S.relics = st;

  const cat = st.catalog || [];
  const equipped = cat.find(r => r.equipped);
  const shards = Number(st.cursed_shards || 0);

  // Paused relic (personal cursed relic suspended during a war) + swap prompt.
  let pausedRelic = null;
  if (st.paused && st.paused.relic_id){
    pausedRelic = cat.find(r => Number(r.id) === Number(st.paused.relic_id)) || null;
  }
  const ownedWarRelics = cat.filter(r => r.owned && (r.category || 'personal') === 'war' && !r.equipped);

  // Loadout header
  const loadout = '<div class="relic-loadout">' +
    '<div class="rl-head">Your Loadout</div>' +
    (equipped
      ? '<div class="rl-equipped">' + relicArt(equipped) +
          '<div><b>' + esc(equipped.name) + '</b>' +
          '<span class="tiny"> · ' + esc(RELIC_RARITY_LABEL[equipped.rarity] || '') + '</span>' +
          (equipped.cursed ? '<span class="relic-cursed-chip">☠ Cursed</span>' : '') +
          '<div class="tiny">' + esc(equipped.description || '') + '</div></div>' +
          '<button class="btn btn-stone btn-sm" data-act="relicUnequip">Unequip</button>' +
        '</div>'
      : '<p class="tiny">No relic equipped. Equip one below to carry its power. Only one relic can be worn at a time.</p>') +
    (st.paused
      ? '<div class="relic-pause-chip">⏸ ' +
          (pausedRelic ? '<b>' + esc(pausedRelic.name) + '</b> is' : 'A personal relic is') +
          ' paused for the duration of the current war. It resumes automatically when the war ends.' +
          (ownedWarRelics.length
            ? '<div class="relic-swap-prompt"><span class="tiny">Swap to a War relic to fight now:</span>' +
                ownedWarRelics.slice(0, 3).map(r =>
                  '<button class="btn btn-primary btn-sm" data-act="relicEquip" data-val="' + r.id + '">' + esc(r.name) + '</button>'
                ).join('') + '</div>'
            : '') +
        '</div>'
      : '') +
  '</div>';

  // Cursed shards
  const shardBox = '<div class="relic-shards">' +
    '<div class="rl-head">Cursed Shards · <b>' + fmt(shards) + '</b></div>' +
    '<p class="tiny">Bad-luck safety net. Redeem shards for a guaranteed cursed relic.</p>' +
    '<div class="relic-shard-btns">' +
      '<button class="btn btn-stone btn-sm" data-act="relicRedeem" data-val="rare"' + (shards < 5 ? ' disabled' : '') + '>5 → Rare</button>' +
      '<button class="btn btn-stone btn-sm" data-act="relicRedeem" data-val="legendary"' + (shards < 20 ? ' disabled' : '') + '>20 → Legendary</button>' +
    '</div></div>';

  // Packs (art-free): show odds and an Open button. Debits Stars balance.
  const packHtml = packs.length ? '<div class="relic-packs"><div class="rl-head">Relic Packs</div>' +
    packs.map(p => {
      const odds = p.odds_json || {};
      const oddsStr = ['legendary','epic','rare','common']
        .filter(k => odds[k]).map(k => (RELIC_RARITY_LABEL[k] || k) + ' ' + Math.round(odds[k] * 100) + '%').join(' · ');
      return '<div class="relic-pack-card">' +
        '<div class="rp-art relic-art-ph"><span class="relic-glyph">🎁</span></div>' +
        '<div class="rp-body"><b>' + esc(p.name) + '</b>' +
          '<p class="tiny">' + esc(p.description || '') + '</p>' +
          '<p class="tiny relic-odds">' + esc(oddsStr) + (p.pity_epic_in ? ' · Epic+ guaranteed within ' + fmt(p.pity_epic_in) : '') + '</p>' +
          '<button class="btn btn-primary btn-sm" data-act="relicPackOpen" data-val="' + esc(p.slug) + '">Open · ' + iconSpan('res-stars','',12) + ' ' + fmt(p.price_stars) + '</button>' +
        '</div></div>';
    }).join('') +
    '<p class="tiny relic-note">Packs spend your Stars balance (like the spin), not a new Telegram invoice.</p>' +
  '</div>' : '';

  // Catalog grouped by category, non-cursed then cursed within each
  const order = ['war','tribe','personal'];
  const groups = order.map(c => {
    const items = cat.filter(r => (r.category || 'personal') === c);
    if (!items.length) return '';
    return '<div class="relic-group"><div class="rl-head">' + esc(RELIC_CAT_LABEL[c] || c) + '</div>' +
      '<div class="relic-grid">' + items.map(relicCard).join('') + '</div></div>';
  }).join('');

  // Fusion (Batch C): melt spare duplicate copies up into the next rarity.
  let fusionHtml = '';
  if (fusion && fusion.spare){
    const NEXT = { common:'rare', rare:'epic', epic:'legendary' };
    const rows = ['common','rare','epic'].map(rr => {
      const spare = Number(fusion.spare[rr] || 0);
      const to = NEXT[rr];
      const can = !!(fusion.can && fusion.can[rr]);
      return '<div class="relic-fuse-row">' +
        '<span class="rf-lbl">' + esc(RELIC_RARITY_LABEL[rr]) + ' → ' + esc(RELIC_RARITY_LABEL[to]) + '</span>' +
        '<span class="tiny rf-spare">' + fmt(spare) + ' spare</span>' +
        '<button class="btn btn-primary btn-sm" data-act="relicFuse" data-val="' + rr + '"' + (can ? '' : ' disabled') + '>Fuse · ' + fmt(fusion.cost || 3) + '</button>' +
      '</div>';
    }).join('');
    fusionHtml = '<div class="relic-fusion"><div class="rl-head">Relic Fusion</div>' +
      '<p class="tiny">Melt ' + fmt(fusion.cost || 3) + ' spare duplicate relics of one rarity into a guaranteed relic of the next rarity up.</p>' +
      rows + '</div>';
  }

  box.innerHTML = loadout + shardBox + fusionHtml + packHtml + groups;
  if (window.hydrateIcons) window.hydrateIcons();
}

async function relicEquip(id){
  try { const r = await api('/relics/equip', { relicId: Number(id) });
    haptic('medium');
    toast(r.warning || 'Relic equipped', r.warning ? 'warn' : 'good');
    loadRelics();
  } catch(e){ toast(e.message, 'bad'); }
}
async function relicUnequip(){
  try { await api('/relics/unequip', {}); toast('Relic unequipped', 'good'); loadRelics(); }
  catch(e){ toast(e.message, 'bad'); }
}
async function relicRedeem(tier){
  try { const r = await api('/relics/shards/redeem', { tier });
    haptic('heavy'); toast('Redeemed ' + (r.relic ? r.relic.name : 'a relic'), 'good'); refresh(); loadRelics();
  } catch(e){ toast(e.message + (e.data && e.data.need ? ' (need ' + e.data.need + ')' : ''), 'bad'); }
}
// Preset unwrap animations for pack opens. Falls back to 'ember'.
const PACK_ANIM = {
  ember:    { glyph:'🔥', cls:'pa-ember',    label:'The embers gather…' },
  cursed:   { glyph:'💀', cls:'pa-cursed',   label:'A cold wind stirs…' },
  shards:   { glyph:'🔮', cls:'pa-shards',   label:'The shards align…' },
  goldburst:{ glyph:'✨', cls:'pa-goldburst',label:'Something radiant…' },
};

// Play a short unwrap animation, resolving when it finishes (or immediately
// if the user has reduced-motion turned on).
function playPackAnim(preset){
  return new Promise(resolve => {
    const reduced = (getSettings && getSettings().reducedFx) || false;
    const cfg = PACK_ANIM[preset] || PACK_ANIM.ember;
    if (reduced){ resolve(); return; }
    const overlay = el('div', 'pack-anim ' + cfg.cls);
    overlay.innerHTML =
      '<div class="pa-stage">' +
        '<div class="pa-burst"></div>' +
        '<div class="pa-glyph">' + cfg.glyph + '</div>' +
        (cfg.cls === 'pa-shards'
          ? '<span class="pa-p"></span><span class="pa-p"></span><span class="pa-p"></span><span class="pa-p"></span><span class="pa-p"></span><span class="pa-p"></span>'
          : '') +
      '</div>' +
      '<div class="pa-label">' + cfg.label + '</div>';
    document.body.appendChild(overlay);
    let done = false;
    const finish = () => { if (done) return; done = true; overlay.remove(); resolve(); };
    setTimeout(finish, 1400);
  });
}

async function relicPackOpen(slug){
  try {
    const r = await api('/relics/pack/open', { slug });
    haptic('heavy');
    await playPackAnim(r.anim_preset || 'ember');
    sheet('<div class="pack-result">' +
      relicArt(r.relic) +
      '<div class="pr-rar" data-rarity="' + esc(r.rarity) + '">' + esc(RELIC_RARITY_LABEL[r.rarity] || r.rarity) + '</div>' +
      '<h3>' + esc(r.relic.name) + '</h3>' +
      '<p class="tiny">' + esc(r.relic.description || '') + '</p>' +
      '<button class="btn btn-primary btn-block" data-act="closeSheet">Claim</button>' +
    '</div>');
    refresh(); loadRelics();
  } catch(e){ toast(e.message + (e.data && e.data.need ? ' (need ' + e.data.need + ' ⭐)' : ''), 'bad'); }
}

/* ---------- Relic fusion (Batch C) ---------- */
async function relicFuse(rarity){
  try {
    const r = await api('/relics/fuse', { rarity });
    haptic('heavy');
    sheet('<div class="pack-result">' +
      relicArt(r.reward) +
      '<div class="pr-rar" data-rarity="' + esc(r.to) + '">' + esc(RELIC_RARITY_LABEL[r.to] || r.to) + '</div>' +
      '<h3>' + esc(r.reward.name) + '</h3>' +
      '<p class="tiny">Forged from ' + fmt(r.consumed) + ' spare ' + esc(RELIC_RARITY_LABEL[r.from] || r.from) + ' relics.</p>' +
      '<button class="btn btn-primary btn-block" data-act="closeSheet">Claim</button>' +
    '</div>');
    refresh(); loadRelics();
  } catch(e){ toast(e.message, 'bad'); }
}

/* ---------- Spy network (Batch C) ---------- */
function spyMissionLine(m){
  const intel = m.intel || {};
  let detail = '';
  if (m.status === 'success'){
    detail = '<div class="spy-intel tiny">Treasury ' + fmt(intel.treasury || 0) +
      ' · ' + fmt(intel.members || 0) + ' kin' +
      (intel.at_war ? ' · at war' : '') +
      (intel.sabotaged ? ' · disrupted ' + fmt(intel.sabotaged) : '') + '</div>';
  } else if (m.status === 'caught'){
    detail = '<div class="spy-intel tiny bad">Your spy was caught.</div>';
  } else {
    detail = '<div class="spy-intel tiny">In the field…</div>';
  }
  return '<div class="spy-mission spy-' + esc(m.status) + '">' +
    '<div class="sm-head"><b>' + esc(m.target_name || 'Rival tribe') + '</b>' +
      '<span class="chip-mini">' + esc(m.kind) + '</span></div>' + detail + '</div>';
}

async function openSpies(){
  if (!S.tribe){ toast('Join a tribe first', 'warn'); return; }
  sheet('<div class="spy-panel"><h3>Spy Network</h3><div class="skeleton"></div><div class="skeleton"></div></div>');
  let data, tribes;
  try {
    data = await api('/spies');
    tribes = (await api('/tribes')).tribes || [];
  } catch(e){ sheet('<div class="spy-panel"><h3>Spy Network</h3><p class="tiny">The shadows are quiet right now. Try again shortly.</p><button class="btn btn-stone btn-block" data-act="closeSheet">Close</button></div>'); return; }
  S.spies = data;
  const t = data.tuning || {};
  const rivals = tribes.filter(x => Number(x.id) !== Number(data.tribe)).slice(0, 12);

  const counterLbl = data.counter > 0
    ? '<span class="chip-mini chip-jade">Counter-spy Lv ' + data.counter + '</span>'
    : '<span class="chip-mini chip-muted">No shield</span>';

  const targets = rivals.length
    ? '<div class="spy-targets">' + rivals.map(x =>
        '<div class="spy-target"><span class="st-name">' + esc(x.name) + '</span>' +
          '<div class="st-btns">' +
            '<button class="btn btn-stone btn-sm" data-act="spyLaunch" data-val="' + x.id + '" data-kind="recon">Recon</button>' +
            '<button class="btn btn-danger btn-sm" data-act="spyLaunch" data-val="' + x.id + '" data-kind="sabotage">Sabotage</button>' +
          '</div></div>'
      ).join('') + '</div>'
    : '<p class="tiny">No rival tribes to target yet.</p>';

  const missions = (data.missions || []).length
    ? (data.missions || []).map(spyMissionLine).join('')
    : '<p class="tiny">No missions yet.</p>';

  const incoming = (data.incoming || []).length
    ? '<div class="section-head"><b>Caught intruders</b></div>' +
      (data.incoming || []).map(m =>
        '<div class="spy-mission spy-caught"><div class="sm-head"><b>' + esc(m.from_name || 'Unknown') + '</b>' +
          '<span class="chip-mini">' + esc(m.kind) + '</span></div>' +
          '<div class="spy-intel tiny">Your counter-spies caught their ' + esc(m.kind) + '.</div></div>'
      ).join('')
    : '';

  sheet('<div class="spy-panel">' +
    '<h3>Spy Network</h3>' +
    '<div class="spy-shield">' + counterLbl +
      '<button class="btn btn-primary btn-sm" data-act="spyCounter">Raise shield · ' + fmt(t.counterCost || 1500) + ' Ember</button>' +
    '</div>' +
    '<p class="tiny">Recon costs ' + fmt(t.cost || 2000) + ' Ember, sabotage costs double. Missions resolve in ~' + fmt(t.durationMin || 30) + ' min.</p>' +
    '<div class="section-head"><b>Rival tribes</b></div>' + targets +
    '<div class="section-head"><b>Your missions</b></div>' + missions +
    incoming +
    '<button class="btn btn-stone btn-block" data-act="closeSheet" style="margin-top:12px">Close</button>' +
  '</div>');
}

async function spyLaunch(target, kind){
  try {
    const r = await api('/spies/launch', { target: Number(target), kind });
    haptic('medium');
    toast('Spy sent against ' + (r.target || 'the rival') + ' (' + r.kind + ')', 'good');
    refresh(); openSpies();
  } catch(e){ toast(e.message + (e.data && e.data.need ? ' (need ' + fmt(e.data.need) + ' Ember)' : ''), 'bad'); }
}
async function spyCounter(){
  try {
    const r = await api('/spies/counter', {});
    haptic('medium');
    toast('Counter-spy shield raised to Lv ' + r.level, 'good');
    refresh(); openSpies();
  } catch(e){ toast(e.message + (e.data && e.data.need ? ' (need ' + fmt(e.data.need) + ' Ember)' : ''), 'bad'); }
}

/* ---------- Profile ---------- */
function renderProfileScreen(box){
  if (!box) return;
  const u = S.user, t = S.tribe;
  const joined = u.created_at ? new Date(u.created_at) : null;
  const daysIn = joined ? Math.max(1, Math.floor((Date.now() - joined.getTime()) / 86400000)) : 0;

  const badges = [];
  if ((u.streak || 0) >= 7) badges.push({ slug:'firekeeper', name:'Firekeeper', hint:'7-day streak' });
  if ((u.streak || 0) >= 30) badges.push({ slug:'eternal', name:'Eternal', hint:'30-day streak' });
  if ((u.loyalty || 0) >= 20000) badges.push({ slug:'badge-crown', name:'Head', hint:'20k loyalty' });
  if (t && t.created_by === u.id) badges.push({ slug:'badge-founder', name:'Founder', hint:'Founded a tribe' });
  if ((t && t.wins || 0) >= 3) badges.push({ slug:'badge-warlord', name:'Warlord', hint:'3 war wins' });
  if ((u.ember || 0) >= 100000) badges.push({ slug:'badge-hoarder', name:'Hoarder', hint:'100k Ember' });

  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">Your Saga</div>' +
      '<div class="profile-hero">' +
        '<div class="profile-aura' + (u.avatar_glow ? ' aura-' + esc(u.avatar_glow) : '') + '"></div>' +
        '<div class="profile-avatar-xl">' + esc((u.first_name || '?').slice(0,1).toUpperCase()) + '</div>' +
        '<h2 class="profile-hero-name"' + (u.name_color ? ' style="color:' + esc(u.name_color) + '"' : '') + '>' +
          esc(u.first_name || u.username || 'Kin') + '</h2>' +
        '<div class="profile-hero-handle">@' + esc(u.username || '—') + '</div>' +
        '<div class="profile-hero-chips">' +
          '<span class="chip-mini">' + esc(u.role || 'Wanderer') + '</span>' +
          (t ? '<span class="chip-mini chip-tribe">' + esc(t.name) + '</span>' : '<span class="chip-mini chip-muted">No tribe</span>') +
          '<span class="chip-mini chip-muted">' + daysIn + 'd in the fire</span>' +
        '</div>' +
      '</div>' +
      '<div class="profile-stats">' +
        statBox('res-ember', fmt(u.ember), 'Ember') +
        statBox('res-loyalty', fmt(u.loyalty), 'Loyalty') +
        statBox('home-fire', fmt(u.streak || 0), 'Streak') +
        statBox('res-stars', fmt(u.stars || 0), 'Stars') +
      '</div>' +
      '<div class="section-head"><b>Badges</b><span class="muted">' + badges.length + ' earned</span></div>' +
      (badges.length
        ? '<div class="badge-grid">' + badges.map(b =>
            '<div class="badge-card"><span class="badge-ico">' + iconSpan(b.slug,'',32) + '</span>' +
            '<b>' + esc(b.name) + '</b><span>' + esc(b.hint) + '</span></div>').join('') + '</div>'
        : '<div class="empty-mini">No badges yet. Fight, feed, and rise.</div>') +
      (S.referral ? (
        '<div class="section-head"><b>Referrals</b><span class="muted">' + S.referral.invited + ' joined</span></div>' +
        '<div class="referral-card">' +
          '<div class="ref-code"><span class="ref-lbl">Your code</span><b>' + esc(S.referral.code) + '</b></div>' +
          '<button class="btn btn-stone btn-sm" data-act="copyRef">Copy</button>' +
        '</div>'
      ) : '') +
      '<div class="section-head"><b>Relic Wall</b><span class="muted">Your collection</span></div>' +
      '<div id="profileRelicWall"><div class="empty-mini">Loading relics…</div></div>' +
      '<div class="profile-actions">' +
        '<button class="btn btn-stone btn-block" data-act="openSettings">' + iconSpan('settings-gear','',16) + ' Settings</button>' +
        '<button class="btn btn-stone btn-block" data-act="share">' + iconSpan('share','',16) + ' Share your saga</button>' +
      '</div>' +
    '</div>';
  loadProfileRelicWall();
}

async function loadProfileRelicWall(){
  const wall = $('#profileRelicWall'); if (!wall) return;
  let st;
  try { st = S.relics || await api('/relics/state'); }
  catch(e){ wall.innerHTML = '<div class="empty-mini">Could not load your relics.</div>'; return; }
  const owned = (st.catalog || []).filter(r => r.owned);
  if (!owned.length){
    wall.innerHTML = '<div class="empty-mini">No relics yet. Open a pack or win them in war.</div>';
    return;
  }
  const rank = { legendary:0, epic:1, rare:2, common:3 };
  owned.sort((a, b) => (rank[a.rarity] ?? 9) - (rank[b.rarity] ?? 9));
  wall.innerHTML = '<div class="relic-wall-grid">' + owned.map(r =>
    '<div class="rw-tile' + (r.equipped ? ' on' : '') + (r.cursed ? ' cursed' : '') + '" data-rarity="' + esc(r.rarity) + '" title="' + esc(r.name) + '">' +
      relicArt(r) +
      '<div class="rw-name tiny">' + esc(r.name) + (r.count > 1 ? ' ×' + fmt(r.count) : '') + '</div>' +
      (r.equipped ? '<span class="rw-eq">Equipped</span>' : '') +
    '</div>'
  ).join('') + '</div>';
  if (window.hydrateIcons) window.hydrateIcons();
}

function statBox(icon, val, lbl){
  return '<div class="stat-box"><span class="stat-ico">' + iconSpan(icon,'',18) + '</span>' +
    '<b class="stat-val">' + val + '</b><span class="stat-lbl">' + lbl + '</span></div>';
}

/* ---------- Settings ---------- */
function renderSettingsScreen(box){
  if (!box) return;
  const s = getSettings();
  const tier = document.documentElement.getAttribute('data-tier') || 'mid';
  const resolved = localStorage.getItem('tribes.tier.resolved');
  const perfLabel = { auto:'Auto', ultra:'Ultra', high:'High', mid:'Mid', low:'Low', 'ultra-saver':'Ultra Saver' };

  box.innerHTML =
    '<div class="screen-body">' +
      '<div class="screen-title">Settings</div>' +
      '<div class="settings-group">' +
        '<div class="settings-group-title">Performance</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Mode</b><span>Auto-detects your device. Override if the app stutters.</span></div>' +
          '<select id="perfMode" class="settings-select">' +
            ['auto','ultra','high','mid','low','ultra-saver'].map(m =>
              '<option value="' + m + '"' + ((s.perfMode || 'auto') === m ? ' selected' : '') + '>' + perfLabel[m] + '</option>'
            ).join('') +
          '</select>' +
        '</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Detected tier</b><span>Current: <b>' + esc(perfLabel[tier] || tier) + '</b>' +
            (resolved ? ' <i class="muted">(auto-refined)</i>' : '') + '</span></div>' +
        '</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Auto-degrade</b><span>Lower effects automatically if frames drop.</span></div>' +
          togglePill('autoPerf', s.autoPerf !== false) +
        '</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Reduce effects</b><span>Turn off glows, parallax, and heavy animation.</span></div>' +
          togglePill('reducedFx', !!s.reducedFx) +
        '</div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<div class="settings-group-title">Feedback</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Haptics</b><span>Vibration on taps and actions.</span></div>' +
          togglePill('haptics', s.haptics !== false) +
        '</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Sound</b><span>Audio cues for rewards and taps.</span></div>' +
          togglePill('sound', s.sound !== false) +
        '</div>' +
      '</div>' +
      '<div class="settings-group">' +
        '<div class="settings-group-title">Diagnostics</div>' +
        '<div class="settings-row">' +
          '<div class="sr-lbl"><b>Frame probe</b><span>Runs a 3-second test on next launch.</span></div>' +
          '<button class="btn btn-stone btn-sm" data-act="rerunProbe">Re-run</button>' +
        '</div>' +
      '</div>' +
      '<p class="settings-foot">TRIBES · Ash &amp; Bone</p>' +
    '</div>';

  const sel = $('#perfMode');
  if (sel){
    sel.addEventListener('change', () => {
      saveSettings({ perfMode: sel.value });
      window.__tribes_perf.set(sel.value);
    });
  }
}

function togglePill(key, on){
  return '<div class="toggle-pill' + (on ? ' on' : '') + '" data-toggle="' + key + '"><span></span></div>';
}

/* =====================================================================
   Trial minigames
===================================================================== */
function sheet(html){
  const root = $('#sheetRoot'); if (!root) return;
  root.innerHTML = '<div class="sheet-bg" data-act="bgClose"><div class="sheet"><div class="handle"></div>' + html + '</div></div>';
  if (window.hydrateIcons) window.hydrateIcons();
}
function closeSheet(){
  cleanupCry();
  const root = $('#sheetRoot'); if (root) root.innerHTML = '';
}

async function rewardSequence(payload, onComplete){
  const overlay = el('div', 'reward-overlay');
  overlay.innerHTML =
    '<div class="reward-bloom"></div>' +
    '<div class="reward-card reward-drop">' +
      '<div class="reward-ico emoji-pop">' + iconSpan(payload.icon || 'sparkles','',48) + '</div>' +
      '<div class="reward-title">' + esc(payload.title || 'Trial complete') + '</div>' +
      '<div class="reward-amount">' + esc(payload.amount || '') + '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  if (window.hydrateIcons) window.hydrateIcons();

  haptic('heavy');
  await sleep(200);
  overlay.querySelector('.reward-bloom').classList.add('active');
  await sleep(400);
  overlay.querySelector('.reward-card').classList.add('revealed');
  await sleep(600);
  overlay.classList.add('collecting');
  await sleep(600);
  overlay.remove();
  if (typeof onComplete === 'function') onComplete();
}

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

function openHoldSheet(trial){
  const parts = [];
  if (trial.reward_ember) parts.push('+' + fmt(trial.reward_ember) + ' Ember');
  if (trial.reward_loyalty) parts.push('+' + fmt(trial.reward_loyalty) + ' Loyalty');
  sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">' + esc(trial.hint || '') + '</div>' +
    '<div class="hold-wrap">' +
      '<button class="hold-btn" id="holdBtn" data-act="holdStart" data-val="' + esc(trial.slug) + '" type="button">' +
        '<span class="hold-ring"></span>' +
        '<span class="hold-inner"><span class="hold-ico">' + iconSpan('trials-scroll','',32) + '</span>' +
        '<span class="hold-txt">Hold 2s</span></span>' +
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
        if (!r.ok){ toast('Not ready yet', 'warn'); return; }
        const amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                       (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
        closeSheet();
        rewardSequence({ icon:'check', title:'Trial complete', amount }, () => refresh());
      }).catch(e => toast(e.message, 'bad'));
      return;
    }
    holdRAF = requestAnimationFrame(paint);
  };
  holdRAF = requestAnimationFrame(paint);
}
function holdCancel(){
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

/* =====================================================================
   X quests handlers
===================================================================== */
function xQuestToggle(id){
  const quests = S.xQuests || [];
  const target = quests.find(q => q.id === Number(id));
  if (!target) return;
  const wasOpen = target.expanded;
  quests.forEach(q => q.expanded = false);
  target.expanded = !wasOpen;
  renderTrialsScreen($('#sc-trials'));
}

function xOpen(target, kind){
  let url = 'https://x.com/' + encodeURIComponent(target.replace(/^@/, ''));
  if (kind === 'retweet' || kind === 'like' || kind === 'quote'){
    url = target.startsWith('http') ? target : 'https://x.com/i/status/' + target;
  } else if (kind === 'hashtag'){
    url = 'https://x.com/hashtag/' + encodeURIComponent(target.replace(/^#/, ''));
  }
  try {
    if (TG && TG.openLink) TG.openLink(url);
    else window.open(url, '_blank');
  } catch(e){}
}

async function xSubmit(id){
  const inp = $('#xHandle' + id);
  const handle = (inp && inp.value || '').trim().replace(/^@/, '');
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(handle)){
    toast('Enter a valid X handle', 'warn');
    return;
  }
  const quest = (S.xQuests || []).find(q => q.id === Number(id));
  if (!quest) return;
  try {
    await api('/x/claim', { questSlug: quest.slug, xHandle: handle });
    toast('Submitted for review', 'good');
    quest.claim = { status:'pending', x_handle: handle };
    renderTrialsScreen($('#sc-trials'));
  } catch(e){ toast(e.message, 'bad'); }
}

function xRetry(id){
  const quest = (S.xQuests || []).find(q => q.id === Number(id));
  if (!quest) return;
  delete quest.claim;
  renderTrialsScreen($('#sc-trials'));
}

/* =====================================================================
   Daily quests, spin
===================================================================== */
async function claimDaily(id){
  try {
    const r = await api('/daily/' + Number(id) + '/claim');
    toast('Claimed +' + fmt(r.reward_ember) + ' Ember', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

/* =====================================================================
   Ash, checkin, share
===================================================================== */
async function actAsh(btn){
  if (btn) btn.disabled = true;
  try {
    const r = await api('/ash/collect');
    if (!r.ok){ toast('The ash pit is still smouldering', 'warn'); return; }
    burstAt(btn, 18);
    fxPopAt(btn, '+' + fmt(r.gain));
    haptic();
    toast('Gathered ' + r.units + ' Ash → +' + fmt(r.gain) + ' Ember', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}

let tapLock = false;
function tapFire(campfire){
  if (tapLock) return;
  tapLock = true;
  setTimeout(() => tapLock = false, 420);
  if (campfire){
    campfire.classList.remove('tap');
    void campfire.offsetWidth;
    campfire.classList.add('tap');
  }
  const rect = (campfire || document.body).getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  burstEmbers(cx, cy, 16, 130);

  const u = S.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  const since = Date.now() - last;
  if (since < 20 * 3600 * 1000){
    haptic('light');
    fxPop('…', cx, cy - 30);
    return;
  }
  api('/checkin').then(r => {
    if (!r.ok){ haptic('light'); return; }
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
    if (btn) fxPopAt(btn, '+12 loyalty');
    haptic();
    try {
      const link = 'https://t.me/share/url?url=' + encodeURIComponent('https://t.me') + '&text=' + encodeURIComponent('Join my tribe in TRIBES');
      if (TG && TG.openTelegramLink) TG.openTelegramLink(link);
    } catch(e){}
    toast('War Chant spread! +12 Loyalty', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

/* =====================================================================
   Tribe actions
===================================================================== */
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
    grid.innerHTML = names.map(n =>
      '<button class="btn btn-stone" data-act="pickName" data-val="' + n.id + '" style="padding:10px;font-size:.82rem">' + esc(n.name) + '</button>'
    ).join('');
    window.__pickName = id => { pickedId = id; };
    grid.querySelectorAll('[data-act="pickName"]').forEach(b => {
      b.addEventListener('click', () => {
        grid.querySelectorAll('.btn').forEach(x => x.style.borderColor = 'var(--line)');
        b.style.borderColor = 'var(--gold)';
        pickedId = Number(b.dataset.val);
      });
    });
    window.__doCreate = async (btn) => {
      if (!pickedId){ toast('Pick a name', 'warn'); return; }
      const motto = ($('#tMotto')?.value || '').trim();
      try {
        await api('/tribe/create', { nameId: pickedId, motto, palette:'ember', banner:'sun', crest:'totem' });
        closeSheet();
        haptic('medium');
        toast('Your tribe is born!', 'good');
        await refresh();
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
    closeSheet();
    haptic('medium');
    toast('Donated ' + fmt(r.donated) + ' Ember to the Pyre', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

async function actJoin(btn, id){
  try {
    await api('/tribe/join', { tribeId: Number(id) });
    haptic();
    toast('You joined the fire!', 'good');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}
async function actLeave(){
  try {
    await api('/tribe/leave');
    toast('You left the tribe', 'warn');
    await refresh();
  } catch(e){ toast(e.message, 'bad'); }
}

/* =====================================================================
   War actions
===================================================================== */
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
    haptic('heavy');
    burstAt(btn, 18);
    fxPopAt(btn, '+' + fmt(r.points));
    const mult = r.multiplier && r.multiplier !== 1 ? ' (×' + r.multiplier.toFixed(2) + ')' : '';
    toast(kind + ' · +' + fmt(r.points) + mult, 'good');
    loadWar();
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}
async function actWarDefend(btn, kind){
  if (btn) btn.disabled = true;
  try {
    const r = await api('/war/defend', { front: selectedFront, kind });
    haptic('medium');
    burstAt(btn, 12);
    toast(kind + (r.reveal ? ' · ' + r.reveal : ' · defence set'), 'good');
    loadWar();
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}
async function actWarHint(btn){
  if (btn) btn.disabled = true;
  try {
    const r = await api('/war/hint');
    haptic('light');
    toast(r.hint || 'The elders are silent.', 'warn');
    if (r.front != null){ selectedFront = Number(r.front); pickFront(null, r.front); }
  } catch(e){ toast(e.message, 'bad'); }
  finally { if (btn) btn.disabled = false; }
}
async function actWarWiki(){
  try {
    const w = await api('/war/wiki');
    const rules = (w.rules || []).map(r => '<li>' + esc(r) + '</li>').join('');
    const terr = (w.terrain || []).map(t =>
      '<div class="wiki-row"><span class="wg">' + (t.glyph || '') + '</span><b>' + esc(t.name) + '</b><span class="wd">' + esc(t.desc || '') + '</span></div>'
    ).join('');
    const off = (w.offensive || []).map(t =>
      '<div class="wiki-row"><span class="wg">' + (t.glyph || '') + '</span><b>' + esc(t.name) + '</b><span class="wd">' + esc(t.desc || '') + ' · +' + fmt(t.base) + ' / ' + fmt(t.cost) + '⭐️</span></div>'
    ).join('');
    const def = (w.defensive || []).map(t =>
      '<div class="wiki-row"><span class="wg">' + (t.glyph || '') + '</span><b>' + esc(t.name) + '</b><span class="wd">' + esc(t.desc || '') + '</span></div>'
    ).join('');
    sheet(
      '<div class="sheet-title">📖 War Wiki</div>' +
      '<div class="wiki-body">' +
        '<h4>Rules of War</h4><ul class="wiki-rules">' + rules + '</ul>' +
        '<h4>Terrain</h4>' + terr +
        '<h4>Offensive Tactics</h4>' + off +
        '<h4>Defensive Tactics</h4>' + def +
      '</div>' +
      '<button class="btn wide" data-act="closeSheet">Close</button>'
    );
  } catch(e){ toast(e.message, 'bad'); }
}
async function actDeclare(){
  try {
    const r = await api('/war/declare', { stance:'skirmish' });
    haptic('heavy');
    toast('War declared against ' + (r.war && r.war.defender && r.war.defender.name || 'a rival') + '!', 'good');
    await refresh();
    loadWar();
  } catch(e){ toast(e.message, 'bad'); }
}

/* =====================================================================
   Store
===================================================================== */
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
function shopTab(btn, key){
  $$('.shop-tab').forEach(b => b.classList.toggle('active', b.dataset.val === key));
  $$('.shop-section').forEach(s => s.style.display = (s.dataset.section === key ? '' : 'none'));
}

/* =====================================================================
   Refresh
===================================================================== */
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
  peel:         (btn, tab) => peelTo(tab, btn.closest('.dash-card')),
  tapFire:      (btn) => tapFire(btn),
  ash:          actAsh,
  trial:        actTrial,
  holdStart:    (btn, slug) => holdStart(btn, slug),
  siftPick:     (btn, i) => window.doSift && window.doSift(btn, i),
  share:        actShare,
  openCreate:   () => openCreate(),
  doCreate:     (btn) => window.__doCreate && window.__doCreate(btn),
  pickName:     (btn, id) => window.__pickName && window.__pickName(id),
  join:         actJoin,
  leave:        actLeave,
  openDonate:   () => openDonate(),
  doDonate:     (btn) => doDonate(btn),
  openKiva:     () => window.openKiva && window.openKiva(),
  sendKiva:     () => window.sendKiva && window.sendKiva(),
  pinKiva:      (btn, id) => window.pinKiva && window.pinKiva(id),
  buyStars:     (btn, id) => buyStars(id),
  declareWar:   actDeclare,
  pickFront:    (btn, i) => pickFront(btn, i),
  warAction:    actWarAction,
  warDefend:    actWarDefend,
  warHint:      actWarHint,
  warWiki:      actWarWiki,
  shopTab:      (btn, key) => shopTab(btn, key),
  goRelics:     () => setTab('relics'),
  relicEquip:   (btn, id) => relicEquip(id),
  relicUnequip: () => relicUnequip(),
  relicRedeem:  (btn, tier) => relicRedeem(tier),
  relicPackOpen:(btn, slug) => relicPackOpen(slug),
  relicFuse:    (btn, rarity) => relicFuse(rarity),
  openSpies:    () => openSpies(),
  spyLaunch:    (btn, target) => spyLaunch(target, btn.dataset.kind),
  spyCounter:   () => spyCounter(),
  closeSheet:   () => closeSheet(),
  bgClose:      (btn, v, e) => {
    if (e && e.target && e.target.classList && e.target.classList.contains('sheet-bg')) closeSheet();
  },
  claimDaily:   (btn, id) => claimDaily(id),
  xQuestToggle: (btn, id) => xQuestToggle(id),
  xOpen:        (btn, target, e) => xOpen(target, btn.dataset.kind),
  xSubmit:      (btn, id) => xSubmit(id),
  xRetry:       (btn, id) => xRetry(id),
  openSettings: () => setTab('settings'),
  toggleSetting: (btn) => {
    const key = btn.getAttribute('data-toggle');
    const cur = getSettings();
    const isOn = key === 'haptics' || key === 'sound'
      ? (cur[key] !== false)
      : (key === 'reducedFx' ? !!cur.reducedFx : cur[key] !== false);
    saveSettings({ [key]: !isOn });
    btn.classList.toggle('on', !isOn);
  },
  rerunProbe:   () => window.__tribes_perf.rerunProbe(),
  copyRef:      async () => {
    try {
      await navigator.clipboard.writeText(S.referral.code);
      toast('Code copied', 'good');
    } catch(e){ toast('Copy failed', 'bad'); }
  },
};

/* =====================================================================
   Init
===================================================================== */
function init(){
  document.addEventListener('click', e => {
    const pill = e.target.closest('[data-toggle]');
    if (pill){ ACTS.toggleSetting(pill); return; }

    const b = e.target.closest('[data-act]');
    if (b){
      const f = ACTS[b.dataset.act];
      if (f){ f(b, b.dataset.val, e); return; }
    }

    const card = e.target.closest('.dash-card');
    if (card){
      if (card.id === 'dash-campfire'){ tapFire(card.querySelector('.campfire')); return; }
      if (card.dataset.tab){ peelTo(card.dataset.tab, card); return; }
    }
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
}

init();