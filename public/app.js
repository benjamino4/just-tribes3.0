/* =====================================================================
   TRIBES — Mini App client. Obsidian Glass UI.
   Batch 2: War UI (fronts, actions, momentum, legendary, defender, cry).
===================================================================== */
'use strict';
window.addEventListener('error', function(e){ var b = document.getElementById('bootMsg'); if (b && b.style.display !== 'none') b.textContent = 'Error: ' + (e.message || 'unknown'); });
const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try{
  if(TG){
    TG.ready(); TG.expand();
    TG.setHeaderColor&&TG.setHeaderColor('#07060a');
    TG.setBackgroundColor&&TG.setBackgroundColor('#07060a');
    TG.enableClosingConfirmation&&TG.enableClosingConfirmation();
  }
}catch(e){}

const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const el = (t,c,h)=>{ const n=document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n; };
const fmt = n => { n=Number(n)||0; return n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':Math.floor(n).toLocaleString(); };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const haptic = (t='light') => { try{ TG&&TG.HapticFeedback&&TG.HapticFeedback.impactOccurred(t); }catch(e){} };
const PERF = window.__tribes_perf || null;

/* ---------- toast ---------- */
function toast(msg, kind='', ico){
  ico = ico || (kind==='good'?'✓':kind==='bad'?'✕':kind==='warn'?'!':'✦');
  const t = el('div','toast '+kind, `<span class="t-ico">${ico}</span><span>${esc(msg)}</span>`);
  $('#toastRoot').appendChild(t);
  setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),320); }, 2600);
}

