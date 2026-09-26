/* =====================================================================
   TRIBES — Expansion module (loads after app.js).
   Adds, without touching the core client:
     • Draggable, edge-snapping FAB with saved position (localStorage)
     • Quick-actions sheet (Spin / Protect streak / Welcome pack / Invite)
     • Daily Spin wheel with momentum physics
     • Streak-insurance confirm flow
     • First-time pack auto-prompt + claim
     • Referral list viewer
     • Dynamic Island (notify) wiring across common actions
   Shares the page's global functions (window.api, window.notify, …).
===================================================================== */
(function(){
'use strict';

/* ---------- tiny local helpers (self-contained) ---------- */
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
function fmt(n){
  n = Number(n) || 0;
  return n >= 1e6 ? (n/1e6).toFixed(2) + 'M'
       : n >= 1e3 ? (n/1e3).toFixed(1) + 'k'
       : Math.floor(n).toLocaleString();
}
function api(path, body, opts){
  if (typeof window.api === 'function') return window.api(path, body, opts);
  return Promise.reject(new Error('api unavailable'));
}
function toast(msg, kind){
  if (typeof window.toast === 'function') window.toast(msg, kind);
}
function haptic(t){ if (typeof window.haptic === 'function') window.haptic(t); }
function burstEmbers(x, y, n){ if (typeof window.burstEmbers === 'function') window.burstEmbers(x, y, n); }
function hydrate(){ if (typeof window.hydrateIcons === 'function') window.hydrateIcons(); }
function refreshApp(){ if (typeof window.refresh === 'function') window.refresh(); }
function notify(o){ if (typeof window.notify === 'function') return window.notify(o); return null; }

/* icon helper */
function ic(name, size){ return '<span data-icon="' + esc(name) + '"' + (size ? ' data-icon-size="' + size + '"' : '') + '></span>'; }

/* cached state fetch (avoids depending on app.js internal S) */
let _state = null;
async function getState(force){
  if (_state && !force) return _state;
  _state = await api('/state', undefined, { method:'GET' });
  return _state;
}
function invalidateState(){ _state = null; }

/* ---------- injected styles ---------- */
function injectStyles(){
  if (document.getElementById('x-expansion-css')) return;
  const css = `
.x-fab{position:fixed;z-index:3500;width:58px;height:58px;border-radius:50%;border:1px solid rgba(255,168,74,.35);
  background:radial-gradient(130% 130% at 32% 24%,#ffb347,#ff6a1a 60%,#c43d08);color:#1a0f06;display:grid;place-items:center;
  box-shadow:0 12px 30px rgba(255,90,20,.4),0 2px 0 rgba(255,255,255,.25) inset;cursor:pointer;touch-action:none;
  transition:box-shadow .3s ease,transform .18s cubic-bezier(.2,1.4,.4,1);will-change:transform,left,top}
.x-fab:active{transform:scale(.92)}
.x-fab .x-fab-halo{position:absolute;inset:-6px;border-radius:50%;pointer-events:none;
  box-shadow:0 0 22px 4px rgba(255,120,32,.35);animation:xhalo 2.6s ease-in-out infinite}
@keyframes xhalo{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
.x-fab [data-icon]{width:24px;height:24px}
.x-fab.dragging{transition:none;transform:scale(1.05)}
[data-tier="low"] .x-fab .x-fab-halo,[data-tier="ultra-saver"] .x-fab .x-fab-halo{animation:none;box-shadow:none}

.x-modal{position:fixed;inset:0;z-index:3600;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(6,4,3,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;transition:opacity .28s ease}
.x-modal.in{opacity:1}
.x-card{width:min(480px,96vw);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1a130d,#0d0a07);
  border:1px solid rgba(255,168,74,.22);border-radius:26px 26px 0 0;padding:18px 18px 26px;color:#f3e7d3;
  box-shadow:0 -20px 60px rgba(0,0,0,.6);transform:translateY(28px);transition:transform .34s cubic-bezier(.2,1,.3,1)}
.x-modal.in .x-card{transform:translateY(0)}
.x-card h3{margin:2px 0 4px;font-size:1.15rem;font-weight:900}
.x-card .x-sub{opacity:.72;font-size:.82rem;margin-bottom:14px}
.x-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.x-tile{display:flex;gap:10px;align-items:center;padding:13px;border-radius:16px;cursor:pointer;
  background:rgba(255,255,255,.04);border:1px solid rgba(255,168,74,.16);transition:transform .15s ease,background .2s ease}
.x-tile:active{transform:scale(.97)}
.x-tile .x-ti{width:38px;height:38px;flex:0 0 auto;border-radius:12px;display:grid;place-items:center;
  background:radial-gradient(120% 120% at 30% 20%,rgba(255,160,64,.28),rgba(255,90,20,.1));color:#ffd9a0}
.x-tile b{font-size:.9rem;display:block}.x-tile span{font-size:.72rem;opacity:.7}
.x-btn{display:block;width:100%;border:0;cursor:pointer;font-weight:800;font-size:.92rem;padding:13px;border-radius:14px;
  color:#1a1008;background:linear-gradient(180deg,#ffc061,#ff8a2a);box-shadow:0 6px 16px rgba(255,120,32,.35);margin-top:14px}
.x-btn.ghost{background:rgba(255,255,255,.06);color:#f3e7d3;box-shadow:none;border:1px solid rgba(255,255,255,.12)}
.x-btn:disabled{opacity:.5;cursor:default}
.x-close{position:absolute;top:10px;right:14px}
.x-ref-list{margin-top:12px;display:flex;flex-direction:column;gap:8px}
.x-ref-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:12px;
  background:rgba(255,255,255,.04);font-size:.85rem}
.x-code{display:flex;gap:8px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.05);
  border:1px dashed rgba(255,168,74,.4);font-weight:800;letter-spacing:2px;justify-content:center;font-size:1.1rem}
.x-ref-claim{display:flex;gap:8px;align-items:center;margin-top:12px}
.x-ref-in{flex:1;min-width:0;padding:11px 12px;border-radius:12px;font-weight:700;letter-spacing:1px;
  background:rgba(255,255,255,.05);border:1px solid rgba(255,168,74,.2);color:#f3e7d3;text-transform:uppercase}
.x-ref-in::placeholder{color:rgba(243,231,211,.4);text-transform:none;letter-spacing:0}

.x-wheel-wrap{position:relative;width:280px;height:280px;margin:6px auto 4px}
.x-wheel-ptr{position:absolute;top:-4px;left:50%;transform:translateX(-50%);z-index:3;width:0;height:0;
  border-left:13px solid transparent;border-right:13px solid transparent;border-top:22px solid #ffcf6b;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.x-wheel{position:absolute;inset:0;border-radius:50%;border:6px solid rgba(255,168,74,.5);
  box-shadow:0 0 0 4px rgba(0,0,0,.4),0 16px 40px rgba(0,0,0,.5),0 0 30px rgba(255,120,32,.25) inset;
  will-change:transform}
.x-wheel-lbl{position:absolute;top:50%;left:50%;transform-origin:center;font-size:.72rem;font-weight:800;
  color:#1a0f06;white-space:nowrap}
.x-hub{position:absolute;top:50%;left:50%;width:56px;height:56px;transform:translate(-50%,-50%);z-index:2;
  border-radius:50%;background:radial-gradient(circle at 35% 30%,#3a2a1a,#120b06);border:2px solid rgba(255,168,74,.6);
  display:grid;place-items:center;color:#ffd9a0}
.x-spin-meta{display:flex;justify-content:space-between;font-size:.78rem;opacity:.82;margin:6px 2px 0}
`;
  const st = document.createElement('style');
  st.id = 'x-expansion-css';
  st.textContent = css;
  document.head.appendChild(st);
}
injectStyles();

/* ---------- Dynamic Island wiring: observe common actions ---------- */
(function wireNotify(){
  const orig = window.api;
  if (typeof orig !== 'function' || orig.__xwrapped) return;
  const wrapped = async function(path, body, opts){
    const res = await orig(path, body, opts);
    try {
      const p = String(path || '').split('?')[0];
      if (p.startsWith('/trials/')){
        const e = res && (res.reward_ember || 0);
        if (res && res.ok !== false && (e || res.reward_loyalty))
          notify({ title:'Trial complete', msg:(e?('+'+fmt(e)+' Ember'):'')+(res.reward_loyalty?('  +'+res.reward_loyalty+' Loyalty'):''), icon:'trials-scroll', severity:'success' });
      } else if (p.startsWith('/daily/') && p.endsWith('/claim')){
        notify({ title:'Daily quest claimed', msg:'The tribe grows stronger.', icon:'status-approved', severity:'success' });
      } else if (p === '/checkin'){
        notify({ title:'Fire fed', msg:(res && res.reward)?('+'+fmt(res.reward)+' Ember'):'Streak kept alive.', icon:'home-fire', severity:'success' });
      } else if (p === '/war/action' || p === '/war/cry'){
        notify({ title:'War move made', msg:'Your front advances.', icon:'war-swords', severity:'default' });
      } else if (p === '/tribe/join'){
        notify({ title:'Joined a tribe', msg:'Welcome to the fire.', icon:'tribe-shield', severity:'success' });
      } else if (p === '/tribe/create'){
        notify({ title:'Tribe founded', msg:'Your saga begins.', icon:'tribe-shield', severity:'success' });
      }
    } catch(e){ /* never break the real call */ }
    return res;
  };
  wrapped.__xwrapped = true;
  window.api = wrapped;
})();

/* ---------- modal helper ---------- */
let _modal = null;
function closeModal(){
  if (!_modal) return;
  const m = _modal; _modal = null;
  m.classList.remove('in');
  setTimeout(() => m.remove(), 320);
}
function openModal(innerHtml){
  closeModal();
  const m = document.createElement('div');
  m.className = 'x-modal';
  m.innerHTML = '<div class="x-card">' +
    '<button class="x-close x-btn ghost" data-x-act="closeModal" style="width:auto;margin:0;padding:6px 10px">' + ic('close-x', 16) + '</button>' +
    innerHtml + '</div>';
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  document.body.appendChild(m);
  hydrate();
  requestAnimationFrame(() => m.classList.add('in'));
  _modal = m;
  return m;
}

/* ---------- custom action delegation (decoupled from app ACTS) ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-x-act]');
  if (!b) return;
  const act = b.getAttribute('data-x-act');
  const val = b.getAttribute('data-x-val');
  if (X_ACTS[act]){ e.preventDefault(); X_ACTS[act](b, val, e); }
});

const X_ACTS = {
  closeModal: () => closeModal(),
  openQuick:  () => openQuickActions(),
  openSpin:   () => openSpin(),
  openStreak: () => openStreakInsurance(),
  openPack:   () => openFirstPack(),
  openRef:    () => openReferral(),
  copyRefCode: async (btn, val) => {
    try { await navigator.clipboard.writeText(val || ''); toast('Code copied', 'good'); }
    catch(e){ toast('Copy failed', 'bad'); }
  },
};

/* ---------- draggable, edge-snapping FAB ---------- */
const FAB_POS_KEY = 'tribes.fab.pos';
function loadFabPos(){
  try { return JSON.parse(localStorage.getItem(FAB_POS_KEY) || 'null'); } catch(e){ return null; }
}
function saveFabPos(p){ try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(p)); } catch(e){} }

