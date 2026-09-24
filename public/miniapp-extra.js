// TRIBES — in-app extras: movable animated FABs, redeem sheet, Warden console.
// Phase 1: draggable + snapping FABs with SVG icons, redesigned to match
// Obsidian Glass. No inline handlers, all dynamic text escaped.
(function(){
'use strict';
var TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
function hdrs(json){var h={}; if(TG&&TG.initData)h['X-Init-Data']=TG.initData; if(json)h['Content-Type']='application/json'; return h;}
function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function fmt(n){return (Number(n)||0).toLocaleString('en-US');}
function el(id){return document.getElementById(id);}
function toast(msg,bad){var t=el('wToast'); if(!t){t=document.createElement('div');t.id='wToast';document.body.appendChild(t);}
  t.textContent=msg;t.className='w-toast show'+(bad?' bad':'');clearTimeout(t._t);t._t=setTimeout(function(){t.className='w-toast';},2600);}
function adminApi(path,opts){opts=opts||{};opts.headers=hdrs(!!opts.body);if(opts.body)opts.body=JSON.stringify(opts.body);
  return fetch('/api/admin'+path,opts).then(function(r){return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||('HTTP '+r.status));return j.data;});});}
function act(path,body,msg){return adminApi(path,{method:'POST',body:body}).then(function(d){toast(msg||'Done');return d;}).catch(function(e){toast(e.message,true);throw e;});}

