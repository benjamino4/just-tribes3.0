/* =====================================================================
   TRIBES — Mini App client. Talks to the real backend (/api/*), signs
   requests with Telegram initData, integrates TON Connect + Telegram Stars.
===================================================================== */
'use strict';
const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try{ if(TG){ TG.ready(); TG.expand(); TG.setHeaderColor&&TG.setHeaderColor('#0a0705'); TG.enableClosingConfirmation&&TG.enableClosingConfirmation(); } }catch(e){}

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const el=(t,c,h)=>{const n=document.createElement(t);if(c)n.className=c;if(h!=null)n.innerHTML=h;return n;};
const fmt=n=>{n=Number(n)||0;return n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'k':Math.floor(n).toLocaleString();};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const haptic=(t='light')=>{try{TG&&TG.HapticFeedback&&TG.HapticFeedback.impactOccurred(t);}catch(e){}};

function toast(msg,kind='',ico){
  ico=ico||(kind==='good'?'\u2713':kind==='bad'?'\u2715':kind==='warn'?'!':'\u2726');
  const t=el('div','toast '+kind,`<span class="t-ico">${ico}</span><span>${esc(msg)}</span>`);
  $('#toastRoot').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),340);},2600);
}
function fxPop(text,x,y){const p=el('div','fx-pop',esc(text));p.style.left=x+'px';p.style.top=y+'px';$('#fxRoot').appendChild(p);setTimeout(()=>p.remove(),1000);}

/* ---------- guest id (browser preview when server ALLOW_GUEST=1) ---------- */
let GUEST=localStorage.getItem('tribes.guest');
if(!GUEST){ GUEST='g'+String(Math.floor(Math.random()*9e9)+1e9); localStorage.setItem('tribes.guest',GUEST); }

/* ---------- API client ---------- */
async function api(path,body){
  const headers={'Content-Type':'application/json'};
  if(TG&&TG.initData) headers['X-Init-Data']=TG.initData;
  headers['X-Guest-Id']=GUEST;
  const r=await fetch('/api'+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined});
  let j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok){ const err=new Error(j.error||('HTTP '+r.status)); err.status=r.status; err.data=j; throw err; }
  return j;
}