function placeFab(fab, pos){
  const w = fab.offsetWidth || 58, h = fab.offsetHeight || 58;
  const vw = window.innerWidth, vh = window.innerHeight;
  const margin = 14;
  const bottomSafe = 78; // keep clear of the tab bar
  let top = pos ? pos.top : (vh - bottomSafe - h);
  top = Math.max(margin + 44, Math.min(vh - h - margin, top));
  const side = pos ? pos.side : 'right';
  fab.style.top = top + 'px';
  if (side === 'left'){ fab.style.left = margin + 'px'; fab.style.right = 'auto'; }
  else { fab.style.left = (vw - w - margin) + 'px'; fab.style.right = 'auto'; }
}

function mountFab(){
  if (document.getElementById('xFab')) return;
  const fab = document.createElement('button');
  fab.id = 'xFab';
  fab.className = 'x-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Quick actions');
  fab.innerHTML = '<span class="x-fab-halo"></span>' + ic('spin-stone', 24);
  document.body.appendChild(fab);
  hydrate();
  placeFab(fab, loadFabPos());

  let dragging = false, moved = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0, pid = null;
  fab.addEventListener('pointerdown', e => {
    dragging = true; moved = false; pid = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    const r = fab.getBoundingClientRect();
    baseLeft = r.left; baseTop = r.top;
    fab.setPointerCapture(pid);
    fab.classList.add('dragging');
  });
  fab.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved = true;
    fab.style.left = (baseLeft + dx) + 'px';
    fab.style.top  = (baseTop + dy) + 'px';
    fab.style.right = 'auto';
  });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove('dragging');
    try { fab.releasePointerCapture(pid); } catch(_){}
    if (moved){
      const r = fab.getBoundingClientRect();
      const side = (r.left + r.width/2) < window.innerWidth/2 ? 'left' : 'right';
      const pos = { side, top: r.top };
      placeFab(fab, pos);
      saveFabPos(pos);
    } else {
      haptic('light');
      openQuickActions();
    }
  };
  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => placeFab(fab, loadFabPos()));
}