// ---------- styles ----------
var css = document.createElement('style');
css.textContent = [
'.t-fab{position:fixed;z-index:900;width:58px;height:58px;border-radius:50%;cursor:grab;',
'  display:grid;place-items:center;touch-action:none;user-select:none;',
'  background:linear-gradient(160deg,rgba(34,26,18,.95),rgba(18,13,9,.95));',
'  border:1px solid rgba(255,220,180,.18);',
'  box-shadow:0 12px 28px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,220,180,.08),0 0 24px rgba(255,122,24,.35);',
'  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);',
'  transition:transform .14s cubic-bezier(.2,.9,.2,1),box-shadow .3s}',
'.t-fab:active{cursor:grabbing;transform:scale(.94)}',
'.t-fab.dragging{transform:scale(1.08);box-shadow:0 24px 48px rgba(0,0,0,.7),0 0 40px rgba(255,122,24,.6)}',
'.t-fab svg{width:30px;height:30px;display:block;pointer-events:none;transition:transform .3s}',
'.t-fab .fab-halo{position:absolute;inset:-10px;border-radius:50%;pointer-events:none;',
'  background:radial-gradient(circle,rgba(255,122,24,.5),transparent 70%);',
'  animation:tHalo 2.6s ease-in-out infinite}',
'@keyframes tHalo{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.12)}}',
'.t-fab.gift{bottom:calc(env(safe-area-inset-bottom,0px) + 106px);right:16px}',
'.t-fab.gift svg{animation:giftBob 3s ease-in-out infinite}',
'@keyframes giftBob{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-3px) rotate(-6deg)}}',
'.t-fab.gift .ribbon{animation:giftShine 3.4s ease-in-out infinite;transform-origin:center}',
'@keyframes giftShine{0%,70%{opacity:.85}85%{opacity:1}100%{opacity:.85}}',
'.t-fab.warden{bottom:calc(env(safe-area-inset-bottom,0px) + 174px);right:16px}',
'.t-fab.warden svg{animation:wardenSpin 8s linear infinite}',
'@keyframes wardenSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}',
'.t-fab .badge-dot{position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;',
'  background:linear-gradient(160deg,#ffd27a,var(--ember, #ff7a18));color:#2a1402;font-size:9px;font-weight:900;',
'  display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.6)}',
// warden overlay
'.w-overlay{position:fixed;inset:0;z-index:950;background:rgba(4,3,2,.96);backdrop-filter:blur(6px);',
'  -webkit-backdrop-filter:blur(6px);display:none;flex-direction:column;color:#f5ede0;font-family:Inter,sans-serif}',
'.w-overlay.open{display:flex}',
'.w-top{display:flex;justify-content:space-between;align-items:center;padding:16px;border-bottom:1px solid rgba(255,220,180,.12)}',
'.w-top b{letter-spacing:.4px;font-weight:800}',
'.w-x{background:none;border:none;color:#9a8d7e;font-size:28px;cursor:pointer;line-height:1}',
'.w-tabs{display:flex;gap:6px;overflow-x:auto;padding:12px;scrollbar-width:none}.w-tabs::-webkit-scrollbar{display:none}',
'.w-tab{background:rgba(255,255,255,.04);border:1px solid rgba(255,220,180,.12);color:#9a8d7e;padding:8px 14px;border-radius:999px;font-size:13px;white-space:nowrap;cursor:pointer;font-weight:700}',
'.w-tab.active{background:linear-gradient(160deg,#ffd27a,#ff7a18);border-color:transparent;color:#1a0d04}',
'.w-body{flex:1;overflow-y:auto;padding:12px 14px 40px}',
'.w-panel{display:none}.w-panel.active{display:block}',
'.w-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}',
'.w-stat{background:linear-gradient(160deg,rgba(34,26,18,.72),rgba(15,11,8,.72));border:1px solid rgba(255,220,180,.12);border-radius:16px;padding:14px}',
'.w-stat .k{font-size:11px;color:#9a8d7e;text-transform:uppercase;letter-spacing:.06em}.w-stat .v{font-size:22px;font-weight:800;color:#ff9d3c}.w-stat .s{font-size:11px;color:#9a8d7e}',
'.w-row{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}',
'.w-row input,.w-row select,.w-row textarea{flex:1;min-width:100px;padding:11px 13px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,220,180,.14);color:#f5ede0;font-size:14px;font-family:inherit}',
'.w-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,220,180,.14);color:#f5ede0;padding:11px 15px;border-radius:12px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}',
'.w-btn.p{background:linear-gradient(180deg,#ff9d3c,#ff7a18);border:none;color:#1a0d04}',
'.w-btn.d{border-color:rgba(200,29,37,.5);color:#ff8a8a}.w-btn.t{padding:7px 11px;font-size:12px;border-radius:9px}',
'.w-item{background:linear-gradient(160deg,rgba(34,26,18,.72),rgba(15,11,8,.72));border:1px solid rgba(255,220,180,.12);border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center}',
'.w-item .m{font-size:12px;color:#9a8d7e}.w-item .n{font-weight:800}',
'.w-card{background:linear-gradient(160deg,rgba(34,26,18,.72),rgba(15,11,8,.72));border:1px solid rgba(255,220,180,.12);border-radius:16px;padding:16px;margin-bottom:12px}',
'.w-kv{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font-size:13px;margin:10px 0}.w-kv .l{color:#9a8d7e}',
'.w-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.w-acts input,.w-acts select{padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,220,180,.14);color:#f5ede0;font-size:13px;max-width:96px;font-family:inherit}',
'.w-badge{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,220,180,.14);color:#9a8d7e}',
'.w-badge.ban{border-color:rgba(200,29,37,.5);color:#ff8a8a}',
'.w-mut{color:#9a8d7e;font-size:13px}',
'.w-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%) translateY(30px);background:linear-gradient(160deg,rgba(34,26,18,.95),rgba(18,13,9,.95));border:1px solid rgba(255,122,24,.5);color:#f5ede0;padding:12px 20px;border-radius:14px;opacity:0;transition:.3s;z-index:999;max-width:90%;font-weight:700;backdrop-filter:blur(16px)}',
'.w-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.w-toast.bad{border-color:rgba(200,29,37,.6)}',
// redeem sheet
'.r-sheet-bg{position:fixed;inset:0;z-index:960;background:rgba(4,3,2,.66);backdrop-filter:blur(8px);display:none;place-items:end center}',
'.r-sheet-bg.open{display:grid;animation:rFade .26s}@keyframes rFade{from{opacity:0}to{opacity:1}}',
'.r-sheet{width:100%;max-width:520px;background:linear-gradient(180deg,rgba(30,22,14,.98),rgba(14,10,7,.98));border-radius:26px 26px 0 0;border-top:1px solid rgba(255,220,180,.18);padding:10px 18px calc(env(safe-area-inset-bottom,0px) + 24px);color:#f5ede0;font-family:Inter,sans-serif;animation:rIn .42s cubic-bezier(.2,.9,.2,1)}',
'@keyframes rIn{from{transform:translateY(100%)}to{transform:none}}',
'.r-sheet .r-handle{width:44px;height:4px;border-radius:4px;background:rgba(255,220,180,.22);margin:6px auto 16px}',
'.r-sheet h3{margin:0 0 4px;font-weight:800;color:#ffcf7a;font-size:1.2rem}',
'.r-sheet .r-sub{font-size:.78rem;color:#9a8d7e;margin-bottom:16px}',
'.r-sheet input{width:100%;padding:14px 15px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,220,180,.18);color:#fff;font-size:.95rem;outline:none;font-family:inherit;margin-bottom:12px;letter-spacing:.08em;text-transform:uppercase}',
'.r-sheet .r-btn{display:flex;width:100%;align-items:center;justify-content:center;padding:14px;border-radius:16px;font-weight:800;border:none;cursor:pointer;font-family:inherit;font-size:.92rem}',
'.r-sheet .r-btn.p{background:linear-gradient(160deg,#ffd27a,#ff8a2a 60%,#ef5f1a);color:#2a1402;box-shadow:0 12px 28px rgba(255,110,26,.36)}',
'.r-sheet .r-btn.g{background:rgba(255,255,255,.05);color:#f5ede0;margin-top:8px;border:1px solid rgba(255,220,180,.14)}'
].join('');
document.head.appendChild(css);