/* ---------- SVG art ---------- */
const ART={
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
function artSvg(k){return ART[k]||ART.totem;}

/* ---------- ember particles ---------- */
(function embers(){const box=$('#emberfield');if(!box)return;let h='';
  for(let i=0;i<30;i++){const l=Math.random()*100,dur=(6+Math.random()*7).toFixed(1),del=(Math.random()*9).toFixed(1),
    dx=((Math.random()*120-60)|0),sz=(3+Math.random()*4).toFixed(1);
    h+=`<i style="left:${l}%;width:${sz}px;height:${sz}px;--dx:${dx}px;animation-duration:${dur}s;animation-delay:${del}s"></i>`;}
  box.innerHTML=h;})();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let S=null, TAB='fire';

/* ---------- TON Connect ---------- */
let tonUI=null, tonAddr=null;
function initTon(){
  try{
    const NS=window.TON_CONNECT_UI; if(!NS){ console.warn('TON Connect UI not loaded'); return; }
    tonUI=new NS.TonConnectUI({ manifestUrl: location.origin+'/tonconnect-manifest.json' });
    tonUI.onStatusChange(async w=>{
      tonAddr = (w && w.account) ? w.account.address : null;
      updateTonChip();
      if(tonAddr){ try{ await api('/ton/link',{address:tonAddr}); }catch(e){} }
    });
    const acc=tonUI.account; if(acc){ tonAddr=acc.address; updateTonChip(); }
  }catch(e){ console.warn('TON init',e); }
}
function updateTonChip(){ const b=$('#tonBtn'); if(!b)return;
  if(tonAddr){ b.classList.add('on'); b.textContent='◈ '+tonAddr.slice(0,4)+'…'+tonAddr.slice(-3); }
  else { b.classList.remove('on'); b.textContent='Connect'; } }
async function tonToggle(){ if(!tonUI){ toast('TON wallet not available here','warn'); return; }
  try{ if(tonAddr) await tonUI.disconnect(); else await tonUI.openModal(); }catch(e){} }

/* ---------- payments ---------- */
async function buyStars(itemId){
  if(!TG){ toast('Open in Telegram to pay with Stars','warn'); return; }
  let link; try{ link=(await api('/stars/invoice',{itemId})).link; }catch(e){ return toast(e.message,'bad'); }
  haptic('medium');
  TG.openInvoice(link, async status=>{
    if(status==='paid'){ toast('Stars payment complete!','good'); setTimeout(refresh,1400); }
    else if(status==='failed') toast('Payment failed','bad');
    else if(status==='cancelled') toast('Payment cancelled','warn');
  });
}
async function buyTon(itemId){
  if(!tonUI||!tonAddr){ toast('Connect your TON wallet first','warn'); return tonToggle(); }
  let intent; try{ intent=(await api('/ton/intent',{itemId})).intent; }catch(e){ return toast(e.message,'bad'); }
  try{
    await tonUI.sendTransaction({ validUntil:Math.floor(Date.now()/1000)+600,
      messages:[{ address:intent.to, amount:String(intent.amountNano) }] });
  }catch(e){ return toast('Transaction cancelled','warn'); }
  toast('Confirming on-chain…');
  let ok=false;
  for(let i=0;i<14 && !ok;i++){ await sleep(5000);
    try{ const r=await api('/ton/verify',{nonce:intent.nonce}); if(r.verified) ok=true; }catch(e){} }
  if(ok){ toast('TON payment confirmed!','good'); await refresh(); }
  else toast('Still settling — rewards arrive once the tx confirms','warn');
}

/* ---------- boot ---------- */
function setBoot(msg,retry){ $('#bootMsg').textContent=msg; $('#retryBtn').style.display=retry?'inline-flex':'none'; }
function showApp(){ $('#boot').classList.add('gone'); setTimeout(()=>{$('#boot').style.display='none';},600); $('#app').style.display='block'; }
async function boot(){
  setBoot('Waking the ancestors…');
  try{ await api('/health'); }catch(e){}
  try{ S=await api('/state'); }
  catch(e){
    if(e.status===401){ setBoot('Open TRIBES inside Telegram to gather at the fire.',true); return; }
    setBoot('The fire could not be reached — '+(e.message||'try again.'),true); return;
  }
  initTon(); renderAll(); showApp();
}
async function refresh(){ try{ S=await api('/state'); renderAll(); }catch(e){ console.warn(e); } }

/* ---------- tribe theme ---------- */
function applyTheme(){ const hue=(S.tribe&&S.tribe.hue)||0; document.documentElement.style.setProperty('--thue',hue+'deg'); }

/* ---------- topbar ---------- */
function renderTop(){
  const u=S.user, t=S.tribe;
  $('#crestArt').innerHTML=artSvg(t?t.crest:'totem');
  $('#tribeName').textContent=t?t.name:'No Tribe';
  $('#roleName').textContent=u.role||'Wanderer';
  $('#emberVal').textContent=fmt(u.ember);
  $('#starVal').textContent=fmt(u.stars);
  applyTheme(); updateTonChip();
}

/* ---------- nav ---------- */
function setTab(tab){ TAB=tab;
  $$('.nav-i').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  $$('.screen').forEach(s=>s.classList.toggle('on',s.id==='sc-'+tab));
  renderScreen(tab); window.scrollTo({top:0,behavior:'smooth'});
}
function renderAll(){ renderTop();
  const host=$('#screens');
  if(!host.dataset.built){ ['fire','tribe','war','ranks','store'].forEach(t=>{ const s=el('section','screen',''); s.id='sc-'+t; host.appendChild(s); }); host.dataset.built='1'; }
  $$('.screen').forEach(s=>s.classList.toggle('on',s.id==='sc-'+TAB));
  renderScreen(TAB);
}
function renderScreen(tab){
  const box=$('#sc-'+tab); if(!box)return;
  if(tab==='fire') return renderFire(box);
  if(tab==='tribe') return renderTribe(box);
  if(tab==='war') return renderWar(box);
  if(tab==='ranks') return renderRanks(box);
  if(tab==='store') return renderStore(box);
}
/* ---------- shared helpers ---------- */
async function doAct(btn, fn){ if(btn&&btn.disabled) return; if(btn){btn.disabled=true;btn.classList.add('busy');}
  try{ await fn(); }catch(e){ toast(e.message||'Something went wrong','bad'); }
  finally{ if(btn){btn.disabled=false;btn.classList.remove('busy');} } }
function fmtDur(ms){ ms=Math.max(0,ms); const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);
  return d>0?`${d}d ${h}h`:h>0?`${h}h ${m}m`:`${m}m`; }