/* ---------- fx ---------- */
const fxRoot = () => $('#fxRoot');
function fxPop(text, x, y){
  const p = el('div','fx-pop', esc(text));
  p.style.left = x+'px'; p.style.top = y+'px';
  fxRoot().appendChild(p);
  setTimeout(()=>p.remove(), 1000);
}
function burstEmbers(x, y, count=14, spread=110){
  for(let i=0;i<count;i++){
    const a=(Math.PI*2)*(i/count)+(Math.random()*.5);
    const dist=spread*(0.55+Math.random()*0.6);
    const dx=Math.cos(a)*dist, dy=Math.sin(a)*dist-20;
    const e=el('div','fx-ember');
    e.style.left=(x-3)+'px'; e.style.top=(y-3)+'px';
    e.style.width=(4+Math.random()*5)+'px';
    e.style.height=e.style.width;
    e.style.transition='transform 900ms cubic-bezier(.15,.75,.3,1), opacity 900ms ease-out';
    fxRoot().appendChild(e);
    requestAnimationFrame(()=>{ e.style.transform=`translate(${dx}px,${dy}px) scale(.3)`; e.style.opacity='0'; });
    setTimeout(()=>e.remove(), 1100);
  }
}
function flyTo(fromEl, toEl, text){
  if(!fromEl||!toEl) return;
  const f=fromEl.getBoundingClientRect(), t=toEl.getBoundingClientRect();
  const p=el('div','fx-pop', esc(text));
  p.style.left=(f.left+f.width/2)+'px';
  p.style.top=(f.top+f.height/2)+'px';
  p.style.transition='transform 700ms cubic-bezier(.2,.9,.2,1), opacity 700ms ease-in';
  fxRoot().appendChild(p);
  requestAnimationFrame(()=>{
    const dx=(t.left+t.width/2)-(f.left+f.width/2);
    const dy=(t.top+t.height/2)-(f.top+f.height/2);
    p.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.5)`;
    p.style.opacity='0';
  });
  setTimeout(()=>p.remove(), 760);
}
function burstAt(node, count=14){
  if(!node) return;
  const r=node.getBoundingClientRect();
  burstEmbers(r.left+r.width/2, r.top+r.height/2, count);
}
function popAt(node, text){
  if(!node) return;
  const r=node.getBoundingClientRect();
  fxPop(text, r.left+r.width/2, r.top+r.height/2);
}
function animateCounter(node, to, dur=520){
  if(!node) return;
  const from = Number(node.dataset.v || node.textContent.replace(/[^\d.-]/g,'')) || 0;
  to = Number(to)||0;
  if(from===to){ node.dataset.v=to; node.textContent=fmt(to); return; }
  const t0=performance.now();
  const step=now=>{
    const k=clamp((now-t0)/dur, 0, 1);
    const e=1-Math.pow(1-k,3);
    const v=Math.round(from+(to-from)*e);
    node.textContent=fmt(v);
    if(k<1) requestAnimationFrame(step);
    else { node.dataset.v=to; node.textContent=fmt(to); }
  };
  requestAnimationFrame(step);
}

/* ---------- guest id ---------- */
let GUEST = localStorage.getItem('tribes.guest');
if(!GUEST){ GUEST='g'+String(Math.floor(Math.random()*9e9)+1e9); localStorage.setItem('tribes.guest',GUEST); }

/* ---------- API ---------- */
async function api(path, body, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if(TG && TG.initData) headers['X-Init-Data'] = TG.initData;
  headers['X-Guest-Id'] = GUEST;
  const READ_PATHS = new Set(['/state','/health','/war','/tribes','/tribe/names','/kiva','/bonfire','/cosmetics','/trials']);
  const pathOnly = path.split('?')[0];
  const m = opts.method || (body !== undefined ? 'POST' : (READ_PATHS.has(pathOnly) ? 'GET' : 'POST'));
  const r = await fetch('/api'+path, {
    method: m,
    headers,
    body: m === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  let j={}; try{ j = await r.json(); }catch(e){}
  if(!r.ok){
    const err = new Error(j.error || ('HTTP '+r.status));
    err.status = r.status; err.data = j;
    throw err;
  }
  return j;
}

/* ---------- SVG art ---------- */
const ART = {
  totem:'<svg viewBox="0 0 60 80"><rect x="20" y="8" width="20" height="64" rx="6" fill="#5a3a24"/><circle cx="30" cy="24" r="8" fill="url(#gGold)"/><circle cx="27" cy="23" r="1.6" fill="#2a1408"/><circle cx="33" cy="23" r="1.6" fill="#2a1408"/><path d="M22 44h16M22 56h16" stroke="#ffd77a" stroke-width="3"/></svg>',
  skull:'<svg viewBox="0 0 60 80"><path d="M30 8c13 0 20 9 20 22 0 8-4 12-4 18l-4 4h-4l-2-6-2 6h-4l-2-6-2 6h-4l-4-4c0-6-4-10-4-18C14 17 17 8 30 8z" fill="#e8dcc4"/><circle cx="22" cy="36" r="5" fill="#2a1408"/><circle cx="38" cy="36" r="5" fill="#2a1408"/><path d="M30 44l-3 8h6z" fill="#2a1408"/></svg>',
  drum:'<svg viewBox="0 0 60 80"><ellipse cx="30" cy="22" rx="22" ry="9" fill="url(#gGold)"/><path d="M8 22v30a22 9 0 0 0 44 0V22" fill="#6b4326"/><path d="M10 26l40 22M50 26L10 48" stroke="#ffd77a" stroke-width="2" opacity=".6"/></svg>',
  flame:'<svg viewBox="0 0 60 80"><path d="M30 6c8 18-12 22-12 38a12 12 0 0 0 24 0c0-8-4-12-12-38z" fill="url(#gFlame)"/><circle cx="30" cy="48" r="7" fill="#fff6d6"/></svg>',
  torch:'<svg viewBox="0 0 60 80"><rect x="27" y="30" width="6" height="46" rx="3" fill="#6b4326"/><path d="M30 4c5 12-8 14-8 24a8 8 0 0 0 16 0c0-6-4-8-8-24z" fill="url(#gFlame)"/></svg>',
  charm:'<svg viewBox="0 0 60 80"><path d="M30 12l6 14 15 2-11 10 3 15-13-8-13 8 3-15L9 28l15-2z" fill="url(#gFlame)"/></svg>',
  horn:'<svg viewBox="0 0 60 80"><path d="M8 52c14 6 40 4 46-24-2 20-18 30-30 30-8 0-14-3-16-6z" fill="#e8d7b5"/></svg>',
  firestone:'<svg viewBox="0 0 60 80"><polygon points="30,8 50,30 40,64 20,64 10,30" fill="url(#gFlame)"/><polygon points="30,20 40,32 34,54 26,54" fill="#fff2cf" opacity=".7"/></svg>',
  idol:'<svg viewBox="0 0 60 80"><rect x="20" y="20" width="20" height="52" rx="8" fill="#d8c39a"/><circle cx="30" cy="18" r="11" fill="#e8d7b5"/><circle cx="26" cy="17" r="2" fill="#3a2416"/><circle cx="34" cy="17" r="2" fill="#3a2416"/></svg>',
  sun:'<svg viewBox="0 0 60 80"><circle cx="30" cy="40" r="15" fill="url(#gGold)"/><g stroke="#ffd77a" stroke-width="3"><path d="M30 8v10M30 62v10M8 40h10M42 40h10M14 24l7 7M39 49l7 7M46 24l-7 7M21 49l-7 7"/></g></svg>',
  moon:'<svg viewBox="0 0 60 80"><path d="M38 12a24 24 0 1 0 0 56 20 20 0 0 1 0-56z" fill="#dfe6ff"/></svg>',
};
function artSvg(k){ return ART[k] || ART.totem; }

const sleep = ms => new Promise(r=>setTimeout(r,ms));
let S = null, TAB = 'fire';

/* ---------- TON Connect ---------- */
let tonUI = null, tonAddr = null;
function initTon(){
  try{
    const NS = window.TON_CONNECT_UI;
    if(!NS){ console.warn('TON Connect UI not loaded'); return; }
    tonUI = new NS.TonConnectUI({ manifestUrl: location.origin + '/tonconnect-manifest.json' });
    tonUI.onStatusChange(async w => {
      tonAddr = (w && w.account) ? w.account.address : null;
      updateTonChip();
      if(tonAddr){ try{ await api('/ton/link', { address: tonAddr }); }catch(e){} }
    });
    const acc = tonUI.account;
    if(acc){ tonAddr = acc.address; updateTonChip(); }
  }catch(e){ console.warn('TON init', e); }
}
function updateTonChip(){
  const b = $('#tonBtn'); if(!b) return;
  if(tonAddr){ b.classList.add('on'); b.textContent = '◈ '+tonAddr.slice(0,4)+'…'+tonAddr.slice(-3); }
  else { b.classList.remove('on'); b.textContent = 'Connect'; }
}
async function tonToggle(){
  if(!tonUI){ toast('TON wallet not available here','warn'); return; }
  try{ if(tonAddr) await tonUI.disconnect(); else await tonUI.openModal(); }
  catch(e){ console.warn(e); }
}

/* ---------- payments ---------- */
async function buyStars(itemId){
  if(!TG){ toast('Open in Telegram to pay with Stars','warn'); return; }
  let link;
  try{ link = (await api('/stars/invoice', { itemId })).link; }
  catch(e){ return toast(e.message,'bad'); }
  haptic('medium');
  TG.openInvoice(link, async status => {
    if(status==='paid'){ toast('Payment complete!','good'); setTimeout(refresh,1400); }
    else if(status==='failed') toast('Payment failed','bad');
    else if(status==='cancelled') toast('Payment cancelled','warn');
  });
}
async function buyTon(itemId){
  if(!tonUI || !tonAddr){ toast('Connect your TON wallet first','warn'); return tonToggle(); }
  let intent;
  try{ intent = (await api('/ton/intent', { itemId })).intent; }
  catch(e){ return toast(e.message,'bad'); }
  try{
    await tonUI.sendTransaction({
      validUntil: Math.floor(Date.now()/1000)+600,
      messages:[{ address: intent.to, amount: String(intent.amountNano) }],
    });
  }catch(e){ return toast('Transaction cancelled','warn'); }
  toast('Confirming on-chain…');
  let ok = false;
  for(let i=0;i<14 && !ok;i++){
    await sleep(5000);
    try{ const r = await api('/ton/verify', { nonce: intent.nonce }); if(r.verified) ok = true; }catch(e){}
  }
  if(ok){ toast('TON payment confirmed!','good'); await refresh(); }
  else toast('Still settling — rewards arrive once the tx confirms','warn');
}

/* ---------- boot ---------- */
function setBoot(msg, retry){
  $('#bootMsg').textContent = msg;
  $('#retryBtn').style.display = retry ? 'inline-flex' : 'none';
}
function showApp(){
  $('#boot').classList.add('gone');
  setTimeout(()=>{ $('#boot').style.display='none'; }, 600);
  $('#gate').style.display='none';
  $('#app').style.display='block';
}
function showGate(){
  $('#boot').style.display='none';
  $('#gate').style.display='grid';
  $('#app').style.display='none';
}
async function boot(){
  setBoot('Waking the ancestors…');
  try{ await api('/health'); }catch(e){}
  try{ S = await api('/state'); }
  catch(e){
    if(e.status===401 && e.data && e.data.error==='no_username'){ showGate(); return; }
    if(e.status===401){ setBoot('Open TRIBES inside Telegram to gather at the fire.', true); return; }
    if(e.status===503){ setBoot('The elders are tending the fire — try again soon.', true); return; }
    if(e.status===403 && e.data && e.data.error==='banned'){ setBoot('You were banished: '+(e.data.reason||''), false); return; }
    setBoot('The fire could not be reached — '+(e.message||'try again.'), true); return;
  }
  try {
    initTon(); applyPalette(); renderAll();
  } catch (err) {
    setBoot('Error: ' + (err && err.message ? err.message : String(err)));
    console.error('BOOT ERROR:', err);
    return;
  }
  showApp();
  startBonfireTicker();
  startPushPoller();
}
async function refresh(){
  try{
    const prev = S;
    S = await api('/state');
    applyPalette();
    renderAll();
    if(prev && S.user && prev.user){
      if(Number(S.user.ember) > Number(prev.user.ember)) animateCounter($('#emberVal'), S.user.ember);
    }
  }catch(e){ console.warn(e); }
}
window.refresh = refresh;

/* ---------- palette ---------- */
function applyPalette(){
  const p = (S && S.tribe && S.tribe.palette) || 'ember';
  document.documentElement.setAttribute('data-palette', p);
  const hue = (S && S.tribe && S.tribe.hue) || 0;
  document.documentElement.style.setProperty('--thue', hue+'deg');
}

/* ---------- topbar ---------- */
function renderTop(){
  const u = S.user, t = S.tribe;
  $('#crestArt').innerHTML = artSvg(t ? t.crest : 'totem');
  $('#tribeName').textContent = t ? t.name : 'No Tribe';
  $('#roleName').textContent = u.role || 'Wanderer';
  animateCounter($('#emberVal'), u.ember);
  updateTonChip();
}

/* ---------- nav ---------- */
function setTab(tab){
  TAB = tab;
  $$('.nav-i').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id==='sc-'+tab));
  renderScreen(tab);
  window.scrollTo({ top:0, behavior:'smooth' });
}
function renderAll(){
  renderTop();
  const host = $('#screens');
  if(!host.dataset.built){
    ['fire','tribe','war','ranks','store'].forEach(t=>{
      const s = el('section','screen','');
      s.id = 'sc-'+t;
      host.appendChild(s);
    });
    host.dataset.built='1';
  }
  $$('.screen').forEach(s=>s.classList.toggle('on', s.id==='sc-'+TAB));
  renderScreen(TAB);
}
function renderScreen(tab){
  const box = $('#sc-'+tab); if(!box) return;
  if(tab==='fire')  return renderFire(box);
  if(tab==='tribe') return renderTribe(box);
  if(tab==='war')   return renderWar(box);
  if(tab==='ranks') return renderRanks(box);
  if(tab==='store') return renderStore(box);
}

/* ---------- helpers ---------- */
async function doAct(btn, fn){
  if(btn && btn.disabled) return;
  if(btn){ btn.disabled=true; btn.style.opacity=.6; }
  try{ await fn(); }
  catch(e){ toast(e.message||'Something went wrong','bad'); }
  finally{ if(btn){ btn.disabled=false; btn.style.opacity=1; } }
}
function fmtDur(ms){
  ms = Math.max(0, ms);
  const d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
  return d>0 ? `${d}d ${h}h` : h>0 ? `${h}h ${m}m` : `${m}m`;
}

/* ---------- FIRE ---------- */
function fireReadyIn(){
  const u = S.user;
  const last = u.last_checkin ? new Date(u.last_checkin).getTime() : 0;
  return (last + 20*3600*1000) - Date.now();
}
function renderFire(box){
  const u = S.user;
  const readyIn = fireReadyIn();
  const ready = readyIn <= 0;
  const pct = clamp(100*(1 - readyIn/(20*3600*1000)), 0, 100);

  box.innerHTML = `
  <div class="hero-fire">
    <div class="campfire ${ready?'ready':''}" id="campfire" data-act="tapFire" role="button" aria-label="Feed the fire">
      <div class="halo"></div>
      <div class="ring"></div>
      <div class="logs"></div>
      <div class="flame"></div><div class="flame f2"></div><div class="flame f3"></div>
      <div class="tap-ring"></div>
    </div>
    <div class="tap-hint ${ready?'':'cd'}">
      ${ready ? 'Tap the fire to feed it 🔥' : 'Next blessing in ' + fmtDur(readyIn)}
    </div>
  </div>

  <div class="card">
    <div class="checkin">
      <div class="dial" style="--p:${ready?100:pct.toFixed(0)}"><b>${u.streak||0}<i>STREAK</i></b></div>
      <div style="flex:1">
        <h3 style="margin:0 0 4px">Keeper of the Flame</h3>
        <p class="tiny" style="margin:0">Feed the fire every day to grow your streak. Longer streaks pour out ever more Ember from the ancestors.</p>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="hd" style="margin:0 0 10px"><h2 style="font-size:1.05rem">The Ash Pit</h2><span class="pill pill-gold">Idle · Ash → Ember</span></div>
    <p class="tiny" style="margin:0 0 12px">Cinders gather while you're away — ${S.config.ashCap} charges × ${S.ashUnit} Ember.</p>
    <div style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px">
      <div class="dial" style="--p:${((S.ashPending/S.config.ashCap)*100).toFixed(0)}"><b>${S.ashPending}<i>ASH</i></b></div>
      <button class="btn ${S.ashPending>0?'btn-primary btn-shine':'btn-stone'} btn-block" data-act="ash">
        ${S.ashPending>0 ? 'Gather '+S.ashPending+' Ash (+'+fmt(S.ashPending*S.ashUnit)+')' : 'Smouldering…'}
      </button>
    </div>
  </div>

  <div class="hd"><h2>Trials</h2><span class="sub">earn Ember & Loyalty</span></div>
  <div class="trials">${renderTrialsRows()}</div>`;
}

function renderTrialsRows(){
  const ts = S.trials || [];
  if(!ts.length) return '<p class="tiny">No trials right now. Check back soon.</p>';
  return ts.map(t => {
    const disabled = !t.available;
    const reason = !t.available && t.nextIn ? fmtDur(t.nextIn) : '';
    const emberChip = t.reward_ember ? `<span class="rw">🔥 +${fmt(t.reward_ember)}</span>` : '';
    const loyChip = t.reward_loyalty ? `<span class="rw loy">❤ +${fmt(t.reward_loyalty)}</span>` : '';
    const cd = !t.available && reason ? `<span class="ti-cd">${reason}</span>` : '';
    const chev = t.available ? '<span class="ti-chev">›</span>' : '<span class="ti-check">✓</span>';
    return `<button class="trial ${disabled?'claimed':''}" data-act="trial" data-val="${esc(t.slug)}" ${disabled?'disabled':''}>
      <span class="ti-ico">${esc(t.glyph||'🔥')}</span>
      <span class="ti-body"><b>${esc(t.name)}</b><span>${esc(t.hint||'')}</span></span>
      <span class="ti-rew">${emberChip}${loyChip}${cd}</span>
      ${chev}
    </button>`;
  }).join('');
}

/* ---------- fire actions ---------- */
let tapLock = false;
function tapFire(campfire){
  if(tapLock) return;
  tapLock = true; setTimeout(()=>tapLock=false, 420);
  campfire.classList.remove('tap');
  void campfire.offsetWidth;
  campfire.classList.add('tap');
  const rect = campfire.getBoundingClientRect();
  const cx = rect.left + rect.width/2;
  const cy = rect.top + rect.height/2;
  burstEmbers(cx, cy, 16, 130);
  if(fireReadyIn() > 0){ haptic('soft'); fxPop('⏳', cx, cy-30); return; }
  api('/checkin').then(r => {
    if(!r.ok){ haptic('soft'); fxPop('⏳', cx, cy-30); return; }
    haptic('heavy');
    burstEmbers(cx, cy, 24, 170);
    fxPop('+'+fmt(r.reward), cx, cy-40);
    const emberChip = $('#emberVal').closest('.purse');
    flyTo(campfire, emberChip, '+'+fmt(r.reward));
    toast(`Daily blessing! +${fmt(r.reward)} Ember · streak ${r.streak}`,'good');
    refresh();
  }).catch(e => toast(e.message,'bad'));
}

async function actAsh(btn){
  await doAct(btn, async () => {
    const r = await api('/ash/collect');
    if(!r.ok){ toast('The ash pit is still smouldering','warn'); return; }
    burstAt(btn, 18); popAt(btn,'+'+fmt(r.gain)); haptic();
    toast(`Gathered ${r.units} Ash → +${fmt(r.gain)} Ember`,'good');
    await refresh();
  });
}

function actTrial(btn, slug){
  const t = (S.trials || []).find(x => x.slug === slug);
  if (!t) return;
  if (t.kind === 'rewarded_ad') return openAdSheet(t);
  return openHoldSheet(t);
}

function openHoldSheet(trial){
  const rewardParts = [];
  if (trial.reward_ember)   rewardParts.push('🔥 +'+fmt(trial.reward_ember));
  if (trial.reward_loyalty) rewardParts.push('❤ +'+fmt(trial.reward_loyalty));
  const rewardText = rewardParts.join(' · ') || 'Reward';
  sheet(`
    <h3>${esc(trial.name)}</h3>
    <div class="sub">${esc(trial.hint||'')}</div>
    <div class="hold-wrap">
      <button class="hold-btn" id="holdBtn" data-act="holdStart" data-val="${esc(trial.slug)}" type="button" aria-label="Hold to confirm">
        <span class="hold-ring"></span>
        <span class="hold-inner">
          <span class="hold-ico">${esc(trial.glyph||'🔥')}</span>
          <span class="hold-txt">Hold 2s</span>
        </span>
      </button>
      <div class="hold-reward">${rewardText}</div>
    </div>
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:14px">Cancel</button>
  `);
}

let holdTimer = null, holdRAF = null, holdStartAt = 0;
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
      api('/trials/'+encodeURIComponent(slug)).then(r => {
        if (!r.ok){ toast('Not ready yet','warn'); return; }
        const parts=[];
        if (r.reward_ember)   parts.push('+'+fmt(r.reward_ember)+' Ember');
        if (r.reward_loyalty) parts.push('+'+fmt(r.reward_loyalty)+' Loyalty');
        toast(`Trial complete: ${parts.join(' · ')}`,'good');
        closeSheet();
        refresh();
      }).catch(e => toast(e.message,'bad'));
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
  if (holdTimer){ clearTimeout(holdTimer); holdTimer = null; }
  const el = document.querySelector('.hold-btn');
  if (el){
    el.classList.remove('holding');
    const ring = el.querySelector('.hold-ring');
    if (ring) ring.style.setProperty('--p', '0');
  }
}

function openAdSheet(trial){
  sheet(`
    <h3>${esc(trial.name)}</h3>
    <div class="sub">${esc(trial.hint||'Watch a short ad to claim.')}</div>
    <div class="ad-placeholder">
      <div class="ad-ico">📺</div>
      <p class="tiny" style="margin:8px 0 0">Rewarded ads are coming soon.</p>
      <p class="tiny" style="opacity:.7">Once an ad network is connected, tapping the button below will play a short ad and grant the reward.</p>
    </div>
    <button class="btn btn-stone btn-block" disabled style="margin-top:14px">Watch ad — coming soon</button>
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Close</button>
  `);
}

async function actShare(btn){
  await doAct(btn, async () => {
    await api('/share');
    popAt(btn,'+12 ❤'); haptic();
    try{
      const link = 'https://t.me/share/url?url='+encodeURIComponent('https://t.me')+'&text='+encodeURIComponent('Join my tribe in TRIBES 🔥⚔️');
      if(TG && TG.openTelegramLink) TG.openTelegramLink(link);
    }catch(e){}
    toast('War Chant spread! +12 Loyalty','good');
    await refresh();
  });
}

/* ---------- TRIBE ---------- */
const CRESTS = ['totem','skull','drum','flame','torch','idol','sun','moon','horn'];
let pickedCrest='totem', pickedPalette='ember', pickedBanner='sun', pickedNameId=null;

function renderTribe(box){
  const u = S.user, t = S.tribe;
  if(t){
    const wl = (Number(t.wins)||0)+(Number(t.losses)||0);
    const levels = S.config.levelTable;
    const levelName = levels.names[Math.max(0, Math.min(levels.names.length-1, (t.level||1)-1))];
    const cap = levels.caps[Math.max(0, Math.min(levels.caps.length-1, (t.level||1)-1))];
    const nextCap = levels.caps[Math.min(levels.caps.length-1, (t.level||1))] || cap;
    const nextCost = levels.costs[Math.min(levels.costs.length-1, (t.level||1))] || 0;
    const canUpgrade = Number(t.treasury) >= nextCost && (t.level||1) < levels.costs.length;
    box.innerHTML = `
    <div class="card" style="text-align:center">
      <div class="crest-art" style="width:88px;height:88px;margin:4px auto 10px;border-radius:22px">${artSvg(t.crest)}</div>
      <h2 style="font-size:1.5rem;margin:0;color:var(--gold);font-weight:800">${esc(t.name)}</h2>
      <p class="muted" style="font-size:.8rem;margin:6px 0 12px">${esc(t.motto)||'“We rise from the ash.”'}</p>
      <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
        <span class="pill pill-gold">${esc(levelName)}</span>
        <span class="pill pill-gold">${esc(u.role)}</span>
        <span class="pill pill-jade">🏆 ${t.wins||0}W</span>
        <span class="pill pill-blood">💀 ${t.losses||0}L</span>
      </div>
    </div>

    <div class="wmeta" style="margin-bottom:14px">
      <div class="box"><b>${fmt(t.treasury)}</b><span>Great Pyre</span></div>
      <div class="box"><b>${fmt(t.loyalty_total)}</b><span>Loyalty</span></div>
      <div class="box"><b>${t.members||0}/${cap}</b><span>Kin</span></div>
    </div>

    <div class="card">
      <div class="hd" style="margin:0 0 10px"><h2 style="font-size:1.05rem">Kiva</h2><span class="sub">tribe talk</span></div>
      <div class="kiva-hero" data-act="openKiva">
        <div class="kh-ico">💬</div>
        <div class="kh-body"><b>Open the Kiva</b><span>Talk with your kin</span></div>
        <div class="kh-badge" id="kivaBadge" style="display:none">0</div>
      </div>
    </div>

    <div class="card">
      <h3>Stoke the Great Pyre</h3>
      <p class="tiny" style="margin:0 0 14px">Donate your Ember to the tribe treasury. A deep Pyre wins wars — and every gift earns you Loyalty.</p>
      <button class="btn btn-primary btn-shine btn-block" data-act="openDonate">🔥 Donate Ember to the Pyre</button>
    </div>

    <div class="card">
      <h3>Level Up</h3>
      <p class="tiny" style="margin:0 0 10px">
        ${(t.level||1) < levels.costs.length
          ? `Raise to <b>${esc(levels.names[(t.level||1)])}</b> · cap ${nextCap} · costs ${fmt(nextCost)} Ember from the Pyre.`
          : 'Your tribe has reached the highest level — Kingdom.'}
      </p>
      ${(t.level||1) < levels.costs.length
        ? `<button class="btn ${canUpgrade?'btn-primary btn-shine':'btn-stone'} btn-block" data-act="upgrade" ${canUpgrade?'':'disabled'}>
             ${canUpgrade ? '⚡ Raise the level' : 'The Great Pyre is too shallow'}
           </button>`
        : ''}
    </div>

    <button class="btn btn-danger btn-block" data-act="leave" style="margin-top:4px">Leave the Tribe</button>
    <p class="tiny" style="text-align:center;margin-top:12px">${wl ? ('Battle record · '+t.wins+' won, '+t.losses+' lost') : 'Your tribe has yet to taste war.'}</p>`;
    return;
  }
  box.innerHTML = `
  <div class="empty"><span class="big">🪨</span>
    <h2 style="margin:0;color:var(--gold);font-weight:800">You wander alone</h2>
    <p class="tiny" style="margin-top:8px">Found your own tribe or join an existing fire. Tribes wage war, hoard the Great Pyre, and climb the ranks together.</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="openCreate">🔥 Found a Tribe · ${fmt(S.config.foundEmber)} Ember</button>
  <div class="hd" style="margin-top:20px"><h2>Join a Fire</h2><span class="sub">strongest tribes</span></div>
  <div id="joinList">${'<div class="skeleton"></div>'.repeat(3)}</div>`;
  api('/tribes').then(d => {
    const host = $('#joinList'); if(!host) return;
    const list = (d.tribes||[]).slice(0,30);
    if(!list.length){ host.innerHTML = '<p class="tiny">No tribes yet — be the first to found one!</p>'; return; }
    host.innerHTML = list.map(x => `<div class="card" style="padding:14px;margin-bottom:10px">
      <div class="row" style="border:0;padding:0">
        <span class="crest-art">${artSvg(x.crest)}</span>
        <div style="flex:1;min-width:0"><b style="color:var(--gold)">${esc(x.name)}</b>
          <div class="tiny">${fmt(x.members)} kin · ${fmt(x.loyalty_total)} loyalty · 🏆${x.wins||0}</div></div>
        <button class="btn btn-stone" data-act="join" data-val="${x.id}" style="padding:10px 14px;font-size:.8rem">Join</button>
      </div></div>`).join('');
  }).catch(()=>{ const h=$('#joinList'); if(h) h.innerHTML='<p class="tiny">Could not reach the other fires.</p>'; });
}

async function actUpgrade(btn){
  await doAct(btn, async () => {
    const r = await api('/tribe/upgrade');
    haptic('heavy');
    toast(`Risen to ${r.name}!`,'good');
    await refresh();
  });
}
async function actJoin(btn, id){
  await doAct(btn, async () => {
    await api('/tribe/join', { tribeId: Number(id) });
    haptic(); toast('You joined the fire!','good'); await refresh();
  });
}
async function actLeave(btn){
  await doAct(btn, async () => {
    await api('/tribe/leave');
    toast('You left the tribe','warn'); await refresh();
  });
}

/* ---------- sheets ---------- */
function sheet(html){
  $('#sheetRoot').innerHTML = `<div class="sheet-bg" data-act="bgClose"><div class="sheet"><div class="handle"></div>${html}</div></div>`;
}
function closeSheet(){ $('#sheetRoot').innerHTML=''; }

async function openCreate(){
  pickedCrest='totem'; pickedPalette='ember'; pickedBanner='sun'; pickedNameId=null;
  sheet(`<h3>Found a Tribe</h3><div class="sub">Costs ${fmt(S.config.foundEmber)} Ember · you become Chief</div>
    <div class="field"><input id="tMotto" maxlength="80" placeholder="Battle motto (optional)"/></div>
    <div class="tiny" style="margin:6px 0 8px">Pick a tribe name (first-come, first-served)</div>
    <div id="nameGrid" class="grid2" style="grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"><div class="skeleton" style="height:36px"></div><div class="skeleton" style="height:36px"></div></div>
    <div class="tiny" style="margin-bottom:6px">Pick a banner</div>
    <div class="grid2" id="bannerGrid" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      ${(S.config.banners||['sun','moon','wolf','bear','spear','shield','tree','flame']).map(b=>`<button class="btn btn-stone" data-act="pickBanner" data-val="${b}" style="padding:10px;font-size:1rem">${bannerGlyph(b)}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-bottom:6px">Pick a palette</div>
    <div class="grid2" id="paletteGrid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${Object.keys(S.config.palette||{}).map(p=>`<button class="btn btn-stone" data-act="pickPalette" data-val="${p}" style="padding:10px;font-size:.78rem;border-left:4px solid ${S.config.palette[p].accent}">${p}</button>`).join('')}
    </div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doCreate">Light the First Fire</button>
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>`);
  try{
    const d = await api('/tribe/names');
    const grid = $('#nameGrid'); if(!grid) return;
    const names = (d.names||[]).slice(0,60);
    if(!names.length){ grid.innerHTML = '<p class="tiny" style="grid-column:span 2">All names are claimed. Ask an admin to add more.</p>'; return; }
    grid.innerHTML = names.map(n=>`<button class="btn btn-stone" data-act="pickName" data-val="${n.id}" style="padding:10px;font-size:.82rem">${esc(n.name)}</button>`).join('');
  }catch(e){
    const grid = $('#nameGrid'); if(grid) grid.innerHTML = '<p class="tiny" style="grid-column:span 2">Could not load names.</p>';
  }
}
function bannerGlyph(b){
  return ({ sun:'☀️', moon:'🌙', wolf:'🐺', bear:'🐻', spear:'🗡️', shield:'🛡️', tree:'🌳', flame:'🔥' })[b] || '🏴';
}
function pickName(btn,val){
  pickedNameId = Number(val);
  $$('#nameGrid .btn').forEach(b=>b.style.borderColor = (Number(b.dataset.val)===pickedNameId ? 'var(--gold)' : 'var(--line)'));
}
function pickPalette(btn,val){
  pickedPalette = val;
  $$('#paletteGrid .btn').forEach(b=>b.style.borderColor = (b.dataset.val===val ? 'var(--gold)' : 'var(--line)'));
}
function pickBanner(btn,val){
  pickedBanner = val;
  $$('#bannerGrid .btn').forEach(b=>b.style.borderColor = (b.dataset.val===val ? 'var(--gold)' : 'var(--line)'));
}
async function doCreate(btn){
  await doAct(btn, async () => {
    if(!pickedNameId){ toast('Pick a name','warn'); return; }
    const motto = ($('#tMotto')?.value || '').trim();
    await api('/tribe/create', { nameId: pickedNameId, motto, palette: pickedPalette, banner: pickedBanner, crest: pickedCrest });
    closeSheet(); haptic('medium'); toast('Your tribe is born!','good'); await refresh();
  });
}

function openDonate(){
  sheet(`<h3>Stoke the Great Pyre</h3><div class="sub">You hold ${fmt(S.user.ember)} Ember</div>
    <div class="field"><input id="dAmt" type="number" min="1" placeholder="Ember to donate"/></div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      ${[500,2500,10000].map(v=>`<button class="btn btn-stone" style="flex:1;padding:12px 8px;font-size:.82rem" data-act="setDon" data-val="${v}">${fmt(v)}</button>`).join('')}</div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doDonate">Donate to the Pyre</button>
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>`);
}
function setDon(btn, v){ const i=$('#dAmt'); if(i) i.value = v; }
async function doDonate(btn){
  await doAct(btn, async () => {
    const amt = Math.floor(Number($('#dAmt')?.value)||0);
    if(amt<1){ toast('Enter an amount','warn'); return; }
    const r = await api('/tribe/donate', { amount: amt });
    closeSheet(); haptic('medium');
    toast('Donated '+fmt(r.donated)+' Ember to the Pyre','good');
    await refresh();
  });
}

/* ---------- KIVA ---------- */
let kivaEs = null, kivaPoll = null, kivaLastId = 0, kivaOpen = false;
async function openKiva(){
  if(!S.tribe) return;
  kivaOpen = true;
  sheet(`<div class="kiva-sheet">
    <div class="kiva-head"><b>${esc(S.tribe.name)} — Kiva</b>
      <button class="btn btn-ghost" data-act="closeKiva" style="padding:6px 10px;font-size:.72rem">Close</button></div>
    <div class="kiva-feed" id="kivaFeed"><div class="skeleton" style="height:44px"></div></div>
    <div class="kiva-compose">
      <input id="kivaInput" maxlength="280" placeholder="Say something to the tribe…"/>
      <button class="send" data-act="sendKiva">➤</button>
    </div>
  </div>`);
  await loadKiva(); connectKivaStream();
}
function closeKiva(){
  kivaOpen = false;
  if(kivaEs){ try{ kivaEs.close(); }catch(e){} kivaEs=null; }
  if(kivaPoll){ clearInterval(kivaPoll); kivaPoll=null; }
  closeSheet();
}
async function loadKiva(){
  try{
    const d = await api('/kiva');
    const rows = d.messages || [];
    kivaLastId = rows.length ? rows[rows.length-1].id : 0;
    renderKivaFeed(rows);
  }catch(e){ const f=$('#kivaFeed'); if(f) f.innerHTML = '<p class="tiny">Could not reach the Kiva.</p>'; }
}
function renderKivaFeed(rows){
  const feed = $('#kivaFeed'); if(!feed) return;
  feed.innerHTML = rows.map(m => kivaMsgHtml(m)).join('');
  feed.scrollTop = feed.scrollHeight;
}
function kivaMsgHtml(m){
  if(m.kind==='system' || m.kind==='war' || m.kind==='level'){
    return `<div class="kiva-msg system"><b>${esc(m.body)}</b></div>`;
  }
  const mine = S.user && m.user_id === S.user.id;
  const role = (m.role||'').toLowerCase();
  const roleTag = (role && role!=='toddler') ? `<span class="km-role">${esc(m.role)}</span>` : '';
  const pin = m.pinned ? '📌 ' : '';
  const canPin = ['Chief','Head','Elder'].includes(S.user.role);
  return `<div class="kiva-msg ${mine?'self':''} ${m.pinned?'pinned':''}" data-mid="${m.id}">
    <div class="km-av" style="${m.name_color?('color:'+m.name_color):''}">${esc((m.first_name||'?').slice(0,1).toUpperCase())}</div>
    <div class="km-body">
      <div class="km-meta"><span class="km-name">${esc(m.first_name||m.username||'Kin')}</span>${roleTag}<span>${fmtTime(m.created_at)}</span></div>
      <div class="km-text">${pin}${esc(m.body)}</div>
      ${canPin?`<div class="km-actions"><button data-act="pinKiva" data-val="${m.id}">${m.pinned?'Unpin':'Pin'}</button></div>`:''}
    </div>
  </div>`;
}
function fmtTime(t){
  try{
    const d = new Date(t);
    return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  }catch(e){ return ''; }
}
function connectKivaStream(){
  if(!S.tribe) return;
  try{
    kivaEs = new EventSource('/api/kiva/stream?tribeId='+encodeURIComponent(S.tribe.id));
    let opened = false;
    const guard = setTimeout(()=>{ if(!opened && kivaEs){ kivaEs.close(); kivaEs=null; startKivaPoll(); } }, 3000);
    kivaEs.onopen = ()=>{ opened = true; clearTimeout(guard); if(kivaPoll){ clearInterval(kivaPoll); kivaPoll=null; } };
    kivaEs.onmessage = ev => {
      try{
        const msg = JSON.parse(ev.data);
        if(msg.type==='message' && msg.message && msg.message.id > kivaLastId){
          kivaLastId = msg.message.id;
          const feed = $('#kivaFeed');
          if(feed){ feed.insertAdjacentHTML('beforeend', kivaMsgHtml(msg.message)); feed.scrollTop = feed.scrollHeight; }
        } else if(msg.type==='pin'){
          const node = document.querySelector(`[data-mid="${msg.id}"]`);
          if(node) node.classList.toggle('pinned', !!msg.pinned);
        }
      }catch(e){}
    };
  }catch(e){ startKivaPoll(); }
}
function startKivaPoll(){
  if(kivaPoll) return;
  kivaPoll = setInterval(async ()=>{
    if(!kivaOpen){ clearInterval(kivaPoll); kivaPoll=null; return; }
    try{
      const d = await api('/kiva?since='+kivaLastId);
      const rows = d.messages || [];
      if(rows.length){
        const feed = $('#kivaFeed');
        for(const m of rows){
          if(m.id > kivaLastId){
            kivaLastId = m.id;
            if(feed){ feed.insertAdjacentHTML('beforeend', kivaMsgHtml(m)); feed.scrollTop = feed.scrollHeight; }
          }
        }
      }
    }catch(e){}
  }, 6000);
}
async function sendKiva(){
  const inp = $('#kivaInput'); if(!inp) return;
  const body = inp.value.trim(); if(!body) return;
  inp.value = '';
  try{ await api('/kiva', { body }); haptic(); }
  catch(e){ toast(e.message,'bad'); inp.value = body; }
}
async function pinKiva(messageId){
  try{
    const node = document.querySelector(`[data-mid="${messageId}"]`);
    const pinned = node ? !node.classList.contains('pinned') : true;
    await api('/kiva/pin', { id: Number(messageId), pinned });
    if(node) node.classList.toggle('pinned', pinned);
  }catch(e){ toast(e.message,'bad'); }
}

/* ================= WAR (Batch 2 — full UI) ================= */
let warState = null;
let warTimer = null;
let warData = null;
let selectedFront = 0;
let defenderPanelOpen = false;

function stopWarTicker(){ if(warTimer){ clearInterval(warTimer); warTimer=null; } }
function startWarTicker(endAt){
  stopWarTicker();
  const tick = ()=>{
    const e = $('#warCd'); if(!e){ stopWarTicker(); return; }
    const ms = endAt - Date.now();
    e.textContent = ms<=0 ? 'resolving…' : fmtDur(ms);
  };
  tick();
  warTimer = setInterval(tick, 1000);
}

function warWrap(box){
  if (!warState || warState.wrap.parentNode !== box){
    warState = { wrap: document.createElement('div'), mode: null };
    box.replaceChildren(warState.wrap);
  }
  return warState.wrap;
}
function setMode(mode){
  if (warState.mode !== mode){
    warState.wrap.replaceChildren();
    warState.mode = mode;
  }
}

async function renderWar(box){
  const u = S.user;
  const wrap = warWrap(box);

  if(!u.tribe_id){
    stopWarTicker();
    setMode('no-tribe');
    if (warState.rendered === 'no-tribe') return;
    warState.rendered = 'no-tribe';
    wrap.innerHTML = `<div class="empty"><span class="big">⚔️</span>
      <h2 style="margin:0;color:var(--gold);font-weight:800">No banner to raise</h2>
      <p class="tiny" style="margin-top:8px">You must belong to a tribe before you can wage war.</p></div>
      <button class="btn btn-primary btn-shine btn-block" data-act="gotoTribe">Go to Tribe</button>`;
    return;
  }

  if (!warData){
    setMode('loading');
    if (warState.rendered !== 'loading'){
      warState.rendered = 'loading';
      wrap.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
    }
  }

  let war = null;
  try{ war = (await api('/war')).war; }
  catch(e){
    if (TAB==='war'){
      setMode('error');
      if (warState.rendered !== 'error'){
        warState.rendered = 'error';
        wrap.innerHTML = '<p class="tiny">Could not reach the war drums.</p>';
      }
    }
    return;
  }
  if (TAB !== 'war') return;
  warData = war;

  if (!war){ renderWarNone(wrap); return; }
  if (war.status === 'resolved'){ renderWarDone(wrap, war); return; }
  renderWarActive(wrap, war);
}

function renderWarNone(wrap){
  stopWarTicker();
  setMode('none');
  const can = ['Chief','Head','Elder'].includes(S.user.role);
  const stances = (S.config.war_stances||[]);

  if (warState.rendered === 'none'){
    const btn = wrap.querySelector('[data-act="declareWar"]');
    if (btn){
      btn.disabled = !can;
      btn.className = 'btn ' + (can ? 'btn-danger btn-shine' : 'btn-stone') + ' btn-block';
      btn.textContent = can ? '⚔️ Declare War' : 'Only Elders, Heads & the Chief may declare war';
    }
    return;
  }
  warState.rendered = 'none';
  wrap.innerHTML = `
  <div class="war-arena">
    <div class="war-emblem"><div class="vs">WAR DRUMS</div>
      <p class="tiny" style="margin:6px 0 14px">Declare war to be matched against a random rival tribe. You'll choose your stance first.</p></div>
    <div class="stance-row">
      ${stances.map(s=>`
        <button class="stance-card" data-act="pickStance" data-val="${esc(s.id)}">
          <b>${esc(s.name)}</b><span>${esc(s.desc)}</span>
        </button>`).join('')}
    </div>
    <div class="stance-chosen" id="stanceChosen" data-val="${esc((stances[0]||{}).id||'')}">
      Selected: <b>${esc((stances[0]||{}).name||'—')}</b>
    </div>
    <button class="btn ${can?'btn-danger btn-shine':'btn-stone'} btn-block" ${can?'data-act="declareWar"':'disabled'} style="margin-top:14px">
      ${can ? '⚔️ Declare War' : 'Only Elders, Heads & the Chief may declare war'}
    </button>
  </div>
  <div class="hd"><h2>Trials of War</h2><span class="sub">${S.challenges.length} possible</span></div>
  ${S.challenges.map(c=>`<div class="card" style="padding:14px;margin-bottom:10px">
    <div class="row" style="border:0;padding:0"><span style="font-size:1.7rem">${c.glyph}</span>
      <div style="flex:1"><b style="color:var(--gold)">${esc(c.name)}</b>
        <div class="tiny">${esc(c.desc)}</div></div>
      <span class="pill pill-blood">${c.days}d · ${c.stake}%</span></div></div>`).join('')}`;
}

function renderWarActive(wrap, war){
  const mineA = war.mine === 'attacker';
  const me = mineA ? war.attacker : war.defender;
  const foe = mineA ? war.defender : war.attacker;
  const fronts = war.fronts || [];
  const momentum = war.momentum || [];
  const legendary = war.legendary;

  const sameWar = warState.rendered === 'active' && warState.warId === war.id;

  if (!sameWar){
    setMode('active');
    warState.rendered = 'active';
    warState.warId = war.id;
    selectedFront = 0;
    const meMom = momentum.find(m => Number(m.tribe_id) === Number(me.id)) || { tokens:0, on_rout:false };
    const foeMom = momentum.find(m => Number(m.tribe_id) === Number(foe.id)) || { tokens:0, on_rout:false };

    wrap.innerHTML = `
    <div class="war-arena">
      <div class="war-emblem"><div class="vs">⚔️ WAR ⚔️</div>
        <div class="war-meta-line"><span class="pill pill-gold">Stance: ${esc(war.stance||'—')}</span>${war.cry_used?`<span class="pill pill-blood">Cry raised</span>`:''}</div>
      </div>
      <div class="versus">
        <div class="war-totem"><div class="tm">${artSvg(me.crest)}</div><b>${esc(me.name)}</b></div>
        <div class="clash">🔥</div>
        <div class="war-totem foe"><div class="tm">${artSvg(foe.crest)}</div><b>${esc(foe.name)}</b></div>
      </div>
      <div class="momentum-row">
        <div class="mom-pill ${meMom.on_rout?'rout':''}" data-war="me-mom">
          <span class="mom-tok">${'●'.repeat(Math.min(6, meMom.tokens||0))}${'○'.repeat(Math.max(0, 6-(meMom.tokens||0)))}</span>
          <b>${esc(me.name)}</b>${meMom.on_rout?' <span class="rout-tag">ON ROUT</span>':''}
        </div>
        <div class="mom-pill ${foeMom.on_rout?'rout':''}" data-war="foe-mom">
          <span class="mom-tok">${'●'.repeat(Math.min(6, foeMom.tokens||0))}${'○'.repeat(Math.max(0, 6-(foeMom.tokens||0)))}</span>
          <b>${esc(foe.name)}</b>${foeMom.on_rout?' <span class="rout-tag">ON ROUT</span>':''}
        </div>
      </div>
      <div class="legend-row" id="legendRow" style="${legendary?'':'display:none'}">
        <span class="leg-ico">⚡</span>
        <span class="leg-text">LEGENDARY — all actions ×${legendary?legendary.multiplier:'3'}</span>
      </div>
      <div class="wmeta">
        <div class="box"><b id="warCd" class="cd-live">…</b><span>Time left</span></div>
        <div class="box"><b>${war.stake_pct||20}%</b><span>Stake</span></div>
      </div>
    </div>

    <div class="fronts-wrap" id="frontsWrap">
      ${fronts.map((f, i) => frontHtml(f, i, me, foe)).join('')}
    </div>

    <div class="war-action-panel">
      <div class="wact-head">Push a front</div>
      <div class="wact-front-pick" id="frontPick">
        ${fronts.map((f, i) => `<button class="fp-btn ${i===0?'active':''}" data-act="pickFront" data-val="${i}">${esc(f.name)}</button>`).join('')}
      </div>
      <div class="wact-btns">
        <button class="wact-btn" data-act="warAction" data-val="rally">
          <b>Rally</b><span>+25 pts</span>
        </button>
        <button class="wact-btn" data-act="warAction" data-val="chant">
          <b>Chant</b><span>+150 pts</span>
        </button>
        <button class="wact-btn raid" data-act="warAction" data-val="raid">
          <b>Raid</b><span>+800 pts · cd 4h</span>
        </button>
      </div>
      <div class="wact-foot">Spend from the tribe's war chest.</div>
    </div>

    <div class="war-extra-row">
      <button class="btn btn-ghost" data-act="openChronicle">📜 Chronicle</button>
      <button class="btn btn-ghost" data-act="openLeaderboard">🏅 Top warriors</button>
      ${['Chief','Head','Elder'].includes(S.user.role) && !war.cry_used
        ? `<button class="btn btn-primary" data-act="openCry">📣 Raise a Cry</button>` : ''}
    </div>`;
    startWarTicker(new Date(war.end_at).getTime());
  }

  // Patch front scores
  fronts.forEach((f, i) => {
    const r = wrap.querySelector(`[data-front="${i}"]`);
    if(!r) return;
    const aPct = clamp((f.attacker_score / Math.max(1, f.attacker_score + f.defender_score)) * 100, 0, 100);
    const aBar = r.querySelector('[data-fr="a"]');
    const dBar = r.querySelector('[data-fr="d"]');
    const aScore = r.querySelector('[data-fr="as"]');
    const dScore = r.querySelector('[data-fr="ds"]');
    if(aBar) aBar.style.width = aPct + '%';
    if(dBar) dBar.style.width = (100 - aPct) + '%';
    if(aScore) aScore.textContent = fmt(f.attacker_score);
    if(dScore) dScore.textContent = fmt(f.defender_score);
  });
  const leaderEl = wrap.querySelector('[data-war="lead"]');
  if (leaderEl){
    const totalA = fronts.reduce((s, f)=>s+f.attacker_score, 0);
    const totalD = fronts.reduce((s, f)=>s+f.defender_score, 0);
    leaderEl.textContent = totalA>totalD ? 'You lead' : totalA<totalD ? 'You trail' : 'Dead even';
  }
}

function frontHtml(f, i, me, foe){
  const aPct = clamp((f.attacker_score / Math.max(1, f.attacker_score + f.defender_score)) * 100, 0, 100);
  return `<div class="front-card" data-front="${i}">
    <div class="front-head">
      <span class="front-name">${esc(f.name)}</span>
      <span class="front-scores"><b data-fr="as">${fmt(f.attacker_score)}</b> vs <b data-fr="ds">${fmt(f.defender_score)}</b></span>
    </div>
    <div class="front-bar">
      <i data-fr="a" style="width:${aPct}%"></i>
      <i data-fr="d" style="width:${100-aPct}%"></i>
    </div>
    ${f.fortify_until && new Date(f.fortify_until).getTime() > Date.now() ? `<div class="front-fortified">🛡️ Fortified</div>` : ''}
  </div>`;
}

function renderWarDone(wrap, war){
  stopWarTicker();
  const myId = S.tribe ? Number(S.tribe.id) : null;
  const won = war.winner_id && Number(war.winner_id) === myId;
  const draw = !war.winner_id;
  const mineA = war.mine === 'attacker';
  const foe = mineA ? war.defender : war.attacker;
  const big = draw?'🤝':won?'🏆':'💀';
  setMode('done');
  if (warState.rendered === 'done' && warState.warId === war.id) return;
  warState.rendered = 'done';
  warState.warId = war.id;
  wrap.innerHTML = `
  <div class="war-arena" style="text-align:center">
    <div class="war-emblem"><div class="vs">${draw?'STALEMATE':won?'VICTORY':'DEFEAT'}</div></div>
    <span style="font-size:3.2rem;display:block;margin:6px 0 4px">${big}</span>
    <p class="tiny" style="max-width:280px;margin:6px auto 0">${draw?'Neither fire could break the other.':won
      ?('Your tribe crushed '+esc(foe.name)+', seizing '+fmt(war.reward_ember)+' Ember and '+fmt(war.tribute||0)+' tribute.')
      :('Your tribe fell to '+esc(foe.name)+', paying '+fmt(war.tribute||0)+' Ember in tribute.')}</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="declareWar" ${['Chief','Head','Elder'].includes(S.user.role)?'':'disabled'}>⚔️ Rally for a New War</button>
  <button class="btn btn-ghost btn-block" data-act="openChronicle" style="margin-top:8px">📜 View Chronicle</button>`;
}

// ---- actions ----
function pickStance(btn, id){
  $$('.stance-card').forEach(b=>b.classList.toggle('active', b.dataset.val===id));
  const c = $('#stanceChosen');
  if(c){ c.dataset.val = id; const s = (S.config.war_stances||[]).find(x=>x.id===id); if(s) c.innerHTML = 'Selected: <b>'+esc(s.name)+'</b>'; }
  haptic('light');
}
function pickFront(btn, idx){
  selectedFront = Number(idx);
  $$('.fp-btn').forEach(b=>b.classList.toggle('active', Number(b.dataset.val)===selectedFront));
  haptic('light');
}

async function actWarAction(btn, kind){
  await doAct(btn, async () => {
    const r = await api('/war/action', { front: selectedFront, kind });
    haptic('heavy');
    burstAt(btn, 18);
    popAt(btn, '+'+fmt(r.points));
    toast(`${kind} · +${fmt(r.points)} on ${r.front}${r.multiplier>1?' (×'+r.multiplier.toFixed(2)+')':''}`,'good');
    // Refresh the war so scores update
    warData = null;
    await refresh();
    renderScreen('war');
  });
}

function openCrySheet(){
  const cries = (S.config.war_cries||[]);
  sheet(`
    <h3>Raise a War Cry</h3>
    <div class="sub">Announced in both tribes' Kivas. One per war.</div>
    ${cries.map(c=>`
      <button class="cry-card" data-act="doCry" data-val="${esc(c.id)}">
        <b>${esc(c.name)}</b>
        <span>${esc(c.desc||('Cost: '+fmt(c.cost)+' Ember'))}</span>
        <span class="cry-cost">${fmt(c.cost)} Ember</span>
      </button>`).join('')}
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>
  `);
}
async function doCry(btn, id){
  await doAct(btn, async () => {
    await api('/war/cry', { cry: id });
    haptic('heavy');
    toast('War Cry raised!','good');
    closeSheet();
    warData = null;
    await refresh();
    renderScreen('war');
  });
}

async function openChronicle(){
  try{
    const d = await api('/war/chronicle');
    const rows = d.chronicles || [];
    sheet(`<div class="chronicle-sheet">
      <h3>Chronicle</h3>
      <div class="sub">Permanent record of your wars.</div>
      ${rows.length ? rows.map(c=>`
        <div class="chron-card">
          <div class="chron-top"><b>${esc(c.attacker_name||'?')}</b> vs <b>${esc(c.defender_name||'?')}</b></div>
          <div class="chron-scores">${fmt(c.score_a||0)} — ${fmt(c.score_d||0)}</div>
          <div class="tiny">Stance ${esc(c.stance||'—')} · Tribute ${fmt(c.tribute||0)}${c.is_rivalry?' · RIVALRY':''}</div>
        </div>`).join('') : '<p class="tiny">No wars yet.</p>'}
      <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Close</button>
    </div>`);
  }catch(e){ toast(e.message,'bad'); }
}

async function openLeaderboard(){
  try{
    const d = await api('/war/leaderboard');
    const rows = d.rows || [];
    sheet(`<div class="chronicle-sheet">
      <h3>Top Warriors</h3>
      <div class="sub">Contribution in the current war.</div>
      ${rows.length ? rows.map((r,i)=>`
        <div class="chron-card">
          <div class="chron-top">#${i+1} <b>${esc(r.first_name||r.username||'Kin')}</b> <span class="pill pill-blood">${esc(r.side)}</span></div>
          <div class="chron-scores">${fmt(r.points)} pts</div>
        </div>`).join('') : '<p class="tiny">No actions yet.</p>'}
      <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Close</button>
    </div>`);
  }catch(e){ toast(e.message,'bad'); }
}

async function actDeclare(btn){
  await doAct(btn, async () => {
    const chosen = ($('#stanceChosen')||{}).dataset?.val || ((S.config.war_stances||[{}])[0].id);
    const r = await api('/war/declare', { stance: chosen });
    haptic('heavy');
    toast('War declared against '+r.war.defender.name+'!','good');
    warData = null;
    warState.rendered = null;
    await refresh();
    renderScreen('war');
  });
}

/* ================= RANKS (patched render) ================= */
let ranksState = null;
function buildRanksScreen(){
  const p = PERF || null;
  const e = (tag, props, ...kids) => p ? p.h(tag, props, ...kids) : (()=>{
    const n=document.createElement(tag);
    if(props){ for(const k in props){
      if(k==='class') n.className=props[k];
      else if(k==='text') n.textContent=props[k];
      else n.setAttribute(k, props[k]);
    }}
    for(const c of kids.flat()) if(c) n.appendChild(typeof c==='string'?document.createTextNode(c):c);
    return n;
  })();
  const list = e('div', { class:'ranks-list', id:'ranksList' });
  const root = e('div', { class:'ranks-wrap' },
    e('div', { class:'hd' }, e('h2', { text:'Hall of Tribes' }), e('span', { class:'sub', text:'ranked by loyalty' })),
    list
  );
  return { root, listEl: list, rows: new Map() };
}
function buildRanksRow(t, i, top, mineId){
  const p = PERF || null;
  const e = (tag, props, ...kids) => p ? p.h(tag, props, ...kids) : (()=>{
    const n=document.createElement(tag);
    if(props){ for(const k in props){
      if(k==='class') n.className=props[k];
      else if(k==='text') n.textContent=props[k];
      else n.setAttribute(k, props[k]);
    }}
    for(const c of kids.flat()) if(c) n.appendChild(typeof c==='string'?document.createTextNode(c):c);
    return n;
  })();
  const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
  const isMe = mineId && Number(t.id)===Number(mineId);
  const pct = clamp(Number(t.loyalty_total)/top*100, 4, 100);
  const name = e('b', { class:'rk-name', html:'' });
  const meta = e('div', { class:'tiny' });
  const score = e('b', { class:'rk-score' });
  const barFill = e('i', { class:'rk-fill', style:{ width: pct.toFixed(1)+'%' } });
  const bar = e('div', { class:'bar' }, barFill);
  const avatar = e('span', { class:'avatar', text: medal });
  const info = e('div', { style:{ flex:'1', minWidth:'0' } }, name, meta);
  const topRow = e('div', { class:'row', style:{ border:'0', padding:'0 0 10px' } }, avatar, info, score);
  const card = e('div', { class:'card', style:{ padding:'14px', marginBottom:'10px', borderColor: isMe ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : '' } }, topRow, bar);
  return { card, name, meta, score, barFill, avatar };
}
function patchRanksRow(row, t, i, top, mineId){
  const p = PERF || null;
  const setText = p ? p.setText : (el,v)=>{ if(el.textContent!==String(v)) el.textContent=String(v); };
  const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
  const isMe = mineId && Number(t.id)===Number(mineId);
  const pct = clamp(Number(t.loyalty_total)/top*100, 4, 100);
  setText(row.avatar, medal);
  row.name.innerHTML = `${esc(t.name)}${isMe?' · you':''}`;
  setText(row.meta, `${fmt(t.members)} kin · 🏆${t.wins||0} 💀${t.losses||0} · Pyre ${fmt(t.treasury)}`);
  setText(row.score, fmt(t.loyalty_total));
  if (row.barFill.style.width !== (pct.toFixed(1)+'%')) row.barFill.style.width = pct.toFixed(1)+'%';
  row.card.style.borderColor = isMe ? 'color-mix(in srgb, var(--gold) 40%, transparent)' : '';
}
function renderRanks(box){
  if (!PERF){
    const lb = S.leaderboard||[];
    const top = lb.length ? (Number(lb[0].loyalty_total)||1) : 1;
    const mine = S.tribe ? Number(S.tribe.id) : null;
    box.innerHTML = `<div class="hd"><h2>Hall of Tribes</h2><span class="sub">ranked by loyalty</span></div>
    ${lb.length ? lb.map((t,i)=>{
      const pct = clamp(Number(t.loyalty_total)/top*100, 4, 100);
      const me = mine && mine===Number(t.id);
      const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':('#'+(i+1));
      return `<div class="card" style="padding:14px;margin-bottom:10px;${me?'border-color:color-mix(in srgb, var(--gold) 40%, transparent)':''}">
        <div class="row" style="border:0;padding:0 0 10px">
          <span class="avatar">${medal}</span>
          <div style="flex:1;min-width:0"><b style="color:var(--gold)">${esc(t.name)}${me?' · you':''}</b>
            <div class="tiny">${fmt(t.members)} kin · 🏆${t.wins||0} 💀${t.losses||0} · Pyre ${fmt(t.treasury)}</div></div>
          <b style="color:var(--gold);white-space:nowrap">${fmt(t.loyalty_total)}</b></div>
        <div class="bar"><i style="width:${pct}%"></i></div></div>`;
    }).join('') : '<div class="empty"><span class="big">🏆</span><p class="tiny">No tribes have risen yet.</p></div>'}`;
    return;
  }
  const lb = S.leaderboard || [];
  const top = lb.length ? (Number(lb[0].loyalty_total)||1) : 1;
  const mine = S.tribe ? Number(S.tribe.id) : null;
  if (!ranksState){
    ranksState = buildRanksScreen();
    box.replaceChildren(ranksState.root);
  }
  if (!lb.length){
    ranksState.listEl.replaceChildren(
      PERF.h('div', { class:'empty' },
        PERF.h('span', { class:'big', text:'🏆' }),
        PERF.h('p', { class:'tiny', text:'No tribes have risen yet.' })
      )
    );
    ranksState.rows.clear();
    return;
  }
  const seen = new Set();
  lb.forEach((t, i) => {
    seen.add(String(t.id));
    let row = ranksState.rows.get(String(t.id));
    if (!row){
      const built = buildRanksRow(t, i, top, mine);
      ranksState.rows.set(String(t.id), built);
      ranksState.listEl.appendChild(built.card);
      patchRanksRow(built, t, i, top, mine);
    } else {
      patchRanksRow(row, t, i, top, mine);
      const expectedNode = ranksState.listEl.children[i];
      if (expectedNode !== row.card){
        ranksState.listEl.insertBefore(row.card, expectedNode || null);
      }
    }
  });
  for (const [id, row] of [...ranksState.rows]){
    if (!seen.has(id)){ row.card.remove(); ranksState.rows.delete(id); }
  }
}

/* ---------- STORE ---------- */
const ART_FOR = { spark:'flame', flame:'torch', blaze:'firestone', inferno:'sun', charm:'charm', auto:'torch', firestone:'firestone', boneidol:'idol', sundisc:'sun', moonshard:'moon', name_color_ember:'flame', name_color_jade:'flame', name_color_void:'moon', glow_ember:'flame', glow_frost:'moon', war_chest_topup:'firestone', rally_burst:'flame' };
function storeSectionFor(key, it){
  if(key==='starter_bundle') return 'featured';
  if(key.startsWith('name_color_')||key.startsWith('glow_')) return 'cosmetics';
  if(key==='pyreboost') return 'boosts';
  if(key==='war_chest_topup'||key==='rally_burst') return 'war';
  if(['firestone','boneidol','sundisc','moonshard'].includes(key)) return 'relics';
  return 'ember';
}
function renderStore(box){
  const p = S.payments;
  const star = p.starItems||{};
  const ton = p.tonItems||{};
  const featuredKey = 'starter_bundle';
  const featured = star[featuredKey];
  const sections = { ember:[], relics:[], boosts:[], war:[], cosmetics:[] };
  for(const [k,it] of Object.entries(star)){
    if(k===featuredKey) continue;
    const s = storeSectionFor(k, it);
    if(sections[s]) sections[s].push([k,it]);
  }
  box.innerHTML = `<div class="hd"><h2>Trading Post</h2><span class="sub">⭐ Stars · ◈ TON</span></div>
    ${!TG ? '<p class="tiny" style="margin-bottom:12px">Open inside Telegram to pay with Stars.</p>' : ''}
    ${featured ? `
      <div class="featured">
        <span class="ft-badge">ONE-TIME</span>
        <div class="ft-art">${artSvg('firestone')}</div>
        <h3>${esc(featured.title)}</h3>
        <p>${esc(featured.desc)}</p>
        <div class="ft-price">
          <button class="b" data-act="buyStars" data-val="${featuredKey}">⭐ ${fmt(featured.stars)}</button>
        </div>
      </div>` : ''}
    <div class="shop-tabs">
      ${Object.keys(sections).filter(s=>sections[s].length).map((s,i)=>`<button class="shop-tab ${i===0?'active':''}" data-act="shopTab" data-val="${s}">${({ember:'Ember Packs',relics:'Relics',boosts:'Tribe Boosts',war:'War',cosmetics:'Cosmetics'})[s]}</button>`).join('')}
    </div>
    ${Object.entries(sections).map(([s,arr])=>`
      <div class="shop-section" data-section="${s}" style="${s==='ember'?'':'display:none'}">
        <div class="shop-rail">
          ${arr.map(([k,it])=>{
            const hasTon = p.tonEnabled && ton[k];
            const rar = (it.grant&&it.grant.relic)?'<span class="rar pill pill-gold">Relic</span>':(it.grant&&it.grant.cosmetic)?'<span class="rar pill pill-jade">Look</span>':(s==='war')?'<span class="rar pill pill-blood">War</span>':'';
            return `<div class="shop-card">${rar}
              <div class="sc-art">${artSvg(ART_FOR[k]||'flame')}</div>
              <b>${esc(it.title)}</b><p>${esc(it.desc)}</p>
              <div class="sc-price">
                <button class="b star" data-act="buyStars" data-val="${k}">⭐ ${fmt(it.stars)}</button>
                ${hasTon?`<button class="b ton" data-act="buyTon" data-val="${k}">◈ ${ton[k].ton}</button>`:''}
              </div></div>`;
          }).join('') || '<p class="tiny">Coming soon.</p>'}
        </div>
      </div>`).join('')}
    <p class="tiny" style="text-align:center;margin-top:16px">Secured by Telegram Stars &amp; the TON blockchain.</p>`;
}
function shopTab(btn, key){
  $$('.shop-tab').forEach(b=>b.classList.toggle('active', b.dataset.val===key));
  $$('.shop-section').forEach(s=>s.style.display = (s.dataset.section===key ? '' : 'none'));
}

/* ---------- bonfire banner ---------- */
let bonfireTimer = null;
function startBonfireTicker(){
  if(bonfireTimer) clearInterval(bonfireTimer);
  bonfireTimer = setInterval(renderBonfire, 1000);
  renderBonfire();
}
function renderBonfire(){
  const bf = S && S.bonfire;
  const node = $('#bonfireBanner'); if(!node) return;
  if(!bf){ node.style.display='none'; return; }
  const end = new Date(bf.end_at).getTime();
  const ms = end - Date.now();
  if(ms <= 0){ node.style.display='none'; return; }
  node.style.display='flex';
  node.innerHTML = `<span class="bf-ico">🔥</span>
    <span class="bf-text"><b>${esc(bf.title)}</b> · ${esc(bf.metric)} ×${bf.multiplier}</span>
    <span class="bf-cd" id="bfCd">${fmtDur(ms)}</span>`;
}

/* ---------- push poller ---------- */
let pushTimer = null;
function startPushPoller(){
  if(pushTimer) return;
  pushTimer = setInterval(()=>{ if(document.visibilityState==='visible') refresh(); }, 45000);
}

/* ---------- action registry ---------- */
const ACTS = {
  tapFire:   (b)=>tapFire(b),
  ash:       actAsh,
  trial:     actTrial,
  holdStart: (b,v)=>holdStart(b,v),
  share:     actShare,
  openCreate, pickName, pickPalette, pickBanner,
  doCreate, join: actJoin, leave: actLeave,
  openDonate, setDon, doDonate,
  openKiva, closeKiva, sendKiva, pinKiva,
  upgrade:   actUpgrade,
  buyStars:  (b,v)=>buyStars(v),
  buyTon:    (b,v)=>buyTon(v),
  declareWar:actDeclare,
  pickStance, pickFront,
  warAction: actWarAction,
  openCry:   ()=>openCrySheet(),
  doCry,
  openChronicle, openLeaderboard,
  gotoTribe: ()=>setTab('tribe'),
  shopTab,
  closeSheet:()=>closeSheet(),
  bgClose:(b,v,e)=>{ if(e&&e.target&&e.target.classList&&e.target.classList.contains('sheet-bg')) closeSheet(); },
};

/* ---------- init ---------- */
function init(){
  document.addEventListener('click', e=>{
    const b = e.target.closest('[data-act]');
    if(b){ const f = ACTS[b.dataset.act]; if(f){ f(b, b.dataset.val, e); return; } }
    const nav = e.target.closest('.nav-i');
    if(nav){ haptic(); setTab(nav.dataset.tab); return; }
    if(e.target.closest('#crestBtn')){ setTab('tribe'); return; }
    if(e.target.closest('#tonBtn')){ tonToggle(); return; }
  });
  document.addEventListener('pointerdown', e=>{
    const btn = e.target.closest('.hold-btn');
    if(!btn) return;
    e.preventDefault();
    holdStart(btn, btn.dataset.val);
  });
  document.addEventListener('pointerup', holdCancel);
  document.addEventListener('pointercancel', holdCancel);
  document.addEventListener('pointerleave', holdCancel);

  const rb = $('#retryBtn'); if(rb) rb.addEventListener('click', ()=>{ setBoot('Waking the ancestors…'); boot(); });
  const gr = $('#gateRetry'); if(gr) gr.addEventListener('click', ()=>{ $('#gate').style.display='none'; setBoot('Waking…'); boot(); });
  setInterval(()=>{
    if(TAB==='war' && document.visibilityState==='visible' && S && S.user && S.user.tribe_id) renderScreen('war');
  }, 20000);
  boot();
}
init();