// ---------- draggable FAB factory ----------
function makeFab(opts){
  var fab = document.createElement('button');
  fab.className = 't-fab ' + opts.cls;
  fab.type = 'button';
  fab.setAttribute('aria-label', opts.label);
  fab.innerHTML = opts.halo ? '<div class="fab-halo"></div>' : '';
  fab.innerHTML += opts.iconHtml;
  if (opts.badgeHtml) fab.innerHTML += opts.badgeHtml;

  // restore saved position
  var saveKey = 'tribes.fab.' + opts.cls;
  try {
    var saved = JSON.parse(localStorage.getItem(saveKey) || 'null');
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      fab.style.left = saved.x + 'px';
      fab.style.top  = saved.y + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
    }
  } catch(e){}

  var dragging = false, moved = false, sx=0, sy=0, ox=0, oy=0, pid=null;

  function clampToViewport(x, y){
    var w = window.innerWidth, h = window.innerHeight;
    var r = fab.getBoundingClientRect();
    var fw = r.width || 58, fh = r.height || 58;
    return { x: Math.max(8, Math.min(w - fw - 8, x)), y: Math.max(60, Math.min(h - fh - 80, y)) };
  }

  function onDown(e){
    dragging = true; moved = false;
    fab.classList.add('dragging');
    var p = e.touches ? e.touches[0] : e;
    pid = e.pointerId != null ? e.pointerId : null;
    sx = p.clientX; sy = p.clientY;
    var r = fab.getBoundingClientRect();
    ox = r.left; oy = r.top;
    try { fab.setPointerCapture && pid != null && fab.setPointerCapture(pid); } catch(_){}
    e.preventDefault();
  }
  function onMove(e){
    if (!dragging) return;
    var p = e.touches ? e.touches[0] : e;
    var dx = p.clientX - sx, dy = p.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
    var pos = clampToViewport(ox + dx, oy + dy);
    fab.style.left = pos.x + 'px';
    fab.style.top  = pos.y + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
    e.preventDefault();
  }
  function onUp(e){
    if (!dragging) return;
    dragging = false;
    fab.classList.remove('dragging');
    var r = fab.getBoundingClientRect();
    // snap to nearest side
    var w = window.innerWidth, h = window.innerHeight;
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    var dx = Math.min(cx, w - cx), dy = Math.min(cy, h - cy);
    var x = r.left, y = r.top;
    if (dx < dy) x = (cx < w/2) ? 12 : (w - r.width - 12);
    else         y = (cy < h/2) ? 80 : (h - r.height - 80);
    fab.style.transition = 'left .3s cubic-bezier(.2,.9,.2,1), top .3s cubic-bezier(.2,.9,.2,1)';
    fab.style.left = x + 'px';
    fab.style.top  = y + 'px';
    setTimeout(function(){ fab.style.transition = ''; }, 320);
    try { localStorage.setItem(saveKey, JSON.stringify({ x:x, y:y })); } catch(_){}
    if (!moved){ setTimeout(function(){ opts.onTap && opts.onTap(); }, 20); }
  }
  fab.addEventListener('pointerdown', onDown);
  fab.addEventListener('pointermove', onMove);
  fab.addEventListener('pointerup', onUp);
  fab.addEventListener('pointercancel', onUp);
  // prevent click from firing after a drag
  fab.addEventListener('click', function(e){ if (moved){ e.preventDefault(); e.stopPropagation(); } }, true);
  document.body.appendChild(fab);
  return fab;
}

// ---------- icons ----------
var GIFT_ICON = [
'<svg viewBox="0 0 32 32" fill="none">',
'  <defs>',
'    <linearGradient id="tGiftA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff7a18"/></linearGradient>',
'    <linearGradient id="tGiftB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8862d"/><stop offset="1" stop-color="#8a5a1c"/></linearGradient>',
'  </defs>',
'  <rect x="5" y="12" width="22" height="16" rx="3" fill="url(#tGiftA)"/>',
'  <rect x="4" y="8" width="24" height="6" rx="2" fill="url(#tGiftB)"/>',
'  <rect x="14" y="8" width="4" height="20" fill="#fff2cf" opacity=".9"/>',
'  <path d="M16 8c-3 0-6-1-6-3s3-3 6 3z" fill="url(#tGiftA)"/>',
'  <path d="M16 8c3 0 6-1 6-3s-3-3-6 3z" fill="url(#tGiftA)"/>',
'  <rect class="ribbon" x="14" y="8" width="4" height="20" fill="#fff2cf" opacity=".7"/>',
'</svg>'
].join('');

var WARDEN_ICON = [
'<svg viewBox="0 0 32 32" fill="none">',
'  <defs><linearGradient id="tWd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#c0392b"/></linearGradient></defs>',
'  <circle cx="16" cy="16" r="9" stroke="url(#tWd)" stroke-width="2.2"/>',
'  <circle cx="16" cy="16" r="3.2" fill="url(#tWd)"/>',
'  <g stroke="url(#tWd)" stroke-width="2.2" stroke-linecap="round">',
'    <path d="M16 3v4"/><path d="M16 25v4"/><path d="M3 16h4"/><path d="M25 16h4"/>',
'    <path d="M6.5 6.5l2.8 2.8"/><path d="M22.7 22.7l2.8 2.8"/>',
'    <path d="M25.5 6.5l-2.8 2.8"/><path d="M9.3 22.7l-2.8 2.8"/>',
'  </g>',
'</svg>'
].join('');

// ---------- redeem (all players) ----------
var redeemFab = makeFab({
  cls: 'gift',
  label: 'Redeem a gift code',
  halo: true,
  iconHtml: GIFT_ICON,
  badgeHtml: '<span class="badge-dot">✦</span>',
  onTap: function(){ openRedeem(); }
});