/* ---------- quick actions sheet ---------- */
function openQuickActions(){
  openModal(
    '<h3>Quick Actions</h3>' +
    '<div class="x-sub">Everything a tribesperson needs, one tap away.</div>' +
    '<div class="x-grid">' +
      '<div class="x-tile" data-x-act="openSpin"><span class="x-ti">' + ic('spin-stone',20) + '</span><span><b>Daily Spin</b><span>Spin the ember stone</span></span></div>' +
      '<div class="x-tile" data-x-act="openStreak"><span class="x-ti">' + ic('home-fire',20) + '</span><span><b>Protect Streak</b><span>Insure tonight\u2019s fire</span></span></div>' +
      '<div class="x-tile" data-x-act="openPack"><span class="x-ti">' + ic('store-bag',20) + '</span><span><b>Welcome Pack</b><span>Claim your starter gift</span></span></div>' +
      '<div class="x-tile" data-x-act="openRef"><span class="x-ti">' + ic('user-plus',20) + '</span><span><b>Invite &amp; Earn</b><span>Your referrals</span></span></div>' +
    '</div>'
  );
}

/* ---------- Daily Spin wheel (momentum physics) ---------- */
function spinBtnLabel(spin){
  if (spin.freeAvailable) return 'Spin \u2014 Free';
  if (spin.paidLeft > 0) return 'Spin \u2014 ' + (spin.starsPerSpin||25) + '\u2605';
  return 'Come back tomorrow';
}
async function openSpin(){
  let st;
  try { st = await getState(true); } catch(e){ toast('Could not load spin', 'bad'); return; }
  const spin = st.spin || {};
  const pockets = (spin.rewards || []).slice().sort((a,b)=>Number(a.slot_index)-Number(b.slot_index));
  if (!pockets.length){ toast('Spin not configured yet', 'warn'); return; }
  const N = pockets.length;
  const seg = 360 / N;
  let labels = '', stops = '';
  pockets.forEach((p,i)=>{
    const ang = i*seg + seg/2;
    const label = esc(p.label != null ? p.label : (p.kind==='empty' ? '\u2014' : (p.amount||p.kind)));
    labels += '<div class="x-wheel-lbl" style="transform:translate(-50%,-50%) rotate('+ang+'deg) translateY(-104px)">'+label+'</div>';
    const c = (p.kind==='stars')?'#ffe08a':(p.kind==='relic')?'#d9b3ff':(p.kind==='loyalty')?'#a7ecbb':(i%2?'#ffb45a':'#ffd6a0');
    stops += c+' '+(i*seg)+'deg '+((i+1)*seg)+'deg'+(i<N-1?',':'');
  });
  const bg = 'conic-gradient('+stops+')';
  const meta = spin.freeAvailable ? 'Free spin ready'
             : (spin.paidLeft>0 ? (spin.paidLeft+' paid spins left') : 'No spins left today');
  openModal(
    '<h3>Daily Spin</h3>'+
    '<div class="x-sub">Give it a flick \u2014 the ember stone decides your fortune.</div>'+
    '<div class="x-wheel-wrap">'+
      '<div class="x-wheel-ptr"></div>'+
      '<div class="x-wheel" id="xWheel" style="background:'+bg+'">'+labels+'</div>'+
      '<div class="x-hub">'+ic('spin-stone',22)+'</div>'+
    '</div>'+
    '<div class="x-spin-meta"><span id="xSpinMeta">'+esc(meta)+'</span><span>'+N+' pockets</span></div>'+
    '<button class="x-btn" id="xSpinBtn">'+esc(spinBtnLabel(spin))+'</button>'
  );
  const wheel = document.getElementById('xWheel');
  const btn = document.getElementById('xSpinBtn');
  if (!spin.freeAvailable && spin.paidLeft<=0){ btn.disabled = true; return; }
  let rot = 0, spinning = false;
  btn.addEventListener('click', async ()=>{
    if (spinning) return;
    spinning = true; btn.disabled = true; btn.textContent = 'Spinning\u2026'; haptic('medium');
    let res;
    try { res = await api('/spin', {}); }
    catch(e){
      spinning = false; btn.disabled = false; btn.textContent = 'Try again';
      toast((e.data && e.data.error) || e.message || 'Spin failed', 'bad');
      return;
    }
    let pos = pockets.findIndex(p=>Number(p.slot_index)===Number(res.slotIndex));
    if (pos < 0) pos = 0;
    animateWheel(wheel, rot, pos, seg, finalRot=>{
      rot = finalRot;
      onSpinResult(res, btn);
    });
  });
}