function popAt(btn,text){ const r=btn.getBoundingClientRect(); fxPop(text, r.left+r.width/2, r.top); }

/* ---------- FIRE screen ---------- */
const QUESTS=[
  {id:'stoke', name:'Stoke the Fire', glyph:'\uD83D\uDD25', hint:'Feed fresh logs to the blaze', r:300},
  {id:'feed',  name:'Feed the Kin',   glyph:'\uD83C\uDF56', hint:'Share the day\u2019s hunt',      r:250},
  {id:'cry',   name:'Dawn Cry',       glyph:'\uD83C\uDF04', hint:'Rally the tribe at first light',r:120},
  {id:'ash',   name:'Sift the Ash',   glyph:'\u2604\uFE0F', hint:'Comb the cinders for Ember',    r:180},
  {id:'invite',name:'Summon Kin',     glyph:'\uD83D\uDCE3', hint:'Call a new soul to the fire',   r:500},
];
function fireReadyIn(){ const u=S.user; const last=u.last_checkin?new Date(u.last_checkin).getTime():0; return (last+20*3600*1000)-Date.now(); }
function renderFire(box){
  const u=S.user, ready=fireReadyIn()<=0, pct=clamp(100*(1-fireReadyIn()/(20*3600*1000)),0,100);
  box.innerHTML=`
  <div class="hero-fire">
    <div class="campfire">
      <div class="cf-ring"></div>
      <div class="cf-spark" style="--sx:-16px;animation-duration:1.6s"></div>
      <div class="cf-spark" style="left:56%;--sx:20px;animation-duration:2.1s;animation-delay:.5s"></div>
      <div class="cf-spark" style="left:44%;--sx:6px;animation-duration:1.9s;animation-delay:1s"></div>
      <div class="cf-logs"></div>
      <div class="cf-flame"></div><div class="cf-flame f2"></div><div class="cf-flame f3"></div>
    </div>
    <button class="btn btn-primary btn-shine btn-block" data-act="checkin" style="max-width:280px;margin-top:6px">
      ${ready?'\uD83D\uDD25 Feed the Fire \u2014 Daily Blessing':'\u23F3 Blessing in '+fmtDur(fireReadyIn())}</button>
  </div>

  <div class="tablet"><i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
    <div class="checkin">
      <div class="dial" style="--p:${ready?100:pct.toFixed(0)}"><b>${u.streak||0}<i>STREAK</i></b></div>
      <div style="flex:1">
        <h3 style="margin:0 0 3px">Keeper of the Flame</h3>
        <p class="tiny">Feed the fire every day to grow your streak. Longer streaks pour out ever more Ember from the ancestors.</p>
      </div>
    </div>
  </div>

  <div class="tablet"><i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
    <div class="hd" style="margin:0 0 8px"><h2 style="font-size:1.15rem">The Ash Pit</h2><span class="pill pill-gold">Idle \u2022 Ash \u2192 Ember</span></div>
    <p class="tiny" style="margin:0 0 10px">Cinders gather while you\u2019re away \u2014 up to ${S.config.ashCap} charges, each worth ${S.ashUnit} Ember.</p>
    <div class="grid2" style="grid-template-columns:auto 1fr;align-items:center">
      <div class="dial" style="--p:${(S.ashPending/S.config.ashCap*100).toFixed(0)}"><b>${S.ashPending}<i>ASH</i></b></div>
      <button class="btn ${S.ashPending>0?'btn-primary btn-shine':'btn-stone'} btn-block" data-act="ash">
        ${S.ashPending>0?'Gather '+S.ashPending+' Ash (+'+fmt(S.ashPending*S.ashUnit)+')':'Smouldering\u2026'}</button>
    </div>
  </div>

  <div class="hd"><h2>Daily Rites</h2><span class="sub">earn Ember & Loyalty</span></div>
  <div class="grid2">
    ${QUESTS.map(qq=>`<button class="quest" data-act="quest" data-val="${qq.id}">
      <span class="qi">${qq.glyph}</span>
      <span class="qt"><b>${qq.name}</b><span>${qq.hint}</span></span>
      <span class="qr">+${fmt(qq.r)}</span></button>`).join('')}
    <button class="quest" data-act="share" style="grid-column:span 2">
      <span class="qi">\uD83D\uDDE3\uFE0F</span>
      <span class="qt"><b>Spread the War Chant</b><span>Invite kin \u2014 gain Loyalty for your tribe</span></span>
      <span class="qr">+12 \u2764</span></button>
  </div>`;
}