var sheetWrap = document.createElement('div');
sheetWrap.className = 'r-sheet-bg';
sheetWrap.innerHTML = '<div class="r-sheet"><div class="r-handle"></div>'+
  '<h3>Redeem a Gift Code</h3><div class="r-sub">Enter the code from a Warden to claim your reward.</div>'+
  '<input id="rCode" placeholder="CODE" autocomplete="off" maxlength="32"/>'+
  '<button class="r-btn p" id="rSubmit">Claim reward</button>'+
  '<button class="r-btn g" id="rCancel">Cancel</button></div>';
document.body.appendChild(sheetWrap);

function openRedeem(){ sheetWrap.classList.add('open'); setTimeout(function(){ var i=el('rCode'); if(i) i.focus(); },260); }
function closeRedeem(){ sheetWrap.classList.remove('open'); var i=el('rCode'); if(i) i.value=''; }
el('rCancel').addEventListener('click', closeRedeem);
sheetWrap.addEventListener('click', function(e){ if(e.target===sheetWrap) closeRedeem(); });
el('rCode').addEventListener('keydown', function(e){ if(e.key==='Enter') submitRedeem(); });
el('rSubmit').addEventListener('click', submitRedeem);
function submitRedeem(){
  var code=(el('rCode').value||'').trim();
  if(!code){ toast('Enter a code',true); return; }
  fetch('/api/redeem',{method:'POST',headers:hdrs(true),body:JSON.stringify({code:code})})
    .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Failed');return j;});})
    .then(function(j){
      closeRedeem();
      var cx=window.innerWidth/2, cy=window.innerHeight/2;
      if(window.__tribesBurst) try{ window.__tribesBurst(cx,cy,22,180); }catch(e){}
      toast('🎁 +'+fmt(j.amount)+' '+j.kind+'!');
      if(window.refresh)try{window.refresh();}catch(e){}
    })
    .catch(function(e){ toast(e.message,true); });
}

// ---------- Warden console overlay (admins only) ----------
adminApi('/whoami').then(function(){ buildWarden(); }).catch(function(){ /* not an admin */ });