function animateWheel(wheel, from, pos, seg, done){
  const desiredMod = ((-(pos*seg + seg/2)) % 360 + 360) % 360;
  const turns = 5 + Math.floor(Math.random()*3);
  let target = from + turns*360;
  const delta = ((desiredMod - (target % 360)) % 360 + 360) % 360;
  target += delta;
  const overshoot = target + 7;      // slight past, then settle back
  const dur1 = 3600, dur2 = 320;
  const t0 = performance.now();
  function ease(k){ return 1 - Math.pow(1 - k, 3); }   // easeOutCubic
  function phase1(now){
    const k = Math.min(1, (now - t0)/dur1);
    const val = from + (overshoot - from)*ease(k);
    wheel.style.transform = 'rotate('+val+'deg)';
    if (k < 1) requestAnimationFrame(phase1);
    else { const s0 = performance.now(); (function settle(n2){
      const k2 = Math.min(1, (n2 - s0)/dur2);
      const v2 = overshoot + (target - overshoot)*ease(k2);
      wheel.style.transform = 'rotate('+v2+'deg)';
      if (k2 < 1) requestAnimationFrame(settle);
      else { wheel.style.transform = 'rotate('+target+'deg)'; done(target); }
    })(s0); }
  }
  requestAnimationFrame(phase1);
}