/* ---------- fire actions ---------- */
async function actCheckin(btn){ await doAct(btn, async()=>{
  const r=await api('/checkin');
  if(!r.ok){ toast('Blessing returns in '+fmtDur(r.nextIn),'warn'); return; }
  popAt(btn,'+'+fmt(r.reward)); haptic('medium');
  toast('Daily blessing! +'+fmt(r.reward)+' Ember \u00b7 streak '+r.streak,'good'); await refresh(); }); }
async function actAsh(btn){ await doAct(btn, async()=>{
  const r=await api('/ash/collect');
  if(!r.ok){ toast('The ash pit is still smouldering','warn'); return; }
  popAt(btn,'+'+fmt(r.gain)); haptic();
  toast('Gathered '+r.units+' Ash \u2192 +'+fmt(r.gain)+' Ember','good'); await refresh(); }); }
async function actQuest(btn,id){ await doAct(btn, async()=>{
  const r=await api('/quest/'+id); popAt(btn,'+'+fmt(r.reward)); haptic();
  toast('Rite complete: +'+fmt(r.reward)+' Ember','good'); await refresh(); }); }
async function actShare(btn){ await doAct(btn, async()=>{
  await api('/share'); popAt(btn,'+12 \u2764'); haptic();
  try{ const link='https://t.me/share/url?url='+encodeURIComponent('https://t.me')+'&text='+encodeURIComponent('Join my tribe in TRIBES \uD83D\uDD25\u2694\uFE0F');
    if(TG&&TG.openTelegramLink) TG.openTelegramLink(link); }catch(e){}
  toast('War Chant spread! +12 Loyalty','good'); await refresh(); }); }
/* ---------- TRIBE screen ---------- */
const CRESTS=['totem','skull','drum','flame','torch','idol','sun','moon','horn'];
let pickedCrest='totem';
function renderTribe(box){
  const u=S.user, t=S.tribe;
  if(t){
    const wl=(Number(t.wins)||0)+(Number(t.losses)||0);
    box.innerHTML=`
    <div class="tablet" style="text-align:center"><i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
      <div class="crest-art" style="width:78px;height:78px;margin:2px auto 8px;border-radius:18px">${artSvg(t.crest)}</div>
      <h2 style="font-family:var(--fx);font-size:1.5rem;margin:0;color:var(--gold)">${esc(t.name)}</h2>
      <p class="muted" style="font-size:.78rem;margin:4px 0 10px">${esc(t.motto)||'\u201cWe rise from the ash.\u201d'}</p>
      <div style="display:flex;justify-content:center;gap:6px;flex-wrap:wrap">
        <span class="pill pill-gold">${esc(u.role)}</span>
        <span class="pill pill-jade">\uD83C\uDFC6 ${t.wins||0}W</span>
        <span class="pill pill-blood">\uD83D\uDC80 ${t.losses||0}L</span>
      </div>
    </div>

    <div class="wmeta" style="margin-bottom:14px">
      <div class="box"><b>${fmt(t.treasury)}</b><span>Great Pyre</span></div>
      <div class="box"><b>${fmt(t.loyalty_total)}</b><span>Loyalty</span></div>
      <div class="box"><b>${fmt(t.members)}</b><span>Kin</span></div>
    </div>

    <div class="tablet"><i class="rivet tl"></i><i class="rivet tr"></i><i class="rivet bl"></i><i class="rivet br"></i>
      <h3>Stoke the Great Pyre</h3>
      <p class="tiny" style="margin:0 0 12px">Donate your Ember to the tribe treasury. A deep Pyre wins wars \u2014 and every gift earns you Loyalty.</p>
      <button class="btn btn-primary btn-shine btn-block" data-act="openDonate">\uD83D\uDD25 Donate Ember to the Pyre</button>
    </div>

    <button class="btn btn-danger btn-block" data-act="leave" style="margin-top:4px">Leave the Tribe</button>
    <p class="tiny" style="text-align:center;margin-top:10px">${wl?('Battle record \u00b7 '+t.wins+' won, '+t.losses+' lost'):'Your tribe has yet to taste war.'}</p>`;
    return;
  }
  // no tribe
  box.innerHTML=`
  <div class="empty"><span class="big">\uD83E\uDEA8</span>
    <h2 style="font-family:var(--fx);color:var(--gold);margin:0">You wander alone</h2>
    <p class="tiny" style="margin-top:6px">Found your own tribe or join an existing fire. Tribes wage war, hoard the Great Pyre, and climb the ranks together.</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="openCreate">\uD83D\uDD25 Found a Tribe \u00b7 ${fmt(S.config.foundEmber)} Ember</button>
  <div class="hd" style="margin-top:18px"><h2>Join a Fire</h2><span class="sub">strongest tribes</span></div>
  <div id="joinList"><p class="tiny">Scanning the horizon\u2026</p></div>`;
  api('/tribes').then(d=>{
    const host=$('#joinList'); if(!host)return;
    const list=(d.tribes||[]).slice(0,30);
    if(!list.length){ host.innerHTML='<p class="tiny">No tribes yet \u2014 be the first to found one!</p>'; return; }
    host.innerHTML=list.map(x=>`<div class="tablet" style="padding:12px;margin-bottom:10px">
      <div class="row" style="border:0;padding:0">
        <span class="crest-art">${artSvg(x.crest)}</span>
        <div style="flex:1;min-width:0"><b style="font-family:var(--fd);color:var(--gold)">${esc(x.name)}</b>
          <div class="tiny">${fmt(x.members)} kin \u00b7 ${fmt(x.loyalty_total)} loyalty \u00b7 \uD83C\uDFC6${x.wins||0}</div></div>
        <button class="btn btn-stone" data-act="join" data-val="${x.id}">Join</button>
      </div></div>`).join('');
  }).catch(()=>{ const h=$('#joinList'); if(h)h.innerHTML='<p class="tiny">Could not reach the other fires.</p>'; });
}