function buildWarden(){
  makeFab({
    cls: 'warden',
    label: 'Warden console',
    halo: false,
    iconHtml: WARDEN_ICON,
    onTap: function(){ ov.classList.add('open'); wStats(); }
  });

  var ov = document.createElement('div');
  ov.className = 'w-overlay';
  ov.id = 'wOverlay';
  var tabs = [
    ['stats','Overview'],
    ['players','Players'],
    ['tribes','Tribes'],
    ['wars','Wars'],
    ['payments','Payments'],
    ['economy','Economy'],
    ['trials','Trials'],
    ['bonfire','Bonfire'],
    ['codes','Codes'],
    ['control','Control']
  ];
  ov.innerHTML = '<div class="w-top"><b>🔥 Warden Console</b><button class="w-x" id="wClose">×</button></div>'+
    '<div class="w-tabs">'+tabs.map(function(t,i){return '<button class="w-tab'+(i?'':' active')+'" data-wt="'+t[0]+'">'+esc(t[1])+'</button>';}).join('')+'</div>'+
    '<div class="w-body">'+tabs.map(function(t,i){return '<div class="w-panel'+(i?'':' active')+'" id="wp-'+t[0]+'"></div>';}).join('')+'</div>';
  document.body.appendChild(ov);

  var loaders = {
    stats:wStats, players:wPlayers, tribes:wTribes, wars:wWars,
    payments:wPayments, economy:wEcon, trials:wTrials, bonfire:wBonfire,
    codes:wCodes, control:wControl
  };
  el('wClose').addEventListener('click', function(){ ov.classList.remove('open'); });
  ov.querySelectorAll('.w-tab').forEach(function(b){
    b.addEventListener('click', function(){
      ov.querySelectorAll('.w-tab').forEach(function(x){ x.classList.remove('active'); });
      ov.querySelectorAll('.w-panel').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      var k = b.getAttribute('data-wt');
      el('wp-'+k).classList.add('active');
      (loaders[k]||function(){})();
    });
  });

  // ----- Overview -----
  function wStats(){
    adminApi('/stats').then(function(s){
      var c = [['Players',fmt(s.users.n),s.users.banned+' banned'],
               ['Ember',fmt(s.users.ember),''],
               ['Tribes',fmt(s.tribes.n),'Pyre '+fmt(s.tribes.pyre)],
               ['Loyalty',fmt(s.tribes.loyalty),''],
               ['Wars',fmt(s.wars.active),s.wars.total+' all-time'],
               ['Star tx',fmt(s.payments.startx||s.payments.starTx||0),fmt(s.payments.stars)+' ⭐'],
               ['Maintenance',s.maintenance?'ON':'off','']];
      el('wp-stats').innerHTML = '<div class="w-cards">'+c.map(function(x){
        return '<div class="w-stat"><div class="k">'+esc(x[0])+'</div><div class="v">'+esc(x[1])+'</div><div class="s">'+esc(x[2])+'</div></div>';
      }).join('')+'</div>';
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Players -----
  function wPlayers(){
    el('wp-players').innerHTML = '<div class="w-row"><input id="wpq" placeholder="name, @user or id"><button class="w-btn" id="wps">Search</button></div><div id="wpl"></div><div id="wpc"></div>';
    el('wps').addEventListener('click', wpSearch);
    el('wpq').addEventListener('keydown', function(e){ if(e.key==='Enter') wpSearch(); });
  }
  function wpSearch(){
    adminApi('/players?q='+encodeURIComponent(el('wpq').value.trim())).then(function(rows){
      el('wpc').innerHTML = '';
      el('wpl').innerHTML = rows.length ? rows.map(function(r){
        return '<div class="w-item" data-pid="'+esc(r.id)+'"><div><div class="n">'+esc(r.first_name||'')+' <span class="m">@'+esc(r.username||'?')+'</span></div><div class="m">#'+esc(r.id)+' · '+esc(r.role)+' · '+fmt(r.ember)+'E '+fmt(r.loyalty)+'❤</div></div>'+(r.banned?'<span class="w-badge ban">banned</span>':'')+'</div>';
      }).join('') : '<p class="w-mut">No players.</p>';
      el('wpl').querySelectorAll('[data-pid]').forEach(function(it){
        it.addEventListener('click', function(){ wpOpen(it.getAttribute('data-pid')); });
      });
    }).catch(function(e){ toast(e.message,true); });
  }
  function wpOpen(id){
    adminApi('/player/'+id).then(function(p){
      if(!p) return;
      var roles = ['Toddler','Kin','Hunter','Elder','Head','Chief'];
      el('wpc').innerHTML = '<div class="w-card"><div class="n">'+esc(p.first_name||'')+' @'+esc(p.username||'?')+'</div>'+
        '<div class="w-kv"><span class="l">ID</span><span>'+esc(p.id)+'</span><span class="l">Role</span><span>'+esc(p.role)+'</span><span class="l">Ember</span><span>'+fmt(p.ember)+'</span><span class="l">Loyalty</span><span>'+fmt(p.loyalty)+'</span><span class="l">Tribe</span><span>'+esc(p.tribe_name||'—')+'</span><span class="l">Banned</span><span>'+(p.banned?('yes — '+esc(p.ban_reason||'')):'no')+'</span></div>'+
        '<div class="w-acts"><input id="wga" type="number" placeholder="amt"><select id="wgk"><option>ember</option><option>loyalty</option></select><button class="w-btn t" data-a="grant">Grant</button><select id="wrs">'+roles.map(function(x){return '<option'+(x===p.role?' selected':'')+'>'+x+'</option>';}).join('')+'</select><button class="w-btn t" data-a="role">Role</button>'+(p.banned?'<button class="w-btn t" data-a="unban">Unban</button>':'<input id="wbr" placeholder="reason"><button class="w-btn t d" data-a="ban">Ban</button>')+'</div></div>';
      var pid = p.id;
      el('wpc').querySelectorAll('[data-a]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-a');
          if(a==='grant') act('/grant',{id:pid,kind:el('wgk').value,amount:el('wga').value},'Granted').then(function(){ wpOpen(pid); });
          else if(a==='role') act('/role',{id:pid,role:el('wrs').value},'Role set').then(function(){ wpOpen(pid); });
          else if(a==='ban') act('/ban',{id:pid,reason:(el('wbr')||{}).value||''},'Banned').then(function(){ wpOpen(pid); });
          else if(a==='unban') act('/unban',{id:pid},'Unbanned').then(function(){ wpOpen(pid); });
        });
      });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Tribes -----
  function wTribes(){
    adminApi('/tribes').then(function(rows){
      el('wp-tribes').innerHTML = '<div id="wtl"></div><div id="wtc"></div>';
      el('wtl').innerHTML = rows.length ? rows.map(function(t){
        return '<div class="w-item" data-tid="'+esc(t.id)+'"><div><div class="n">'+esc(t.name)+'</div><div class="m">#'+esc(t.id)+' · '+fmt(t.members)+' kin · '+fmt(t.loyalty_total)+'❤ · Pyre '+fmt(t.treasury)+'</div></div><span class="w-badge">'+esc(t.wins)+'W/'+esc(t.losses)+'L</span></div>';
      }).join('') : '<p class="w-mut">No tribes.</p>';
      el('wtl').querySelectorAll('[data-tid]').forEach(function(it){
        it.addEventListener('click', function(){ wtOpen(it.getAttribute('data-tid')); });
      });
    }).catch(function(e){ toast(e.message,true); });
  }
  function wtOpen(id){
    adminApi('/tribe/'+id).then(function(t){
      if(!t) return;
      el('wtc').innerHTML = '<div class="w-card"><div class="n">'+esc(t.name)+'</div><div class="w-kv"><span class="l">ID</span><span>'+esc(t.id)+'</span><span class="l">Kin</span><span>'+fmt(t.members)+'</span><span class="l">Loyalty</span><span>'+fmt(t.loyalty_total)+'</span><span class="l">Pyre</span><span>'+fmt(t.treasury)+'</span></div><div class="w-acts"><input id="wtn" placeholder="new name"><button class="w-btn t" data-a="rename">Rename</button><input id="wtt" type="number" placeholder="pyre"><button class="w-btn t" data-a="treasury">Set</button><button class="w-btn t d" data-a="disband">Disband</button></div></div>';
      var tid = t.id;
      el('wtc').querySelectorAll('[data-a]').forEach(function(b){
        b.addEventListener('click', function(){
          var a = b.getAttribute('data-a');
          if(a==='rename') act('/tribe/rename',{id:tid,name:el('wtn').value},'Renamed').then(wTribes);
          else if(a==='treasury') act('/tribe/treasury',{id:tid,value:el('wtt').value},'Pyre set').then(function(){ wtOpen(tid); });
          else if(a==='disband'){ if(confirm('Disband this tribe?')) act('/tribe/disband',{id:tid},'Disbanded').then(wTribes); }
        });
      });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Wars -----
  function wWars(){
    adminApi('/wars').then(function(rows){
      el('wp-wars').innerHTML = '<div class="w-row"><input id="waa" placeholder="attacker id"><input id="wad" placeholder="defender id"><button class="w-btn" id="waw">Force war</button></div><div id="wwl"></div>';
      el('waw').addEventListener('click', function(){ act('/war/start',{attacker:el('waa').value,defender:el('wad').value},'War started').then(wWars); });
      el('wwl').innerHTML = rows.length ? rows.map(function(w){
        return '<div class="w-item"><div><div class="n">'+esc(w.a_name)+' <span class="m">'+fmt(w.attacker_score)+' vs '+fmt(w.defender_score)+'</span> '+esc(w.d_name)+'</div><div class="m">war #'+esc(w.id)+' · '+esc(w.challenge_id)+'</div></div><div style="display:flex;gap:5px"><button class="w-btn t" data-rw="'+esc(w.id)+'">Resolve</button><button class="w-btn t d" data-cw="'+esc(w.id)+'">Cancel</button></div></div>';
      }).join('') : '<p class="w-mut">No active wars.</p>';
      el('wwl').querySelectorAll('[data-rw]').forEach(function(b){ b.addEventListener('click', function(){ act('/war/resolve',{id:b.getAttribute('data-rw')},'Resolved').then(wWars); }); });
      el('wwl').querySelectorAll('[data-cw]').forEach(function(b){ b.addEventListener('click', function(){ act('/war/cancel',{id:b.getAttribute('data-cw')},'Cancelled').then(wWars); }); });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Payments -----
  function wPayments(){
    adminApi('/payments').then(function(rows){
      el('wp-payments').innerHTML = rows.length ? rows.map(function(p){
        return '<div class="w-item"><div><div class="n">'+esc(p.kind)+' '+fmt(p.amount)+(p.currency==='XTR'?' ⭐':'')+'</div><div class="m">user '+esc(p.user_id)+' · '+esc(p.status)+' · '+esc(p.charge_id)+'</div></div>'+(p.refunded?'<span class="w-badge ban">refunded</span>':'<button class="w-btn t" data-rf="'+esc(p.charge_id)+'">Refund</button>')+'</div>';
      }).join('') : '<p class="w-mut">No payments.</p>';
      el('wp-payments').querySelectorAll('[data-rf]').forEach(function(b){
        b.addEventListener('click', function(){ if(confirm('Refund this payment?')) act('/refund',{chargeId:b.getAttribute('data-rf')},'Refunded').then(wPayments); });
      });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Economy -----
  function wEcon(){
    adminApi('/econ').then(function(c){
      var defs = c._defaults || {};
      el('wp-economy').innerHTML = '<p class="w-mut">Live tuning — changes apply instantly.</p>' +
        Object.keys(defs).map(function(k){
          return '<div class="w-row" style="align-items:center"><label style="flex:1;font-size:13px;font-weight:700">'+esc(k)+' <span class="w-mut">(def '+esc(defs[k])+')</span></label><input style="max-width:110px" value="'+esc(c[k])+'" data-ek="'+esc(k)+'"><button class="w-btn t" data-es="'+esc(k)+'">Save</button></div>';
        }).join('') +
        '<button class="w-btn d" id="wer">Reset all to defaults</button>';
      el('wp-economy').querySelectorAll('[data-es]').forEach(function(b){
        b.addEventListener('click', function(){
          var k = b.getAttribute('data-es');
          act('/econ', { key:k, value: el('wp-economy').querySelector('[data-ek="'+k+'"]').value }, k+' saved');
        });
      });
      el('wer').addEventListener('click', function(){ if(confirm('Reset economy to defaults?')) act('/econ/reset',{},'Reset').then(wEcon); });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Trials -----
  function wTrials(){
    adminApi('/trials').then(function(rows){
      el('wp-trials').innerHTML = '<div class="w-card"><div class="n">Create / edit trials</div>' +
        '<p class="w-mut">Live editor. Rewards, cooldowns, windows. Changes apply instantly.</p>' +
        '<button class="w-btn p" id="wtnnew">New trial</button>' +
        '<button class="w-btn d" id="wtrst" style="margin-left:6px">Reset all cooldowns</button></div>' +
        '<div id="wtlist"></div>';
      el('wtnnew').addEventListener('click', function(){ wtEdit(null); });
      el('wtrst').addEventListener('click', function(){ if(confirm('Clear every user\u2019s trial cooldowns?')) act('/trials/reset',{},'Trials reset'); });
      el('wtlist').innerHTML = rows.length ? rows.map(function(t){
        return '<div class="w-item"><div><div class="n">'+esc(t.glyph)+' '+esc(t.name)+' <span class="m">'+esc(t.slug)+'</span></div>' +
               '<div class="m">+'+fmt(t.reward_ember)+'E +'+fmt(t.reward_loyalty)+'❤ · cd '+esc(t.cooldown_hours)+'h' +
               (t.window_hours?(' · window '+esc(t.window_start_utc)+'–'+((Number(t.window_start_utc)+Number(t.window_hours))%24)+' UTC'):'') +
               (t.active?'':' · <b>inactive</b>')+'</div></div>' +
               '<div style="display:flex;gap:5px"><button class="w-btn t" data-te="'+esc(t.id)+'">Edit</button><button class="w-btn t d" data-td="'+esc(t.id)+'">Delete</button></div></div>';
      }).join('') : '<p class="w-mut">No trials.</p>';
      el('wtlist').querySelectorAll('[data-te]').forEach(function(b){
        b.addEventListener('click', function(){
          var id = b.getAttribute('data-te');
          adminApi('/trials').then(function(all){ wtEdit(all.find(function(x){return String(x.id)===String(id);})); });
        });
      });
      el('wtlist').querySelectorAll('[data-td]').forEach(function(b){
        b.addEventListener('click', function(){
          if(confirm('Delete this trial?')) act('/trials/delete',{id:b.getAttribute('data-td')},'Deleted').then(wTrials);
        });
      });
    }).catch(function(e){ toast(e.message,true); });
  }
  function wtEdit(t){
    t = t || { slug:'', name:'', glyph:'🔥', hint:'', reward_ember:100, reward_loyalty:10, cooldown_hours:20, max_per_window:1, window_hours:0, window_start_utc:0, active:true, sort_order:100 };
    el('wp-trials').innerHTML = '<div class="w-card"><div class="n">'+(t.id?'Edit':'New')+' trial</div>' +
      '<div class="w-row"><input id="tt_slug" placeholder="slug (a-z_0-9)" value="'+esc(t.slug)+'" '+(t.id?'disabled':'')+'><input id="tt_name" placeholder="name" value="'+esc(t.name)+'"></div>' +
      '<div class="w-row"><input id="tt_glyph" placeholder="glyph (emoji)" value="'+esc(t.glyph)+'" maxlength="4"><input id="tt_hint" placeholder="hint" value="'+esc(t.hint)+'"></div>' +
      '<div class="w-row"><input id="tt_re" type="number" placeholder="reward ember" value="'+esc(t.reward_ember)+'"><input id="tt_rl" type="number" placeholder="reward loyalty" value="'+esc(t.reward_loyalty)+'"></div>' +
      '<div class="w-row"><input id="tt_cd" type="number" placeholder="cooldown hours" value="'+esc(t.cooldown_hours)+'"><input id="tt_mw" type="number" placeholder="max per window" value="'+esc(t.max_per_window)+'"></div>' +
      '<div class="w-row"><input id="tt_wh" type="number" placeholder="window hours (0=off)" value="'+esc(t.window_hours)+'"><input id="tt_ws" type="number" placeholder="window start UTC hour" value="'+esc(t.window_start_utc)+'"></div>' +
      '<div class="w-row"><label style="flex:1"><input type="checkbox" id="tt_act" '+(t.active?'checked':'')+'> active</label><input id="tt_so" type="number" placeholder="sort order" value="'+esc(t.sort_order)+'"></div>' +
      '<button class="w-btn p" id="tt_save">Save</button> <button class="w-btn" id="tt_cancel">Cancel</button></div>';
    el('tt_cancel').addEventListener('click', wTrials);
    el('tt_save').addEventListener('click', function(){
      var data = {
        slug: (el('tt_slug').value||'').trim(),
        name: el('tt_name').value,
        glyph: el('tt_glyph').value,
        hint: el('tt_hint').value,
        reward_ember: el('tt_re').value,
        reward_loyalty: el('tt_rl').value,
        cooldown_hours: el('tt_cd').value,
        max_per_window: el('tt_mw').value,
        window_hours: el('tt_wh').value,
        window_start_utc: el('tt_ws').value,
        active: el('tt_act').checked,
        sort_order: el('tt_so').value,
      };
      var p = t.id ? act('/trials/update', Object.assign({ id:t.id }, data), 'Updated') : act('/trials', data, 'Created');
      p.then(wTrials);
    });
  }

  // ----- Bonfire -----
  function wBonfire(){
    adminApi('/bonfires').then(function(rows){
      el('wp-bonfire').innerHTML = '<div class="w-card"><div class="n">Schedule a bonfire</div>' +
        '<div class="w-row"><input id="bf_t" placeholder="title" value="Double Ash"><select id="bf_m"><option>ember</option><option>loyalty</option><option>ash</option><option>checkin</option><option>war</option></select></div>' +
        '<div class="w-row"><input id="bf_x" type="number" step="0.1" placeholder="multiplier" value="2"><input id="bf_h" type="number" placeholder="hours" value="2"></div>' +
        '<button class="w-btn p" id="bf_go">Start now</button></div>' +
        '<div id="bflist"></div>';
      el('bf_go').addEventListener('click', function(){
        var hours = Number(el('bf_h').value) || 2;
        var start = new Date();
        var end = new Date(Date.now() + hours*3600*1000);
        act('/bonfires', { title: el('bf_t').value, metric: el('bf_m').value, multiplier: el('bf_x').value, start_at: start.toISOString(), end_at: end.toISOString() }, 'Bonfire started').then(wBonfire);
      });
      el('bflist').innerHTML = rows.length ? rows.map(function(b){
        var active = new Date(b.start_at) <= new Date() && new Date(b.end_at) > new Date();
        return '<div class="w-item"><div><div class="n">'+esc(b.title)+' <span class="m">'+esc(b.metric)+' ×'+esc(b.multiplier)+'</span></div>' +
               '<div class="m">'+esc(String(b.start_at).slice(0,16))+' → '+esc(String(b.end_at).slice(0,16))+(active?' · ACTIVE':'')+'</div></div>' +
               (active?'<button class="w-btn t d" data-be="'+esc(b.id)+'">End now</button>':'')+'</div>';
      }).join('') : '<p class="w-mut">No bonfires.</p>';
      el('bflist').querySelectorAll('[data-be]').forEach(function(b){
        b.addEventListener('click', function(){ act('/bonfires/end',{id:b.getAttribute('data-be')},'Bonfire ended').then(wBonfire); });
      });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Codes -----
  function wCodes(){
    adminApi('/codes').then(function(rows){
      el('wp-codes').innerHTML = '<div class="w-card"><div class="n">Create a gift code</div>' +
        '<div class="w-row"><input id="wcc" placeholder="CODE"><select id="wck"><option>ember</option><option>loyalty</option></select></div>' +
        '<div class="w-row"><input id="wca" type="number" placeholder="amount"><input id="wcm" type="number" placeholder="max uses (0=∞)"><input id="wcd" type="number" placeholder="expires days"></div>' +
        '<button class="w-btn p" id="wcb">Create code</button></div><div id="wcl"></div>';
      el('wcb').addEventListener('click', function(){
        act('/codes', { code: el('wcc').value, kind: el('wck').value, amount: el('wca').value, maxUses: el('wcm').value, expiresDays: el('wcd').value }, 'Code created').then(wCodes);
      });
      el('wcl').innerHTML = rows.length ? rows.map(function(c){
        return '<div class="w-item"><div><div class="n">'+esc(c.code)+'</div><div class="m">'+fmt(c.amount)+' '+esc(c.kind)+' · used '+esc(c.uses)+(c.max_uses?('/'+esc(c.max_uses)):'')+(c.expires_at?(' · exp '+esc(String(c.expires_at).slice(0,10))):'')+'</div></div><button class="w-btn t d" data-dc="'+esc(c.code)+'">Delete</button></div>';
      }).join('') : '<p class="w-mut">No codes yet.</p>';
      el('wcl').querySelectorAll('[data-dc]').forEach(function(b){
        b.addEventListener('click', function(){ if(confirm('Delete this code?')) act('/codes/delete',{code:b.getAttribute('data-dc')},'Deleted').then(wCodes); });
      });
    }).catch(function(e){ toast(e.message,true); });
  }

  // ----- Control -----
  function wControl(){
    el('wp-control').innerHTML = '<div class="w-card"><div class="n">Maintenance mode</div><p class="w-mut">Freezes all player actions (reads still work).</p><div class="w-row"><button class="w-btn d" id="wmon">Enable</button><button class="w-btn" id="wmoff">Disable</button></div></div>' +
      '<div class="w-card"><div class="n">Broadcast</div><textarea id="wbt" rows="3" placeholder="Message to all players…"></textarea><button class="w-btn p" id="wbs" style="margin-top:8px">Send to all</button></div>' +
      '<div class="w-card"><div class="n">Season wipe</div><p class="w-mut">Resets Loyalty &amp; war records. Balances kept.</p><button class="w-btn d" id="wwp">Wipe season</button></div>';
    el('wmon').addEventListener('click', function(){ act('/maintenance',{on:'on'},'Maintenance ON'); });
    el('wmoff').addEventListener('click', function(){ act('/maintenance',{on:'off'},'Maintenance off'); });
    el('wbs').addEventListener('click', function(){
      var t = el('wbt').value.trim();
      if(!t){ toast('Write a message',true); return; }
      if(confirm('Send to every player?')) act('/broadcast',{text:t},'Broadcast sent').then(function(d){ toast('Sent to '+fmt(d.sent)); el('wbt').value=''; });
    });
    el('wwp').addEventListener('click', function(){ if(confirm('Wipe the season? Loyalty & war records reset.')) act('/wipeseason',{},'Season wiped'); });
  }
}

// ---------- expose a burst helper ----------
window.__tribesBurst = function(x,y,count,spread){
  for(var i=0;i<count;i++){
    var a=(Math.PI*2)*(i/count)+(Math.random()*.5);
    var dist=(spread||120)*(0.55+Math.random()*0.6);
    var dx=Math.cos(a)*dist, dy=Math.sin(a)*dist-20;
    var e=document.createElement('div');e.className='fx-ember';
    e.style.left=(x-3)+'px'; e.style.top=(y-3)+'px';
    e.style.width=(4+Math.random()*5)+'px'; e.style.height=e.style.width;
    (document.getElementById('fxRoot')||document.body).appendChild(e);
    e.style.transition='transform 900ms cubic-bezier(.15,.75,.3,1), opacity 900ms ease-out';
    requestAnimationFrame((function(el,dx,dy){ return function(){ el.style.transform='translate('+dx+'px,'+dy+'px) scale(.3)'; el.style.opacity='0'; }; })(e,dx,dy));
    setTimeout((function(el){return function(){ el.remove(); }; })(e), 1100);
  }
};
})();