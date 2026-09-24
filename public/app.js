/* =====================================================================
   TRIBES — Mini App client. Obsidian Glass UI.
   Talks to /api/* with Telegram initData auth. Phase 1:
     * username hard-gate
     * trial system (replaces daily rites)
     * kiva (SSE + polling fallback)
     * bonfire banner
     * tribe levels + names pool
     * redesign: trials list, store rails, animated FABs, ceremony
===================================================================== */
'use strict';
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
const T = (k, fallback) => (window.TRIBES_STRINGS && window.TRIBES_STRINGS[k]) || fallback || k;
const haptic = (t='light') => { try{ TG&&TG.HapticFeedback&&TG.HapticFeedback.impactOccurred(t); }catch(e){} };

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

/* ---------- ceremony ---------- */
let ceremonyTimer=null;
function showCeremony(icon, title, sub, duration=2200){
  const c=$('#ceremony'); if(!c) return;
  $('#ceremonyIcon').textContent = icon;
  $('#ceremonyTitle').textContent = title;
  $('#ceremonySub').textContent = sub || '';
  c.style.display='grid';
  clearTimeout(ceremonyTimer);
  ceremonyTimer = setTimeout(()=>{ c.style.display='none'; }, duration);
}
window.__tribesCeremony = showCeremony;

/* ---------- guest id ---------- */
let GUEST = localStorage.getItem('tribes.guest');
if(!GUEST){ GUEST='g'+String(Math.floor(Math.random()*9e9)+1e9); localStorage.setItem('tribes.guest',GUEST); }