/* ---------- modals ---------- */
function modal(html){ $('#modalRoot').innerHTML=`<div class="modal-bg" data-act="bgClose"><div class="modal">${html}</div></div>`; }
function closeModal(){ $('#modalRoot').innerHTML=''; }
function openCreate(){
  pickedCrest='totem';
  modal(`<h3>Found a Tribe</h3><div class="sub">Costs ${fmt(S.config.foundEmber)} Ember \u00b7 you become Chief</div>
    <div class="field"><input id="tName" maxlength="32" placeholder="Tribe name (3\u201332 chars)"/></div>
    <div class="field"><input id="tMotto" maxlength="80" placeholder="Battle motto (optional)"/></div>
    <div class="tiny" style="margin-bottom:6px">Choose a crest</div>
    <div class="grid2" id="crestGrid" style="grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px">
      ${CRESTS.map(c=>`<button class="crest-art ${c===pickedCrest?'sel':''}" data-act="pickCrest" data-val="${c}" style="width:100%;height:46px;border:1px solid ${c===pickedCrest?'var(--gold)':'var(--line)'}">${artSvg(c)}</button>`).join('')}
    </div>
    <div class="tiny" style="margin-bottom:4px">Tribe hue</div>
    <div class="field"><input id="tHue" type="range" min="0" max="340" value="0"/></div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doCreate">Light the First Fire</button>
    <button class="btn btn-ghost btn-block" data-act="closeModal" style="margin-top:8px">Cancel</button>`);
}
function pickCrest(btn,val){ pickedCrest=val;
  $$('#crestGrid .crest-art').forEach(b=>b.style.borderColor=(b.dataset.val===val?'var(--gold)':'var(--line)')); }
async function doCreate(btn){ await doAct(btn, async()=>{
  const name=$('#tName').value.trim(), motto=$('#tMotto').value.trim(), hue=Number($('#tHue').value)||0;
  if(name.length<3){ toast('Name needs at least 3 letters','warn'); return; }
  await api('/tribe/create',{name,motto,hue,crest:pickedCrest});
  closeModal(); haptic('medium'); toast('Your tribe is born! \uD83D\uDD25','good'); await refresh(); }); }
async function actJoin(btn,id){ await doAct(btn, async()=>{
  await api('/tribe/join',{tribeId:Number(id)}); haptic(); toast('You joined the fire!','good'); await refresh(); }); }
async function actLeave(btn){ await doAct(btn, async()=>{
  await api('/tribe/leave'); toast('You left the tribe','warn'); await refresh(); }); }