async function onSpinResult(res, btn){
  haptic('heavy');
  const hub = document.querySelector('.x-hub');
  if (hub){ const r = hub.getBoundingClientRect(); burstEmbers(r.left+r.width/2, r.top+r.height/2, 20); }
  const kind = res.reward && res.reward.kind;
  const amt  = res.reward && res.reward.amount;
  const label = res.label || (kind==='empty' ? 'Better luck next time' : ((amt||'')+' '+(kind||'')));
  const sev = (kind==='relic'||kind==='stars') ? 'success' : (kind==='empty' ? 'warn' : 'default');
  notify({ title:'You won: '+label, msg: kind==='empty' ? 'The stone stays cold.' : 'Added to your hoard.', icon:'spin-stone', severity:sev });
  toast('Won: ' + label, kind==='empty' ? 'warn' : 'good');
  invalidateState(); refreshApp();
  // refresh the button state for the next spin
  try {
    const st = await getState(true);
    const spin = st.spin || {};
    const meta = document.getElementById('xSpinMeta');
    if (meta) meta.textContent = spin.freeAvailable ? 'Free spin ready' : (spin.paidLeft>0 ? (spin.paidLeft+' paid spins left') : 'No spins left today');
    if (btn){
      btn.textContent = spinBtnLabel(spin);
      btn.disabled = (!spin.freeAvailable && spin.paidLeft<=0);
    }
  } catch(e){ if (btn){ btn.disabled=false; btn.textContent='Spin again'; } }
}

/* ---------- streak insurance ---------- */
function openStreakInsurance(){
  openModal(
    '<h3>Protect Your Streak</h3>'+
    '<div class="x-sub">Missed a day? Insurance keeps your fire alive so the streak survives. Paid in Stars.</div>'+
    '<button class="x-btn" id="xStreakBtn">Protect my fire tonight</button>'
  );
  const b = document.getElementById('xStreakBtn');
  b.addEventListener('click', async ()=>{
    b.disabled = true; b.textContent = 'Working\u2026';
    try {
      await api('/streak-insurance', {});
      toast('Streak protected', 'good');
      notify({ title:'Streak insured', msg:'Your fire is safe for tomorrow.', icon:'home-fire', severity:'success' });
      invalidateState(); refreshApp(); closeModal();
    } catch(e){
      b.disabled = false; b.textContent = 'Try again';
      if (e.data && e.data.need) toast('Need ' + e.data.need + '\u2605', 'bad');
      else toast((e.data && e.data.error) || 'Not available', 'warn');
    }
  });
}