/* ---------- API ---------- */
async function api(path, body, opts){
  opts = opts || {};
  const headers = { 'Content-Type':'application/json' };
  if(TG && TG.initData) headers['X-Init-Data'] = TG.initData;
  headers['X-Guest-Id'] = GUEST;
  const READ_PATHS = ['/state','/health','/war','/tribes','/tribe/names','/kiva','/bonfire','/cosmetics','/trials'];
  const m = opts.method
    || (body !== undefined ? 'POST'
        : (READ_PATHS.some(p => path === p || path.startsWith(p + '?') || path.startsWith(p + '/')) ? 'GET' : 'POST'));
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
  initTon(); applyPalette(); renderAll(); showApp();
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

/* ---------- palette / theme ---------- */
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
      ${ready ? T('tap_fire','Tap the fire to feed it') + ' 🔥' : T('next_blessing','Next blessing in') + ' ' + fmtDur(readyIn)}
    </div>
  </div>

  <div class="card">
    <div class="checkin">
      <div class="dial" style="--p:${ready?100:pct.toFixed(0)}"><b>${u.streak||0}<i>STREAK</i></b></div>
      <div style="flex:1">
        <h3 style="margin:0 0 4px">${T('keeper_title','Keeper of the Flame')}</h3>
        <p class="tiny" style="margin:0">${T('keeper_hint','Feed the fire every day to grow your streak. Longer streaks pour out ever more Ember from the ancestors.')}</p>
      </div>
    </div>
  </div>

  <div class="card">
    <div class="hd" style="margin:0 0 10px"><h2 style="font-size:1.05rem">${T('ash_pit','The Ash Pit')}</h2><span class="pill pill-gold">${T('ash_idle','Idle · Ash → Ember')}</span></div>
    <p class="tiny" style="margin:0 0 12px">${T('ash_hint','Cinders gather while you\u2019re away')} — ${S.config.ashCap} ${T('ash_charges','charges')} × ${S.ashUnit} Ember.</p>
    <div style="display:grid;grid-template-columns:auto 1fr;align-items:center;gap:14px">
      <div class="dial" style="--p:${((S.ashPending/S.config.ashCap)*100).toFixed(0)}"><b>${S.ashPending}<i>ASH</i></b></div>
      <button class="btn ${S.ashPending>0?'btn-primary btn-shine':'btn-stone'} btn-block" data-act="ash">
        ${S.ashPending>0 ? T('gather','Gather')+' '+S.ashPending+' Ash (+'+fmt(S.ashPending*S.ashUnit)+')' : T('smouldering','Smouldering…')}
      </button>
    </div>
  </div>

  <div class="hd"><h2>${T('trials_title','Trials')}</h2><span class="sub">${T('trials_sub','earn Ember & Loyalty')}</span></div>
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
    const chev = t.available
      ? '<span class="ti-chev">›</span>'
      : '<span class="ti-check">✓</span>';
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

  if(fireReadyIn() > 0){
    haptic('soft');
    fxPop('⏳', cx, cy-30);
    return;
  }
  api('/checkin').then(r => {
    if(!r.ok){
      haptic('soft');
      fxPop('⏳', cx, cy-30);
      return;
    }
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
async function actTrial(btn, slug){
  await doAct(btn, async () => {
    const r = await api('/trials/'+encodeURIComponent(slug));
    if(!r.ok){ toast('Not ready yet','warn'); return; }
    burstAt(btn, 12); popAt(btn,'+'+fmt(r.reward_ember)); haptic();
    const parts=[];
    if(r.reward_ember) parts.push('+'+fmt(r.reward_ember)+' Ember');
    if(r.reward_loyalty) parts.push('+'+fmt(r.reward_loyalty)+' Loyalty');
    toast(`Trial complete: ${parts.join(' · ')}`,'good');
    await refresh();
  });
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
      <div class="hd" style="margin:0 0 10px"><h2 style="font-size:1.05rem">${T('kiva','Kiva')}</h2><span class="sub">tribe talk</span></div>
      <div class="kiva-hero" data-act="openKiva">
        <div class="kh-ico">💬</div>
        <div class="kh-body"><b>${T('open_kiva','Open the Kiva')}</b><span>${T('kiva_hint','Talk with your kin')}</span></div>
        <div class="kh-badge" id="kivaBadge" style="display:none">0</div>
      </div>
    </div>

    <div class="card">
      <h3>Stoke the Great Pyre</h3>
      <p class="tiny" style="margin:0 0 14px">Donate your Ember to the tribe treasury. A deep Pyre wins wars — and every gift earns you Loyalty.</p>
      <button class="btn btn-primary btn-shine btn-block" data-act="openDonate">🔥 ${T('donate','Donate Ember to the Pyre')}</button>
    </div>

    <div class="card">
      <h3>${T('level_up','Level Up')}</h3>
      <p class="tiny" style="margin:0 0 10px">
        ${(t.level||1) < levels.costs.length
          ? `Raise to <b>${esc(levels.names[(t.level||1)])}</b> · cap ${nextCap} · costs ${fmt(nextCost)} Ember from the Pyre.`
          : 'Your tribe has reached the highest level — Kingdom.'}
      </p>
      ${(t.level||1) < levels.costs.length
        ? `<button class="btn ${canUpgrade?'btn-primary btn-shine':'btn-stone'} btn-block" data-act="upgrade" ${canUpgrade?'':'disabled'}>
             ${canUpgrade ? '⚡ '+T('raise','Raise the level') : T('pyre_too_shallow','The Great Pyre is too shallow')}
           </button>`
        : ''}
    </div>

    <button class="btn btn-danger btn-block" data-act="leave" style="margin-top:4px">${T('leave','Leave the Tribe')}</button>
    <p class="tiny" style="text-align:center;margin-top:12px">${wl ? ('Battle record · '+t.wins+' won, '+t.losses+' lost') : 'Your tribe has yet to taste war.'}</p>`;
    return;
  }

  // No tribe
  box.innerHTML = `
  <div class="empty"><span class="big">🪨</span>
    <h2 style="margin:0;color:var(--gold);font-weight:800">${T('alone','You wander alone')}</h2>
    <p class="tiny" style="margin-top:8px">${T('alone_hint','Found your own tribe or join an existing fire. Tribes wage war, hoard the Great Pyre, and climb the ranks together.')}</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="openCreate">🔥 ${T('found','Found a Tribe')} · ${fmt(S.config.foundEmber)} Ember</button>
  <div class="hd" style="margin-top:20px"><h2>${T('join_fire','Join a Fire')}</h2><span class="sub">strongest tribes</span></div>
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
    showCeremony('⚡', r.name.toUpperCase(), `Your tribe rises. Cap ${r.cap}.`, 2400);
    burstAt(btn, 30);
    toast(`Risen to ${r.name}!`,'good');
    await refresh();
  });
}

/* ---------- sheets ---------- */
function sheet(html){
  $('#sheetRoot').innerHTML = `<div class="sheet-bg" data-act="bgClose"><div class="sheet"><div class="handle"></div>${html}</div></div>`;
}
function closeSheet(){ $('#sheetRoot').innerHTML=''; }

async function openCreate(){
  pickedCrest='totem'; pickedPalette='ember'; pickedBanner='sun'; pickedNameId=null;
  sheet(`<h3>${T('found_title','Found a Tribe')}</h3><div class="sub">Costs ${fmt(S.config.foundEmber)} Ember · you become Chief</div>
    <div class="field"><input id="tMotto" maxlength="80" placeholder="Battle motto (optional)"/></div>
    <div class="tiny" style="margin:6px 0 8px">${T('pick_name','Pick a tribe name (first-come, first-served)')}</div>
    <div id="nameGrid" class="grid2" style="grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"><div class="skeleton" style="height:36px"></div><div class="skeleton" style="height:36px"></div></div>
    <div class="tiny" style="margin-bottom:6px">${T('pick_banner','Pick a banner')}</div>
    <div class="grid2" id="bannerGrid" style="grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">
      ${(S.config.banners||['sun','moon','wolf','bear','spear','shield','tree','flame']).map(b=>`<button class="btn btn-stone" data-act="pickBanner" data-val="${b}" style="padding:10px;font-size:1rem">${bannerGlyph(b)}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-bottom:6px">${T('pick_palette','Pick a palette')}</div>
    <div class="grid2" id="paletteGrid" style="grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px">
      ${Object.keys(S.config.palette||{}).map(p=>`<button class="btn btn-stone" data-act="pickPalette" data-val="${p}" style="padding:10px;font-size:.78rem;border-left:4px solid ${S.config.palette[p].accent}">${p}</button>`).join('')}
    </div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doCreate">${T('light_first','Light the First Fire')}</button>
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
function pickCrest(btn,val){
  pickedCrest = val;
  $$('#crestGrid .crest-art').forEach(b=>b.style.borderColor = (b.dataset.val===val ? 'var(--gold)' : 'var(--line)'));
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
    closeSheet();
    haptic('medium');
    showCeremony('🔥', T('tribe_born','TRIBE BORN'), 'Your fire is lit.', 2200);
    toast('Your tribe is born!','good');
    await refresh();
  });
}
async function actJoin(btn, id){
  await doAct(btn, async () => {
    await api('/tribe/join', { tribeId: Number(id) });
    haptic();
    toast('You joined the fire!','good');
    await refresh();
  });
}
async function actLeave(btn){
  await doAct(btn, async () => {
    await api('/tribe/leave');
    toast('You left the tribe','warn');
    await refresh();
  });
}
function openDonate(){
  sheet(`<h3>${T('donate_title','Stoke the Great Pyre')}</h3><div class="sub">You hold ${fmt(S.user.ember)} Ember</div>
    <div class="field"><input id="dAmt" type="number" min="1" placeholder="Ember to donate"/></div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      ${[500,2500,10000].map(v=>`<button class="btn btn-stone" style="flex:1;padding:12px 8px;font-size:.82rem" data-act="setDon" data-val="${v}">${fmt(v)}</button>`).join('')}</div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doDonate">${T('donate','Donate to the Pyre')}</button>
    <button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Cancel</button>`);
}
function setDon(btn, v){ const i=$('#dAmt'); if(i) i.value = v; }
async function doDonate(btn){
  await doAct(btn, async () => {
    const amt = Math.floor(Number($('#dAmt')?.value)||0);
    if(amt<1){ toast('Enter an amount','warn'); return; }
    const r = await api('/tribe/donate', { amount: amt });
    closeSheet();
    haptic('medium');
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
    <div class="kiva-head"><b>${esc(S.tribe.name)} — ${T('kiva','Kiva')}</b>
      <button class="btn btn-ghost" data-act="closeKiva" style="padding:6px 10px;font-size:.72rem">Close</button></div>
    <div class="kiva-feed" id="kivaFeed"><div class="skeleton" style="height:44px"></div></div>
    <div class="kiva-compose">
      <input id="kivaInput" maxlength="280" placeholder="${T('kiva_placeholder','Say something to the tribe…')}"/>
      <button class="send" data-act="sendKiva">➤</button>
    </div>
  </div>`);
  await loadKiva();
  connectKivaStream();
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
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return hh+':'+mm;
  }catch(e){ return ''; }
}
function connectKivaStream(){
  if(!S.tribe) return;
  // Try SSE; if it fails within 3s, fall back to polling.
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
          if(feed){
            feed.insertAdjacentHTML('beforeend', kivaMsgHtml(msg.message));
            feed.scrollTop = feed.scrollHeight;
          }
        } else if(msg.type==='pin'){
          const node = document.querySelector(`[data-mid="${msg.id}"]`);
          if(node) node.classList.toggle('pinned', !!msg.pinned);
        }
      }catch(e){}
    };
    kivaEs.onerror = ()=>{ /* browser auto-reconnects, but fall back if it stays closed */ };
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
            if(feed){
              feed.insertAdjacentHTML('beforeend', kivaMsgHtml(m));
              feed.scrollTop = feed.scrollHeight;
            }
          }
        }
      }
    }catch(e){}
  }, 6000);
}
async function sendKiva(){
  const inp = $('#kivaInput'); if(!inp) return;
  const body = inp.value.trim();
  if(!body) return;
  inp.value = '';
  try{
    await api('/kiva', { body });
    haptic();
  }catch(e){ toast(e.message,'bad'); inp.value = body; }
}
async function pinKiva(messageId){
  try{
    const node = document.querySelector(`[data-mid="${messageId}"]`);
    const pinned = node ? !node.classList.contains('pinned') : true;
    await api('/kiva/pin', { id: Number(messageId), pinned });
    if(node) node.classList.toggle('pinned', pinned);
  }catch(e){ toast(e.message,'bad'); }
}

/* ---------- WAR ---------- */
let warTimer = null;
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
async function renderWar(box){
  const u = S.user;
  if(!u.tribe_id){
    stopWarTicker();
    box.innerHTML = `<div class="empty"><span class="big">⚔️</span>
      <h2 style="margin:0;color:var(--gold);font-weight:800">${T('no_banner','No banner to raise')}</h2>
      <p class="tiny" style="margin-top:8px">${T('no_banner_hint','You must belong to a tribe before you can wage war.')}</p></div>
      <button class="btn btn-primary btn-shine btn-block" data-act="gotoTribe">${T('go_tribe','Go to Tribe')}</button>`;
    return;
  }
  box.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  let war = null;
  try{ war = (await api('/war')).war; }
  catch(e){ if(TAB==='war') box.innerHTML = '<p class="tiny">Could not reach the war drums.</p>'; return; }
  if(TAB!=='war') return;
  if(!war){ renderWarNone(box); return; }
  if(war.status==='resolved'){ renderWarDone(box, war); return; }
  renderWarActive(box, war);
}
function renderWarNone(box){
  stopWarTicker();
  const can = ['Chief','Head','Elder'].includes(S.user.role);
  box.innerHTML = `
  <div class="war-arena">
    <div class="war-emblem"><div class="vs">${T('war_drums','WAR DRUMS')}</div>
      <p class="tiny" style="margin:6px 0 14px">${T('war_hint','Declare war to be matched against a random rival tribe. Winner seizes Ember and tribute.')}</p></div>
    <button class="btn ${can?'btn-danger btn-shine':'btn-stone'} btn-block" ${can?'data-act="declareWar"':'disabled'}>
      ${can ? '⚔️ '+T('declare','Declare War') : T('declare_locked','Only Elders, Heads & the Chief may declare war')}
    </button>
  </div>
  <div class="hd"><h2>${T('trials_of_war','Trials of War')}</h2><span class="sub">${S.challenges.length} possible</span></div>
  ${S.challenges.map(c=>`<div class="card" style="padding:14px;margin-bottom:10px">
    <div class="row" style="border:0;padding:0"><span style="font-size:1.7rem">${c.glyph}</span>
      <div style="flex:1"><b style="color:var(--gold)">${esc(c.name)}</b>
        <div class="tiny">${esc(c.desc)}</div></div>
      <span class="pill pill-blood">${c.days}d · ${c.stake}%</span></div></div>`).join('')}`;
}
function renderWarActive(box, war){
  const mineA = war.mine==='attacker';
  const me = mineA?war.attacker:war.defender;
  const foe = mineA?war.defender:war.attacker;
  const myScore = Number(mineA?war.attacker_score:war.defender_score);
  const foeScore = Number(mineA?war.defender_score:war.attacker_score);
  const goal = Number(war.goal);
  const tot = myScore + foeScore || 1;
  const mePct = clamp(myScore/tot*100, 0, 100);
  const leadTxt = myScore>foeScore?'You lead':myScore<foeScore?'You trail':'Dead even';
  box.innerHTML = `
  <div class="war-arena">
    <div class="war-emblem"><div class="vs">⚔️ WAR ⚔️</div></div>
    <div class="versus">
      <div class="war-totem"><div class="tm">${artSvg(me.crest)}</div><b>${esc(me.name)}</b><div class="sc">${fmt(myScore)}</div></div>
      <div class="clash">🔥</div>
      <div class="war-totem foe"><div class="tm">${artSvg(foe.crest)}</div><b>${esc(foe.name)}</b><div class="sc">${fmt(foeScore)}</div></div>
    </div>
    <div class="warbar"><i class="me" style="width:${mePct}%"></i><i class="foe" style="width:${100-mePct}%"></i><span class="mid"></span></div>
    <p class="tiny" style="text-align:center;margin:6px 0 0">${leadTxt} · goal ${fmt(goal)}</p>
  </div>

  <div class="scroll">
    <div class="cg">${war.challenge.glyph||'⚔️'}</div>
    <div class="cn">${esc(war.challenge.name||'Trial of War')}</div>
    <div class="cd">${esc(war.challenge.desc||'')}</div>
    <div class="goal">First to ${fmt(goal)} — or highest score when the fire dies — wins.</div>
  </div>

  <div class="wmeta">
    <div class="box"><b id="warCd" class="cd-live">…</b><span>Time left</span></div>
    <div class="box"><b>${fmt(war.reward_ember)}</b><span>Reward</span></div>
    <div class="box"><b>${war.stake_pct}%</b><span>Tribute</span></div>
  </div>`;
  startWarTicker(new Date(war.end_at).getTime());
}
function renderWarDone(box, war){
  stopWarTicker();
  const myId = S.tribe ? Number(S.tribe.id) : null;
  const won = war.winner_id && Number(war.winner_id)===myId;
  const draw = !war.winner_id;
  const mineA = war.mine==='attacker';
  const foe = mineA?war.defender:war.attacker;
  const big = draw?'🤝':won?'🏆':'💀';
  box.innerHTML = `
  <div class="war-arena" style="text-align:center">
    <div class="war-emblem"><div class="vs">${draw?'STALEMATE':won?'VICTORY':'DEFEAT'}</div></div>
    <span style="font-size:3.2rem;display:block;margin:6px 0 4px">${big}</span>
    <p class="tiny" style="max-width:280px;margin:6px auto 0">${draw?'Neither fire could break the other.':won
      ?('Your tribe crushed '+esc(foe.name)+', seizing '+fmt(war.reward_ember)+' Ember and '+fmt(war.tribute)+' tribute.')
      :('Your tribe fell to '+esc(foe.name)+', paying '+fmt(war.tribute)+' Ember in tribute.')}</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="declareWar" ${['Chief','Head','Elder'].includes(S.user.role)?'':'disabled'}>⚔️ Rally for a New War</button>`;
  if(won) setTimeout(()=>showCeremony('🏆','VICTORY','Your tribe stands.',2400), 300);
}
async function actDeclare(btn){
  await doAct(btn, async () => {
    const r = await api('/war/declare');
    haptic('heavy');
    toast('War declared against '+r.war.defender.name+'!','good');
    await refresh();
    renderScreen('war');
  });
}

/* ---------- RANKS ---------- */
function renderRanks(box){
  const lb = S.leaderboard||[];
  const top = lb.length ? (Number(lb[0].loyalty_total)||1) : 1;
  const mine = S.tribe ? Number(S.tribe.id) : null;
  box.innerHTML = `<div class="hd"><h2>${T('ranks_title','Hall of Tribes')}</h2><span class="sub">${T('ranks_sub','ranked by loyalty')}</span></div>
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
}

/* ---------- STORE ---------- */
const ART_FOR = { spark:'flame', flame:'torch', blaze:'firestone', inferno:'sun', charm:'charm', auto:'torch', firestone:'firestone', boneidol:'idol', sundisc:'sun', moonshard:'moon', name_color_ember:'flame', name_color_jade:'flame', name_color_void:'moon', glow_ember:'flame', glow_frost:'moon' };
function storeSectionFor(key, it){
  if(key==='starter_bundle') return 'featured';
  if(key.startsWith('name_color_')||key.startsWith('glow_')) return 'cosmetics';
  if(key==='pyreboost') return 'boosts';
  if(['firestone','boneidol','sundisc','moonshard'].includes(key)) return 'relics';
  return 'ember';
}
function renderStore(box){
  const p = S.payments;
  const star = p.starItems||{};
  const ton = p.tonItems||{};
  const featuredKey = 'starter_bundle';
  const featured = star[featuredKey];
  const sections = { ember:[], relics:[], boosts:[], cosmetics:[] };
  for(const [k,it] of Object.entries(star)){
    if(k===featuredKey) continue;
    const s = storeSectionFor(k, it);
    if(sections[s]) sections[s].push([k,it]);
  }

  box.innerHTML = `<div class="hd"><h2>${T('store_title','Trading Post')}</h2><span class="sub">⭐ Stars · ◈ TON</span></div>
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
      ${Object.keys(sections).map((s,i)=>`<button class="shop-tab ${i===0?'active':''}" data-act="shopTab" data-val="${s}">${({ember:'Ember Packs',relics:'Relics',boosts:'Tribe Boosts',cosmetics:'Cosmetics'})[s]}</button>`).join('')}
    </div>
    ${Object.entries(sections).map(([s,arr])=>`
      <div class="shop-section" data-section="${s}" style="${s==='ember'?'':'display:none'}">
        <div class="shop-rail">
          ${arr.map(([k,it])=>{
            const hasTon = p.tonEnabled && ton[k];
            const rar = (it.grant&&it.grant.relic)?'<span class="rar pill pill-gold">Relic</span>':(it.grant&&it.grant.cosmetic)?'<span class="rar pill pill-jade">Look</span>':'';
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

/* ---------- push poller (light) ---------- */
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
  share:     actShare,
  openCreate,
  pickName, pickPalette, pickBanner, pickCrest,
  doCreate, join: actJoin, leave: actLeave,
  openDonate, setDon, doDonate,
  openKiva, closeKiva, sendKiva, pinKiva,
  upgrade:   actUpgrade,
  buyStars:  (b,v)=>buyStars(v),
  buyTon:    (b,v)=>buyTon(v),
  declareWar:actDeclare,
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
  const rb = $('#retryBtn'); if(rb) rb.addEventListener('click', ()=>{ setBoot('Waking the ancestors…'); boot(); });
  const gr = $('#gateRetry'); if(gr) gr.addEventListener('click', ()=>{ $('#gate').style.display='none'; setBoot('Waking…'); boot(); });
  setInterval(()=>{
    if(TAB==='war' && document.visibilityState==='visible' && S && S.user && S.user.tribe_id) renderScreen('war');
  }, 20000);
  boot();
}
init();
