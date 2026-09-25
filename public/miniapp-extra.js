// TRIBES — in-app extras: gift-code redemption sheet, and the in-app
// Warden console (single-column, uses the same /api/admin endpoints).
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

var css = document.createElement('style');
css.textContent = [
'.w-fab{position:fixed;right:16px;z-index:900;width:56px;height:56px;border-radius:50%;cursor:pointer;',
'  background:linear-gradient(160deg,rgba(34,26,18,.95),rgba(18,13,9,.95));border:1px solid rgba(255,220,180,.18);',
'  color:#ffcf7a;box-shadow:0 12px 28px rgba(0,0,0,.55);display:grid;place-items:center;font-size:22px}',
'.w-fab:active{transform:scale(.94)}',
'.w-fab.gift{bottom:calc(env(safe-area-inset-bottom,0px) + 100px)}',
'.w-fab.warden{bottom:calc(env(safe-area-inset-bottom,0px) + 168px);color:#ff9d3c}',
'.w-overlay{position:fixed;inset:0;z-index:950;background:rgba(4,3,2,.97);backdrop-filter:blur(6px);display:none;flex-direction:column;color:#f5ede0;font-family:Inter,sans-serif}',
'.w-overlay.open{display:flex}',
'.w-top{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid rgba(255,220,180,.12)}',
'.w-top b{font-weight:800}',
'.w-x{background:none;border:none;color:#9a8d7e;font-size:26px;cursor:pointer;line-height:1}',
'.w-search{padding:10px 14px;border-bottom:1px solid rgba(255,220,180,.12)}',
'.w-search input{width:100%;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05);border:1px solid rgba(255,220,180,.14);color:#f5ede0;font-size:14px;font-family:inherit}',
'.w-tabs{display:flex;gap:6px;overflow-x:auto;padding:10px 12px;scrollbar-width:none;border-bottom:1px solid rgba(255,220,180,.12)}.w-tabs::-webkit-scrollbar{display:none}',
'.w-tab{background:rgba(255,255,255,.04);border:1px solid rgba(255,220,180,.14);color:#9a8d7e;padding:7px 13px;border-radius:999px;font-size:12px;white-space:nowrap;cursor:pointer;font-weight:700;font-family:inherit}',
'.w-tab.active{background:linear-gradient(160deg,#ff9d3c,#ff7a18);border-color:transparent;color:#1a0d04}',
'.w-body{flex:1;overflow-y:auto;padding:14px 14px 40px}',
'.w-group{background:linear-gradient(160deg,rgba(34,26,18,.72),rgba(15,11,8,.72));border:1px solid rgba(255,220,180,.14);border-radius:16px;padding:14px;margin-bottom:12px}',
'.w-group h3{margin:0 0 10px;font-size:12px;font-weight:800;color:#ffcf7a;text-transform:uppercase;letter-spacing:.06em}',
'.w-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,220,180,.08)}',
'.w-row:last-child{border-bottom:0}',
'.w-row .lbl{flex:1;min-width:0}',
'.w-row .lbl b{display:block;font-size:13px;font-weight:700}',
'.w-row .lbl span{display:block;font-size:11px;color:#9a8d7e;margin-top:2px}',
'.w-row .val{font-variant-numeric:tabular-nums;font-weight:800;color:#ffcf7a;font-size:13px}',
'.w-sel{background:rgba(0,0,0,.3);border:1px solid rgba(255,220,180,.14);color:#f5ede0;border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit}',
'.w-btn{background:rgba(255,255,255,.05);border:1px solid rgba(255,220,180,.14);color:#f5ede0;padding:8px 14px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit}',
'.w-btn.danger{border-color:rgba(192,57,43,.5);color:#ff8a8a}',
'.w-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%) translateY(30px);background:linear-gradient(160deg,rgba(34,26,18,.95),rgba(18,13,9,.95));border:1px solid rgba(255,122,24,.5);color:#f5ede0;padding:12px 20px;border-radius:12px;opacity:0;transition:.3s;z-index:999;max-width:90%;font-weight:700}',
'.w-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}.w-toast.bad{border-color:rgba(192,57,43,.6)}',
'.r-sheet-bg{position:fixed;inset:0;z-index:960;background:rgba(4,3,2,.7);backdrop-filter:blur(8px);display:none;place-items:end center}',
'.r-sheet-bg.open{display:grid;animation:rFade .26s}@keyframes rFade{from{opacity:0}to{opacity:1}}',
'.r-sheet{width:100%;max-width:520px;background:linear-gradient(180deg,rgba(30,22,14,.98),rgba(14,10,7,.98));border-radius:24px 24px 0 0;border-top:1px solid rgba(255,220,180,.18);padding:10px 18px calc(env(safe-area-inset-bottom,0px) + 24px);color:#f5ede0;font-family:Inter,sans-serif;animation:rIn .42s cubic-bezier(.2,.9,.2,1)}',
'@keyframes rIn{from{transform:translateY(100%)}to{transform:none}}',
'.r-sheet .r-handle{width:44px;height:4px;border-radius:4px;background:rgba(255,220,180,.22);margin:6px auto 16px}',
'.r-sheet h3{margin:0 0 4px;font-weight:800;color:#ffcf7a;font-size:1.2rem}',
'.r-sheet .r-sub{font-size:.78rem;color:#9a8d7e;margin-bottom:16px}',
'.r-sheet input{width:100%;padding:14px 15px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,220,180,.18);color:#fff;font-size:.95rem;outline:none;font-family:inherit;margin-bottom:12px;letter-spacing:.08em;text-transform:uppercase}',
'.r-sheet .r-btn{display:flex;width:100%;align-items:center;justify-content:center;padding:14px;border-radius:14px;font-weight:800;border:none;cursor:pointer;font-family:inherit;font-size:.92rem}',
'.r-sheet .r-btn.p{background:linear-gradient(160deg,#ffd27a,#ff8a2a 60%,#ef5f1a);color:#2a1402}',
'.r-sheet .r-btn.g{background:rgba(255,255,255,.05);color:#f5ede0;margin-top:8px;border:1px solid rgba(255,220,180,.14)}'
].join('');
document.head.appendChild(css);