function openDonate(){
  modal(`<h3>Stoke the Great Pyre</h3><div class="sub">You hold ${fmt(S.user.ember)} Ember</div>
    <div class="field"><input id="dAmt" type="number" min="1" placeholder="Ember to donate"/></div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${[500,2500,10000].map(v=>`<button class="btn btn-stone" style="flex:1" data-act="setDon" data-val="${v}">${fmt(v)}</button>`).join('')}</div>
    <button class="btn btn-primary btn-shine btn-block" data-act="doDonate">Donate to the Pyre</button>
    <button class="btn btn-ghost btn-block" data-act="closeModal" style="margin-top:8px">Cancel</button>`);
}
function setDon(btn,v){ $('#dAmt').value=v; }
async function doDonate(btn){ await doAct(btn, async()=>{
  const amt=Math.floor(Number($('#dAmt').value)||0);
  if(amt<1){ toast('Enter an amount','warn'); return; }
  const r=await api('/tribe/donate',{amount:amt}); closeModal(); haptic('medium');
  toast('Donated '+fmt(r.donated)+' Ember to the Pyre','good'); await refresh(); }); }
/* ---------- WAR screen ---------- */
let warTimer=null;
function stopWarTicker(){ if(warTimer){ clearInterval(warTimer); warTimer=null; } }
function startWarTicker(endAt){ stopWarTicker();
  const tick=()=>{ const e=$('#warCd'); if(!e){ stopWarTicker(); return; } const ms=endAt-Date.now(); e.textContent= ms<=0?'resolving\u2026':fmtDur(ms); };
  tick(); warTimer=setInterval(tick,1000); }

async function renderWar(box){
  const u=S.user;
  if(!u.tribe_id){ stopWarTicker();
    box.innerHTML=`<div class="empty"><span class="big">\u2694\uFE0F</span>
      <h2 style="font-family:var(--fx);color:var(--gold);margin:0">No banner to raise</h2>
      <p class="tiny" style="margin-top:6px">You must belong to a tribe before you can wage war. Head to the Tribe fire to found or join one.</p></div>
      <button class="btn btn-primary btn-shine btn-block" data-act="gotoTribe">Go to Tribe</button>`;
    return; }
  box.innerHTML='<p class="tiny">Surveying the battlefield\u2026</p>';
  let war=null; try{ war=(await api('/war')).war; }catch(e){ box.innerHTML='<p class="tiny">Could not reach the war drums.</p>'; return; }
  if(TAB!=='war') return;
  if(!war){ renderWarNone(box); return; }
  if(war.status==='resolved'){ renderWarDone(box,war); return; }
  renderWarActive(box,war);
}

function renderWarNone(box){
  stopWarTicker();
  const can=['Chief','Head','Elder'].includes(S.user.role);
  box.innerHTML=`
  <div class="war-arena">
    <div class="war-emblem"><div class="vs">WAR DRUMS</div>
      <p class="tiny" style="margin:2px 0 0">Declare war to be matched against a random rival tribe on a random trial. Winner seizes Ember and drags tribute from the loser\u2019s Pyre.</p></div>
    <button class="btn ${can?'btn-danger btn-shine':'btn-stone'} btn-block" ${can?'data-act="declareWar"':'disabled'}>
      ${can?'\u2694\uFE0F Declare War':'Only Elders, Heads & the Chief may declare war'}</button>
  </div>
  <div class="hd"><h2>Trials of War</h2><span class="sub">${S.challenges.length} possible</span></div>
  ${S.challenges.map(c=>`<div class="tablet" style="padding:12px;margin-bottom:10px">
    <div class="row" style="border:0;padding:0"><span style="font-size:1.6rem">${c.glyph}</span>
      <div style="flex:1"><b style="font-family:var(--fd);color:var(--gold)">${esc(c.name)}</b>
        <div class="tiny">${esc(c.desc)}</div></div>
      <span class="pill pill-blood">${c.days}d \u00b7 ${c.stake}%</span></div></div>`).join('')}`;
}