/* ---------- first-time pack ---------- */
function openFirstPack(){
  openModal(
    '<h3>Welcome Pack</h3>'+
    '<div class="x-sub">A one-time gift for new tribespeople. Claim it before it burns out.</div>'+
    '<button class="x-btn" id="xPackBtn">Claim my gift</button>'
  );
  const b = document.getElementById('xPackBtn');
  b.addEventListener('click', async ()=>{
    b.disabled = true; b.textContent = 'Claiming\u2026';
    try {
      const r = await api('/first-pack/claim', {});
      toast('Welcome pack claimed', 'good');
      notify({ title:'Welcome pack!', msg:'+'+fmt(r.ember)+' Ember'+(r.loyalty?('  +'+r.loyalty+' Loyalty'):''), icon:'store-bag', severity:'success' });
      localStorage.setItem('tribes.firstpack', '1');
      invalidateState(); refreshApp(); closeModal();
    } catch(e){
      b.disabled = false; b.textContent = 'Try again';
      if (e.status === 409){ toast('Already claimed', 'warn'); localStorage.setItem('tribes.firstpack','1'); closeModal(); }
      else if (e.status === 410){ toast('Offer expired', 'warn'); closeModal(); }
      else toast((e.data && e.data.error) || 'Not available', 'warn');
    }
  });
}

/* ---------- referral list ---------- */
async function openReferral(){
  openModal('<h3>Invite &amp; Earn</h3><div class="x-sub">Share your code \u2014 you both earn Ember when they join.</div><div id="xRefBody">Loading\u2026</div>');
  try {
    const r = await api('/referral', undefined, { method:'GET' });
    const list = (r.list || []).map(x =>
      '<div class="x-ref-row"><span>'+ic('profile-user',14)+' '+esc(x.first_name||x.username||'Tribesperson')+'</span>'+
      '<span style="opacity:.6">'+esc(String(x.rewarded_at||'').slice(0,10))+'</span></div>'
    ).join('');
    const body = document.getElementById('xRefBody');
    if (body) body.innerHTML =
      '<div class="x-code">'+esc(r.code||'\u2014')+'</div>'+
      '<button class="x-btn ghost" data-x-act="copyRefCode" data-x-val="'+esc(r.code||'')+'">Copy code</button>'+
      '<div class="x-spin-meta"><span>Invited: '+(r.invited||0)+'</span></div>'+
      '<div class="x-ref-claim">'+
        '<input id="xRefInput" class="x-ref-in" maxlength="16" placeholder="Have a friend\u2019s code?" autocomplete="off"/>'+
        '<button class="x-btn" id="xRefClaimBtn" style="margin-top:0;width:auto;padding:11px 16px">Redeem</button>'+
      '</div>'+
      (list ? '<div class="x-ref-list">'+list+'</div>'
            : '<div class="x-sub" style="margin-top:12px">No referrals yet. Share your code to begin.</div>');
    hydrate();
    const cb = document.getElementById('xRefClaimBtn');
    if (cb) cb.addEventListener('click', async ()=>{
      const inp = document.getElementById('xRefInput');
      const code = (inp && inp.value || '').trim().toUpperCase();
      if (!code){ toast('Enter a code', 'warn'); return; }
      cb.disabled = true; cb.textContent = '\u2026';
      try {
        const cr = await api('/referral/claim', { code });
        toast('Referral bonus claimed', 'good');
        notify({ title:'Referral bonus!', msg:'+'+fmt(cr.reward)+' Ember for you both.', icon:'user-plus', severity:'success' });
        invalidateState(); refreshApp(); closeModal();
      } catch(e){
        cb.disabled = false; cb.textContent = 'Redeem';
        if (e.status === 409) toast('You already used a code', 'warn');
        else if (e.status === 404) toast('No such code', 'bad');
        else toast((e.data && e.data.error) || 'Could not redeem', 'bad');
      }
    });
  } catch(e){
    const body = document.getElementById('xRefBody');
    if (body) body.textContent = 'Could not load referrals.';
  }
}

/* ---------- boot: mount FAB once the app is visible ---------- */
(function bootExpansion(){
  let tries = 0;
  const timer = setInterval(()=>{
    tries++;
    const app = document.getElementById('app');
    const visible = app && app.style.display !== 'none';
    if (visible){
      clearInterval(timer);
      try { mountFab(); } catch(e){ console.warn('fab', e); }
      // first-time pack auto-prompt (once per device)
      if (!localStorage.getItem('tribes.firstpack') && !localStorage.getItem('tribes.firstpack.seen')){
        localStorage.setItem('tribes.firstpack.seen', '1');
        setTimeout(()=>{
          notify({
            title:'Welcome to TRIBES',
            msg:'Claim your starter pack of Ember.',
            icon:'store-bag', severity:'success', duration:9000,
            action:{ label:'Claim', onClick:()=>openFirstPack() },
          });
        }, 2200);
      }
    } else if (tries > 120){ // ~60s safety timeout
      clearInterval(timer);
    }
  }, 500);
})();

})();