/* ---------- Gift FAB ---------- */
var giftFab = document.createElement('button');
giftFab.className = 'w-fab gift'; giftFab.textContent = '🎁';
var sheetWrap = document.createElement('div');
sheetWrap.className = 'r-sheet-bg';
sheetWrap.innerHTML = '<div class="r-sheet"><div class="r-handle"></div>' +
  '<h3>Redeem a Gift Code</h3><div class="r-sub">Enter the code from a Warden.</div>' +
  '<input id="rCode" placeholder="CODE" autocomplete="off" maxlength="32"/>' +
  '<button class="r-btn p" id="rSubmit">Claim reward</button>' +
  '<button class="r-btn g" id="rCancel">Cancel</button></div>';
document.body.appendChild(giftFab);
document.body.appendChild(sheetWrap);
giftFab.addEventListener('click', function(){ sheetWrap.classList.add('open'); setTimeout(function(){ var i=el('rCode'); if(i)i.focus(); },260); });
function closeRedeem(){ sheetWrap.classList.remove('open'); var i=el('rCode'); if(i)i.value=''; }
el('rCancel').addEventListener('click', closeRedeem);
sheetWrap.addEventListener('click', function(e){ if(e.target===sheetWrap) closeRedeem(); });
el('rSubmit').addEventListener('click', submitRedeem);
el('rCode').addEventListener('keydown', function(e){ if(e.key==='Enter') submitRedeem(); });
function submitRedeem(){
  var code=(el('rCode').value||'').trim();
  if(!code){ toast('Enter a code',true); return; }
  fetch('/api/redeem',{method:'POST',headers:hdrs(true),body:JSON.stringify({code:code})})
    .then(function(r){return r.json().then(function(j){if(!r.ok)throw new Error(j.error||'Failed');return j;});})
    .then(function(j){
      closeRedeem();
      toast('🎁 +'+fmt(j.amount)+' '+j.kind+'!');
      if(window.refresh)try{window.refresh();}catch(e){}
    })
    .catch(function(e){ toast(e.message,true); });
}

/* ---------- Warden overlay ---------- */
adminApi('/whoami').then(function(){ buildWarden(); }).catch(function(){});