function renderWarActive(box,war){
  const mineA = war.mine==='attacker';
  const me = mineA?war.attacker:war.defender, foe = mineA?war.defender:war.attacker;
  const myScore = Number(mineA?war.attacker_score:war.defender_score);
  const foeScore = Number(mineA?war.defender_score:war.attacker_score);
  const goal = Number(war.goal);
  const tot = myScore+foeScore || 1;
  const mePct = clamp(myScore/tot*100,0,100);
  const leadTxt = myScore>foeScore?'You lead':myScore<foeScore?'You trail':'Dead even';
  box.innerHTML=`
  <div class="war-arena">
    <div class="war-emblem"><div class="vs">\u2694\uFE0F WAR \u2694\uFE0F</div></div>
    <div class="versus">
      <div class="war-totem"><div class="tm">${artSvg(me.crest)}</div><b>${esc(me.name)}</b><div class="sc">${fmt(myScore)}</div></div>
      <div class="clash">\uD83D\uDD25</div>
      <div class="war-totem foe"><div class="tm">${artSvg(foe.crest)}</div><b>${esc(foe.name)}</b><div class="sc">${fmt(foeScore)}</div></div>
    </div>
    <div class="warbar"><i class="me" style="width:${mePct}%"></i><i class="foe" style="width:${100-mePct}%"></i><span class="mid"></span></div>
    <p class="tiny" style="text-align:center;margin:2px 0 0">${leadTxt} \u00b7 goal ${fmt(goal)}</p>
  </div>

  <div class="scroll">
    <div class="cg">${war.challenge.glyph||'\u2694\uFE0F'}</div>
    <div class="cn">${esc(war.challenge.name||'Trial of War')}</div>
    <div class="cd">${esc(war.challenge.desc||'')}</div>
    <div class="goal">First to ${fmt(goal)} \u2014 or the highest score when the fire dies \u2014 wins.</div>
  </div>

  <div class="wmeta">
    <div class="box"><b id="warCd" class="cd-live">\u2026</b><span>Time left</span></div>
    <div class="box"><b>${fmt(war.reward_ember)}</b><span>Reward</span></div>
    <div class="box"><b>${war.stake_pct}%</b><span>Tribute</span></div>
  </div>
  <p class="tiny" style="text-align:center;margin-top:12px">Grow the tribe\u2019s ${esc(war.challenge.name||'trial')} to push the bar. Rites, donations, check-ins and recruits all feed your war effort.</p>`;
  startWarTicker(new Date(war.end_at).getTime());
}

function renderWarDone(box,war){
  stopWarTicker();
  const myId = S.tribe?Number(S.tribe.id):null;
  const won = war.winner_id && Number(war.winner_id)===myId;
  const draw = !war.winner_id;
  const mineA = war.mine==='attacker';
  const me = mineA?war.attacker:war.defender, foe = mineA?war.defender:war.attacker;
  box.innerHTML=`
  <div class="war-arena" style="text-align:center">
    <div class="war-emblem"><div class="vs">${draw?'STALEMATE':won?'VICTORY':'DEFEAT'}</div></div>
    <span class="big" style="font-size:3rem;display:block;margin:4px 0">${draw?'\uD83E\uDD1D':won?'\uD83C\uDFC6':'\uD83D\uDC80'}</span>
    <p class="tiny">${draw?'Neither fire could break the other.':won
      ?('Your tribe crushed '+esc(foe.name)+', seizing '+fmt(war.reward_ember)+' Ember and '+fmt(war.tribute)+' tribute for the Pyre.')
      :('Your tribe fell to '+esc(foe.name)+', paying '+fmt(war.tribute)+' Ember in tribute.')}</p>
  </div>
  <button class="btn btn-primary btn-shine btn-block" data-act="declareWar" ${['Chief','Head','Elder'].includes(S.user.role)?'':'disabled'}>\u2694\uFE0F Rally for a New War</button>`;
}

async function actDeclare(btn){ await doAct(btn, async()=>{
  const r=await api('/war/declare'); haptic('heavy');
  toast('War declared against '+r.war.defender.name+'!','good');
  await refresh(); renderScreen('war'); }); }