function buildWarden(){
  var fab = document.createElement('button');
  fab.className = 'w-fab warden'; fab.textContent = '⚙️';
  document.body.appendChild(fab);

  var ov = document.createElement('div');
  ov.className = 'w-overlay'; ov.id = 'wOverlay';
  var tabs = [
    ['overview','Overview'],
    ['trials','Trials'],
    ['economy','Economy'],
    ['bonfire','Bonfire'],
    ['names','Names'],
    ['codes','Codes'],
    ['players','Players'],
    ['tribes','Tribes'],
    ['payments','Payments'],
    ['control','Control'],
    ['danger','⚠️ Danger'],
  ];
  ov.innerHTML = '<div class="w-top"><b>🔥 Warden</b><button class="w-x" id="wClose">×</button></div>' +
    '<div class="w-search"><input id="wSearch" placeholder="Filter…"></div>' +
    '<div class="w-tabs">' + tabs.map(function(t,i){
      return '<button class="w-tab' + (i?'':' active') + '" data-wt="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>' +
    '<div class="w-body" id="wBody"></div>';
  document.body.appendChild(ov);

  fab.addEventListener('click', function(){ ov.classList.add('open'); openTab('overview'); });
  el('wClose').addEventListener('click', function(){ ov.classList.remove('open'); });
  ov.querySelectorAll('.w-tab').forEach(function(b){
    b.addEventListener('click', function(){
      ov.querySelectorAll('.w-tab').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      openTab(b.getAttribute('data-wt'));
    });
  });

  function openTab(name){
    var body = el('wBody');
    body.innerHTML = '<div class="w-mut" style="padding:20px;text-align:center">Loading…</div>';
    (TABFNS[name] || TABFNS.overview)(body);
  }

  var TABFNS = {
    overview: function(body){
      adminApi('/stats').then(function(s){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Live</h3>';
        [['Players', fmt(s.users.n) + ' (' + s.users.banned + ' banned)'],
         ['Ember', fmt(s.users.ember)],
         ['Tribes', fmt(s.tribes.n)],
         ['Wars', s.wars.active + ' active / ' + s.wars.total + ' total'],
         ['Maintenance', s.maintenance ? 'ON' : 'off']].forEach(function(row){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>' + row[0] + '</b></div><span class="val">' + row[1] + '</span>';
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div class="w-mut">' + esc(e.message) + '</div>'; });
    },
    trials: function(body){
      adminApi('/trials').then(function(list){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Trials</h3>';
        list.forEach(function(t){
          var r = document.createElement('div'); r.className = 'w-row';
          var sel = document.createElement('select'); sel.className = 'w-sel';
          ['hold','stoke','feed','cry','sift','ad'].forEach(function(m){
            var o = document.createElement('option'); o.value = m; o.textContent = m;
            if ((t.minigame||'hold') === m) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener('change', function(){
            act('/trial/minigame', { slug: t.slug, minigame: sel.value }, t.slug + ' → ' + sel.value);
          });
          r.innerHTML = '<div class="lbl"><b>' + esc(t.glyph) + ' ' + esc(t.name) + '</b><span>+' + fmt(t.reward_ember) + 'E</span></div>';
          r.appendChild(sel);
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div class="w-mut">' + esc(e.message) + '</div>'; });
    },
    economy: function(body){
      adminApi('/econ').then(function(cfg){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Economy</h3>';
        ['ashMinutes','ashCap','ashUnit','checkin_base','foundEmber'].forEach(function(k){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>' + k + '</b></div><span class="val">' + fmt(cfg[k]) + '</span>';
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div class="w-mut">' + esc(e.message) + '</div>'; });
    },
    bonfire: function(body){ TABFNS.overview(body); },
    names: function(body){ TABFNS.overview(body); },
    codes: function(body){ TABFNS.overview(body); },
    players: function(body){ TABFNS.overview(body); },
    tribes: function(body){ TABFNS.overview(body); },
    payments: function(body){ TABFNS.overview(body); },
    control: function(body){
      body.innerHTML = '';
      var g = document.createElement('div'); g.className = 'w-group';
      g.innerHTML = '<h3>Maintenance</h3>';
      var en = document.createElement('button'); en.className = 'w-btn danger'; en.textContent = 'Enable';
      en.addEventListener('click', function(){ act('/maintenance', { on: 'on' }, 'Maintenance ON'); });
      var off = document.createElement('button'); off.className = 'w-btn'; off.textContent = 'Disable'; off.style.marginLeft = '8px';
      off.addEventListener('click', function(){ act('/maintenance', { on: 'off' }, 'Maintenance off'); });
      g.appendChild(en); g.appendChild(off);
      body.appendChild(g);
    },
    danger: function(body){
      adminApi('/reset/preview', { method: 'POST' }).then(function(p){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.style.borderColor = 'rgba(192,57,43,.5)';
        g.innerHTML = '<h3 style="color:#ff8a8a">⚠️ Progression Reset</h3>' +
          '<p style="font-size:12px;color:#e7c8c3;margin:0 0 10px">Wipes all free progress. Keeps accounts, cosmetics, Stars.</p>';
        var b = document.createElement('button'); b.className = 'w-btn danger'; b.textContent = 'Reset Progression';
        b.addEventListener('click', function(){
          var w = prompt('Type RESET to confirm progression wipe');
          if ((w||'').toUpperCase() !== 'RESET') return;
          act('/reset/progression', {}, 'Progression reset started…').then(function(){ toast('Reset complete'); });
        });
        g.appendChild(b);
        body.appendChild(g);

        var g2 = document.createElement('div'); g2.className = 'w-group';
        g2.style.borderColor = 'rgba(192,57,43,.5)';
        g2.innerHTML = '<h3 style="color:#ff8a8a">🛑 Factory Reset</h3>' +
          '<p style="font-size:12px;color:#e7c8c3;margin:0 0 10px">Deletes everything except user accounts.</p>';
        var b2 = document.createElement('button'); b2.className = 'w-btn danger'; b2.textContent = 'Factory Reset';
        b2.addEventListener('click', function(){
          var w = prompt('Type FACTORY to confirm full reset');
          if ((w||'').toUpperCase() !== 'FACTORY') return;
          act('/reset/factory', {}, 'Factory reset started…').then(function(){ toast('Reset complete'); });
        });
        g2.appendChild(b2);
        body.appendChild(g2);
      }).catch(function(e){ body.innerHTML = '<div class="w-mut">' + esc(e.message) + '</div>'; });
    }
  };
}
})();