/* ---------- RANKS ---------- */
function renderRanks(box){
  const lb=S.leaderboard||[]; const top=lb.length?(Number(lb[0].loyalty_total)||1):1;
  const mine=S.tribe?Number(S.tribe.id):null;
  box.innerHTML=`<div class="hd"><h2>Hall of Tribes</h2><span class="sub">ranked by loyalty</span></div>
  ${lb.length?lb.map((t,i)=>{
    const pct=clamp(Number(t.loyalty_total)/top*100,4,100);
    const me=mine&&mine===Number(t.id);
    const medal=i===0?'\uD83E\uDD47':i===1?'\uD83E\uDD48':i===2?'\uD83E\uDD49':('#'+(i+1));
    return `<div class="tablet" style="padding:12px;margin-bottom:10px;${me?'border-color:var(--gold)':''}">
      <div class="row" style="border:0;padding:0 0 8px">
        <span class="avatar">${medal}</span>
        <div style="flex:1;min-width:0"><b style="font-family:var(--fd);color:var(--gold)">${esc(t.name)}${me?' \u00b7 you':''}</b>
          <div class="tiny">${fmt(t.members)} kin \u00b7 \uD83C\uDFC6${t.wins||0} \uD83D\uDC80${t.losses||0} \u00b7 Pyre ${fmt(t.treasury)}</div></div>
        <b style="font-family:var(--fd);color:var(--gold);white-space:nowrap">${fmt(t.loyalty_total)}</b></div>
      <div class="bar"><i style="width:${pct}%"></i></div></div>`;
  }).join(''):'<div class="empty"><span class="big">\uD83C\uDFC6</span><p class="tiny">No tribes have risen yet \u2014 found the first!</p></div>'}`;
}

/* ---------- STORE ---------- */
const ART_FOR={spark:'flame',flame:'torch',blaze:'firestone',inferno:'sun',charm:'charm',auto:'torch',firestone:'firestone',boneidol:'idol',sundisc:'sun',moonshard:'moon'};
function renderStore(box){
  const p=S.payments, star=p.starItems||{}, ton=p.tonItems||{};
  const rows=Object.entries(star).map(([k,it])=>{
    const hasTon=p.tonEnabled&&ton[k];
    const rar=(it.grant&&it.grant.relic)?'<span class="rar pill pill-gold">Relic</span>':(it.grant&&it.grant.item)?'<span class="rar pill pill-jade">Boon</span>':'';
    return `<div class="item">${rar}<div class="art">${artSvg(ART_FOR[k]||'flame')}</div>
      <b>${esc(it.title)}</b><p>${esc(it.desc)}</p>
      <div class="price">
        <button class="b star" data-act="buyStars" data-val="${k}">\u2B50 ${fmt(it.stars)}</button>
        ${hasTon?`<button class="b ton" data-act="buyTon" data-val="${k}">\u25C8 ${ton[k].ton}</button>`:''}
      </div></div>`;
  }).join('');
  box.innerHTML=`<div class="hd"><h2>Trading Post</h2><span class="sub">\u2B50 Stars \u00b7 \u25C8 TON</span></div>
    ${!TG?'<p class="tiny" style="margin-bottom:10px">Open TRIBES inside Telegram to pay with Stars.</p>':''}
    ${p.tonEnabled&&!tonAddr?'<p class="tiny" style="margin-bottom:10px">Tap \u201cConnect\u201d up top to pay with your TON wallet.</p>':''}
    <div class="shop">${rows}</div>
    <p class="tiny" style="text-align:center;margin-top:14px">Secured by Telegram Stars & the TON blockchain.${p.tonEnabled?'':' TON payments are currently offline.'}</p>`;
}

/* ---------- action registry ---------- */
const ACTS={
  checkin:actCheckin, ash:actAsh, quest:actQuest, share:actShare,
  openCreate:()=>openCreate(), pickCrest, doCreate, join:actJoin, leave:actLeave,
  openDonate:()=>openDonate(), setDon, doDonate,
  buyStars:(b,v)=>buyStars(v), buyTon:(b,v)=>buyTon(v),
  declareWar:actDeclare, gotoTribe:()=>setTab('tribe'),
  closeModal:()=>closeModal(),
  bgClose:(b,v,e)=>{ if(e&&e.target&&e.target.classList&&e.target.classList.contains('modal-bg')) closeModal(); },
};

/* ---------- init ---------- */
function init(){
  document.addEventListener('click', e=>{
    const b=e.target.closest('[data-act]');
    if(b){ const f=ACTS[b.dataset.act]; if(f){ f(b,b.dataset.val,e); return; } }
    const nav=e.target.closest('.nav-i'); if(nav){ haptic(); setTab(nav.dataset.tab); return; }
    if(e.target.closest('#crestBtn')){ setTab('tribe'); return; }
    if(e.target.closest('#tonBtn')){ tonToggle(); }
  });
  const rb=$('#retryBtn'); if(rb) rb.addEventListener('click',()=>{ setBoot('Waking the ancestors\u2026'); boot(); });
  setInterval(()=>{ if(TAB==='war' && document.visibilityState==='visible' && S && S.user && S.user.tribe_id) renderScreen('war'); }, 20000);
  boot();
}
init();

