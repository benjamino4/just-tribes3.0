/* =====================================================================
   TRIBES — in-app extras: gift-code redemption, Kiva chat, Warden console,
   extra trial minigames (stoke/feed/cry/sift/ad).
===================================================================== */
(function(){
'use strict';

var TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

function hdrs(json){
  var h = {};
  if (TG && TG.initData) h['X-Init-Data'] = TG.initData;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
  });
}
function fmt(n){
  n = Number(n) || 0;
  return n >= 1e6 ? (n/1e6).toFixed(2) + 'M'
       : n >= 1e3 ? (n/1e3).toFixed(1) + 'k'
       : Math.floor(n).toLocaleString();
}
function el(id){ return document.getElementById(id); }
function iconSpan(name, cls, size){
  var parts = ['data-icon="' + name + '"'];
  if (cls) parts.push('data-icon-class="' + cls + '"');
  if (size) parts.push('data-icon-size="' + size + '"');
  return '<span ' + parts.join(' ') + '></span>';
}
function toast(msg, bad){
  var t = el('wToast');
  if (!t){ t = document.createElement('div'); t.id = 'wToast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'w-toast show' + (bad ? ' bad' : '');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className = 'w-toast'; }, 2600);
}
function adminApi(path, opts){
  opts = opts || {};
  opts.headers = hdrs(!!opts.body);
  if (opts.body) opts.body = JSON.stringify(opts.body);
  return fetch('/api/admin' + path, opts).then(function(r){
    return r.json().then(function(j){
      if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
      return j.data;
    });
  });
}
function act(path, body, msg){
  return adminApi(path, { method:'POST', body: body || {} })
    .then(function(d){ toast(msg || 'Done'); return d; })
    .catch(function(e){ toast(e.message, true); throw e; });
}

/* =====================================================================
   Gift code FAB + redeem sheet
===================================================================== */
(function installGiftRedeem(){
  var css = document.createElement('style');
  css.textContent = [
    '.w-fab{position:fixed;right:16px;z-index:900;width:56px;height:56px;border-radius:50%;cursor:pointer;',
    '  background:linear-gradient(160deg,rgba(34,26,18,.95),rgba(18,13,9,.95));border:1px solid rgba(255,220,180,.18);',
    '  color:#ffcf7a;box-shadow:0 12px 28px rgba(0,0,0,.55);display:grid;place-items:center;}',
    '.w-fab:active{transform:scale(.94)}',
    '.w-fab .ico{width:22px;height:22px;stroke-width:1.63}',
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
    '.r-sheet .r-btn.g{background:rgba(255,255,255,.05);color:#f5ede0;margin-top:8px;border:1px solid rgba(255,220,180,.14)}',
  ].join('');
  document.head.appendChild(css);

  var giftFab = document.createElement('button');
  giftFab.className = 'w-fab gift';
  giftFab.innerHTML = iconSpan('gift','',22);
  var sheetWrap = document.createElement('div');
  sheetWrap.className = 'r-sheet-bg';
  sheetWrap.innerHTML = '<div class="r-sheet"><div class="r-handle"></div>' +
    '<h3>Redeem a Gift Code</h3><div class="r-sub">Enter the code from a Warden.</div>' +
    '<input id="rCode" placeholder="CODE" autocomplete="off" maxlength="32"/>' +
    '<button class="r-btn p" id="rSubmit">Claim reward</button>' +
    '<button class="r-btn g" id="rCancel">Cancel</button></div>';
  document.body.appendChild(giftFab);
  document.body.appendChild(sheetWrap);
  if (window.hydrateIcons) window.hydrateIcons();

  giftFab.addEventListener('click', function(){
    sheetWrap.classList.add('open');
    setTimeout(function(){ var i = el('rCode'); if (i) i.focus(); }, 260);
  });
  function closeRedeem(){ sheetWrap.classList.remove('open'); var i = el('rCode'); if (i) i.value = ''; }
  el('rCancel').addEventListener('click', closeRedeem);
  sheetWrap.addEventListener('click', function(e){ if (e.target === sheetWrap) closeRedeem(); });
  el('rSubmit').addEventListener('click', submitRedeem);
  el('rCode').addEventListener('keydown', function(e){ if (e.key === 'Enter') submitRedeem(); });

  function submitRedeem(){
    var code = (el('rCode').value || '').trim();
    if (!code){ toast('Enter a code', true); return; }
    fetch('/api/redeem', {
      method:'POST',
      headers: hdrs(true),
      body: JSON.stringify({ code: code }),
    })
      .then(function(r){ return r.json().then(function(j){ if (!r.ok) throw new Error(j.error || 'Failed'); return j; }); })
      .then(function(j){
        closeRedeem();
        toast('Received +' + fmt(j.amount) + ' ' + j.kind + '!');
        if (window.refresh) try { window.refresh(); } catch(e){}
      })
      .catch(function(e){ toast(e.message, true); });
  }
})();

/* =====================================================================
   Kiva chat sheet
===================================================================== */
var kivaEs = null, kivaPoll = null, kivaLastId = 0, kivaOpen = false;

window.openKiva = function openKiva(){
  if (!window.S || !window.S.tribe) return;
  kivaOpen = true;
  var root = document.getElementById('sheetRoot');
  if (!root) return;
  root.innerHTML = '<div class="sheet-bg" data-act="bgClose"><div class="sheet"><div class="handle"></div>' +
    '<div class="kiva-sheet">' +
      '<div class="kiva-head"><b>' + esc(window.S.tribe.name) + ' — Kiva</b>' +
      '<button class="btn btn-ghost" data-act="closeSheet" style="padding:6px 10px;font-size:.72rem">Close</button></div>' +
      '<div class="kiva-feed" id="kivaFeed"><div class="skeleton" style="height:44px"></div></div>' +
      '<div class="kiva-compose"><input id="kivaInput" maxlength="280" placeholder="Say something…"/>' +
      '<button class="send" data-act="sendKiva">' + iconSpan('arrow-right','',20) + '</button></div>' +
    '</div>' +
  '</div></div>';
  if (window.hydrateIcons) window.hydrateIcons();
  loadKiva();
  connectKivaStream();
};

async function loadKiva(){
  try {
    var d = await fetch('/api/kiva', { headers: hdrs() }).then(r => r.json());
    var rows = (d.messages || []);
    kivaLastId = rows.length ? rows[rows.length - 1].id : 0;
    renderKivaFeed(rows);
  } catch(e){
    var f = el('kivaFeed');
    if (f) f.innerHTML = '<p class="tiny">Could not reach the Kiva.</p>';
  }
}
function renderKivaFeed(rows){
  var feed = el('kivaFeed'); if (!feed) return;
  feed.innerHTML = rows.map(kivaMsgHtml).join('');
  feed.scrollTop = feed.scrollHeight;
}
function kivaMsgHtml(m){
  if (m.kind === 'system' || m.kind === 'war' || m.kind === 'level'){
    return '<div class="kiva-msg system"><b>' + esc(m.body) + '</b></div>';
  }
  var me = window.S && window.S.user && m.user_id === window.S.user.id;
  var canPin = window.S && ['Chief','Head','Elder'].includes(window.S.user.role);
  return '<div class="kiva-msg ' + (me ? 'self' : '') + '" data-mid="' + m.id + '">' +
    '<div class="km-av">' + esc((m.first_name || '?').slice(0,1).toUpperCase()) + '</div>' +
    '<div class="km-body"><div class="km-meta">' +
      '<span class="km-name">' + esc(m.first_name || m.username || 'Kin') + '</span>' +
      (m.role && m.role !== 'Toddler' ? '<span class="km-role">' + esc(m.role) + '</span>' : '') +
    '</div>' +
    '<div class="km-text">' + esc(m.body) + '</div>' +
    (canPin ? '<div class="km-actions"><button data-act="pinKiva" data-val="' + m.id + '">Pin</button></div>' : '') +
  '</div></div>';
}
function connectKivaStream(){
  if (!window.S || !window.S.tribe) return;
  try {
    var initData = TG && TG.initData ? encodeURIComponent(TG.initData) : '';
    var guestId = localStorage.getItem('tribes.guest') || '';
    kivaEs = new EventSource('/api/kiva/stream?tribeId=' +
      encodeURIComponent(window.S.tribe.id) +
      '&initData=' + initData +
      '&guestId=' + encodeURIComponent(guestId));

    var opened = false;
    var guard = setTimeout(function(){
      if (!opened && kivaEs){ kivaEs.close(); kivaEs = null; startKivaPoll(); }
    }, 3000);

    kivaEs.onopen = function(){
      opened = true;
      clearTimeout(guard);
      if (kivaPoll){ clearInterval(kivaPoll); kivaPoll = null; }
    };
    kivaEs.onmessage = function(ev){
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'message' && msg.message && msg.message.id > kivaLastId){
          kivaLastId = msg.message.id;
          var feed = el('kivaFeed');
          if (feed){
            feed.insertAdjacentHTML('beforeend', kivaMsgHtml(msg.message));
            feed.scrollTop = feed.scrollHeight;
          }
        }
      } catch(e){}
    };
  } catch(e){ startKivaPoll(); }
}
function startKivaPoll(){
  if (kivaPoll) return;
  kivaPoll = setInterval(async function(){
    if (!kivaOpen){ clearInterval(kivaPoll); kivaPoll = null; return; }
    try {
      var d = await fetch('/api/kiva?since=' + kivaLastId, { headers: hdrs() }).then(r => r.json());
      var rows = d.messages || [];
      var feed = el('kivaFeed');
      for (var i = 0; i < rows.length; i++){
        var m = rows[i];
        if (m.id > kivaLastId){
          kivaLastId = m.id;
          if (feed){
            feed.insertAdjacentHTML('beforeend', kivaMsgHtml(m));
            feed.scrollTop = feed.scrollHeight;
          }
        }
      }
    } catch(e){}
  }, 6000);
}

window.sendKiva = async function(){
  var inp = el('kivaInput'); if (!inp) return;
  var body = inp.value.trim(); if (!body) return;
  inp.value = '';
  try {
    await fetch('/api/kiva', { method:'POST', headers: hdrs(true), body: JSON.stringify({ body: body }) });
    if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
  } catch(e){
    toast(e.message, true);
    inp.value = body;
  }
};
window.pinKiva = async function(id){
  try {
    await fetch('/api/kiva/pin', { method:'POST', headers: hdrs(true), body: JSON.stringify({ id: Number(id), pinned: true }) });
    toast('Pinned');
  } catch(e){ toast(e.message, true); }
};

/* =====================================================================
   Trial minigames
===================================================================== */

/* ---------- STOKE ---------- */
window.openStokeSheet = function(trial){
  var LOGS = 4;
  window.sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Drag ' + LOGS + ' logs into the fire</div>' +
    '<div class="stoke-wrap" id="stokeWrap">' +
      '<div class="stoke-logs" id="stokeLogs">' +
        Array.from({ length: LOGS }).map(function(_, i){
          return '<div class="stoke-log" data-log="' + i + '">' +
            '<svg viewBox="0 0 40 16" width="54" height="22">' +
              '<rect x="2" y="4" width="36" height="8" rx="4" fill="#6b4326"/>' +
              '<rect x="2" y="4" width="36" height="3" rx="1.5" fill="#8a5a1c"/>' +
            '</svg>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="stoke-fire" id="stokeFire">' +
        '<div class="stoke-pit"></div>' +
        '<div class="stoke-flame" id="stokeFlame"></div>' +
      '</div>' +
      '<div class="stoke-progress" id="stokeProgress">0 / ' + LOGS + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(function(){ attachStoke(trial); }, 30);
};

var stokeCount = 0;
function attachStoke(trial){
  stokeCount = 0;
  var fire = el('stokeFire');
  var progress = el('stokeProgress');
  var wrap = el('stokeWrap');
  if (!fire || !wrap) return;
  var total = 4;

  document.querySelectorAll('.stoke-log').forEach(function(log){
    var dragging = false, sx = 0, sy = 0, ox = 0, oy = 0, lastX = 0, lastY = 0;

    var onDown = function(e){
      if (log.dataset.used) return;
      dragging = true;
      var p = e.touches ? e.touches[0] : e;
      sx = p.clientX; sy = p.clientY;
      lastX = sx; lastY = sy;
      var r = log.getBoundingClientRect();
      ox = r.left; oy = r.top;
      log.style.position = 'fixed';
      log.style.left = ox + 'px';
      log.style.top = oy + 'px';
      log.style.width = r.width + 'px';
      log.style.height = r.height + 'px';
      log.style.zIndex = 9999;
      log.style.pointerEvents = 'none';
      log.classList.add('dragging');
      if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
      e.preventDefault();
    };
    var onMove = function(e){
      if (!dragging) return;
      var p = e.touches ? e.touches[0] : e;
      var dx = p.clientX - sx, dy = p.clientY - sy;
      var vx = p.clientX - lastX;
      lastX = p.clientX; lastY = p.clientY;
      var tilt = Math.max(-20, Math.min(20, vx * 0.6));
      log.style.left = (ox + dx) + 'px';
      log.style.top = (oy + dy) + 'px';
      log.style.transform = 'rotate(' + tilt + 'deg) scale(1.08)';
      var fr = fire.getBoundingClientRect();
      var inFire = p.clientX > fr.left && p.clientX < fr.right && p.clientY > fr.top && p.clientY < fr.bottom;
      fire.classList.toggle('over', inFire);
      e.preventDefault();
    };
    var onUp = function(e){
      if (!dragging) return;
      dragging = false;
      var p = e.changedTouches ? e.changedTouches[0] : e;
      var fr = fire.getBoundingClientRect();
      var inFire = p.clientX > fr.left - 20 && p.clientX < fr.right + 20 &&
                   p.clientY > fr.top - 20 && p.clientY < fr.bottom + 20;
      log.classList.remove('dragging');
      fire.classList.remove('over');
      if (inFire){
        log.style.transition = 'all .35s cubic-bezier(.2,.9,.2,1)';
        log.style.left = (fr.left + fr.width/2 - log.offsetWidth/2) + 'px';
        log.style.top = (fr.top + fr.height/2) + 'px';
        log.style.transform = 'rotate(20deg) scale(.4)';
        log.style.opacity = '0';
        log.dataset.used = '1';
        setTimeout(function(){
          stokeCount++;
          var flame = el('stokeFlame');
          if (flame) flame.setAttribute('data-logs', String(stokeCount));
          if (window.burstAt) window.burstAt(fire, 16);
          if (wrap){
            wrap.classList.remove('screen-shake');
            void wrap.offsetWidth;
            wrap.classList.add('screen-shake');
          }
          if (progress) progress.textContent = stokeCount + ' / ' + total;
          if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('medium');
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
  var wrap = el('stokeWrap');
  if (wrap) wrap.classList.add('camera-push');
  await new Promise(function(r){ setTimeout(r, 400); });
  try {
    var r = await fetch('/api/trials/' + encodeURIComponent(trial.slug), { method:'POST', headers: hdrs(true) }).then(x => x.json());
    if (!r.ok){ toast('Not ready', true); return; }
    var amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                 (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    window.closeSheet();
    window.rewardSequence({ icon:'home-fire', title:'Fire stoked!', amount: amount }, function(){ window.refresh(); });
  } catch(e){ toast(e.message, true); }
}

/* ---------- FEED ---------- */
window.openFeedSheet = function(trial){
  var BITES = 3;
  window.sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Hold the bowl to feed</div>' +
    '<div class="feed-wrap">' +
      '<div class="feed-bowl" id="feedBowl">' +
        '<div class="feed-fill" id="feedFill"></div>' +
        '<div class="feed-steam" id="feedSteam"></div>' +
        '<div class="feed-bowl-ico">' + iconSpan('res-ember','',48) + '</div>' +
      '</div>' +
      '<div class="feed-bites" id="feedBites">' +
        Array.from({ length: BITES }).map(function(_, i){ return '<span class="fb" data-i="' + i + '">' + iconSpan('res-ember','',20) + '</span>'; }).join('') +
      '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(function(){ attachFeed(trial); }, 30);
};
var feedRAF = null, feedStart = 0, feedBites = 0, feedDone = false;
function attachFeed(trial){
  var bowl = el('feedBowl'); if (!bowl) return;
  var fill = el('feedFill');
  var bites = document.querySelectorAll('#feedBites .fb');
  feedBites = 0; feedDone = false;
  var BITE_MS = 800;

  var down = function(e){
    if (feedDone) return;
    feedStart = performance.now();
    bowl.classList.add('holding');
    if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
    var paint = function(){
      if (feedDone) return;
      var elapsed = performance.now() - feedStart;
      var pct = Math.min(100, (elapsed / BITE_MS) * 100);
      if (fill) fill.style.height = pct + '%';
      if (pct >= 100){
        feedBites++;
        if (bites[feedBites - 1]) bites[feedBites - 1].classList.add('on');
        if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('medium');
        if (fill) fill.style.height = '0%';
        if (window.burstAt) window.burstAt(bowl, 8);
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
  var up = function(){
    if (feedRAF){ cancelAnimationFrame(feedRAF); feedRAF = null; }
    bowl.classList.remove('holding');
    if (fill) fill.style.height = '0%';
  };
  bowl.addEventListener('pointerdown', down);
  document.addEventListener('pointerup', up, { once:true });
  document.addEventListener('pointercancel', up, { once:true });
}
async function completeFeed(trial){
  await new Promise(function(r){ setTimeout(r, 400); });
  try {
    var r = await fetch('/api/trials/' + encodeURIComponent(trial.slug), { method:'POST', headers: hdrs(true) }).then(x => x.json());
    if (!r.ok){ toast('Not ready', true); return; }
    var amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                 (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    window.closeSheet();
    window.rewardSequence({ icon:'res-ember', title:'Kin fed!', amount: amount }, function(){ window.refresh(); });
  } catch(e){ toast(e.message, true); }
}

/* ---------- CRY ---------- */
window.openCryTapSheet = function(trial){
  var BEATS = 3;
  window.sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Tap the drum on the beat</div>' +
    '<div class="cry-wrap">' +
      '<div class="cry-pulse"><span class="cry-pulse-ring" id="cryPulse"></span></div>' +
      '<button class="cry-drum" id="cryDrum">' + iconSpan('kiva-flame','',48) + '</button>' +
      '<div class="cry-score" id="cryScore">0 / ' + BEATS + '</div>' +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
  setTimeout(function(){ attachCry(trial); }, 30);
};
var cryRAF = null, cryScore = 0, cryBeatOn = false;
function attachCry(trial){
  var drum = el('cryDrum'); if (!drum) return;
  var pulse = el('cryPulse');
  var scoreEl = el('cryScore');
  cryScore = 0;
  var BEATS = 3;
  var BEAT_MS = 900;
  var ON_WINDOW = 280;

  var cycleT = performance.now();
  var loop = function(){
    var now = performance.now();
    var phase = (now - cycleT) % BEAT_MS;
    var on = phase < ON_WINDOW;
    if (on !== cryBeatOn){
      cryBeatOn = on;
      if (pulse) pulse.classList.toggle('on', on);
    }
    cryRAF = requestAnimationFrame(loop);
  };
  cryRAF = requestAnimationFrame(loop);

  drum.addEventListener('pointerdown', function(e){
    e.preventDefault();
    if (cryScore >= BEATS) return;
    if (cryBeatOn){
      cryScore++;
      if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('medium');
      if (window.burstAt) window.burstAt(drum, 10);
      drum.classList.remove('hit');
      void drum.offsetWidth;
      drum.classList.add('hit');
      if (scoreEl) scoreEl.textContent = cryScore + ' / ' + BEATS;
      if (cryScore >= BEATS) completeCry(trial);
    } else {
      if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
      cryScore = 0;
      if (scoreEl) scoreEl.textContent = '0 / ' + BEATS;
      drum.classList.remove('miss');
      void drum.offsetWidth;
      drum.classList.add('miss');
    }
  });
}
window.cleanupCry = function(){
  if (cryRAF){ cancelAnimationFrame(cryRAF); cryRAF = null; }
};
async function completeCry(trial){
  window.cleanupCry();
  await new Promise(function(r){ setTimeout(r, 300); });
  try {
    var r = await fetch('/api/trials/' + encodeURIComponent(trial.slug), { method:'POST', headers: hdrs(true) }).then(x => x.json());
    if (!r.ok){ toast('Not ready', true); return; }
    var amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                 (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
    window.closeSheet();
    window.rewardSequence({ icon:'kiva-flame', title:'Dawn Cry raised!', amount: amount }, function(){ window.refresh(); });
  } catch(e){ toast(e.message, true); }
}

/* ---------- SIFT ---------- */
window.openSiftSheet = function(trial){
  window.sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">Pick a pile. One hides an ember.</div>' +
    '<div class="sift-grid">' +
      Array.from({ length: 5 }).map(function(_, i){
        return '<button class="sift-pile" data-act="siftPick" data-val="' + i + '">' +
          '<span class="sift-dust"></span>' +
          '<span class="sift-ico">' + iconSpan('res-ash','',28) + '</span>' +
        '</button>';
      }).join('') +
    '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:10px">Cancel</button>'
  );
};
window.doSift = async function(btn, idx){
  var pile = btn.closest ? btn.closest('.sift-pile') : btn;
  if (!pile || pile.disabled) return;
  document.querySelectorAll('.sift-pile').forEach(function(p){ p.disabled = true; });
  try {
    var t = (window.S.trials || []).find(function(x){ return x.minigame === 'sift'; });
    if (!t){ toast('No sift trial available', true); return; }
    var r = await fetch('/api/trials/' + encodeURIComponent(t.slug), {
      method:'POST',
      headers: hdrs(true),
      body: JSON.stringify({ pick: Number(idx) }),
    }).then(x => x.json());

    pile.classList.add('sifting');
    await new Promise(function(res){ setTimeout(res, 800); });

    if (r.hit){
      pile.classList.add('hit');
      pile.querySelector('.sift-ico').innerHTML = iconSpan('res-ember','',28);
      if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('heavy');
      if (window.burstAt) window.burstAt(pile, 30);
      await new Promise(function(res){ setTimeout(res, 400); });
      var amount = (r.reward_ember ? '+' + fmt(r.reward_ember) + ' Ember' : '') +
                   (r.reward_loyalty ? ' +' + fmt(r.reward_loyalty) + ' Loyalty' : '');
      window.closeSheet();
      window.rewardSequence({ icon:'res-ember', title:'Ember found!', amount: amount }, function(){ window.refresh(); });
    } else {
      pile.classList.add('miss');
      pile.querySelector('.sift-ico').innerHTML = iconSpan('res-ash','',28);
      if (TG && TG.HapticFeedback) TG.HapticFeedback.impactOccurred('light');
      var correct = document.querySelectorAll('.sift-pile')[r.correct];
      if (correct){
        correct.classList.add('reveal');
        correct.querySelector('.sift-ico').innerHTML = iconSpan('res-ember','',28);
      }
      await new Promise(function(res){ setTimeout(res, 1100); });
      window.closeSheet();
      toast('The ash was cold — try again', true);
      window.refresh();
    }
  } catch(e){ toast(e.message, true); }
};

/* ---------- AD ---------- */
window.openAdSheet = function(trial){
  window.sheet(
    '<h3>' + esc(trial.name) + '</h3>' +
    '<div class="sub">' + esc(trial.hint || 'Watch a short ad to claim.') + '</div>' +
    '<div class="ad-placeholder"><div class="ad-ico">' + iconSpan('play','',40) + '</div>' +
    '<p class="tiny" style="margin:8px 0 0">Rewarded ads are coming soon.</p></div>' +
    '<button class="btn btn-stone btn-block" disabled style="margin-top:14px">Watch ad — coming soon</button>' +
    '<button class="btn btn-ghost btn-block" data-act="closeSheet" style="margin-top:8px">Close</button>'
  );
};

/* =====================================================================
   In-app Warden
===================================================================== */
adminApi('/whoami').then(function(){ buildWarden(); }).catch(function(){});

function buildWarden(){
  var fab = document.createElement('button');
  fab.className = 'w-fab warden';
  fab.innerHTML = iconSpan('settings-gear','',22);
  document.body.appendChild(fab);

  var ov = document.createElement('div');
  ov.className = 'w-overlay'; ov.id = 'wOverlay';
  var tabs = [
    ['overview','Overview'],
    ['trials','Trials'],
    ['economy','Economy'],
    ['codes','Codes'],
    ['xquests','X Quests'],
    ['feed','Feed'],
    ['control','Control'],
    ['danger','Danger'],
  ];
  ov.innerHTML =
    '<div class="w-top"><b>Warden</b><button class="w-x" id="wClose">×</button></div>' +
    '<div class="w-search"><input id="wSearch" placeholder="Filter…"></div>' +
    '<div class="w-tabs">' + tabs.map(function(t, i){
      return '<button class="w-tab' + (i ? '' : ' active') + '" data-wt="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>' +
    '<div class="w-body" id="wBody"></div>';
  document.body.appendChild(ov);
  if (window.hydrateIcons) window.hydrateIcons();

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
    body.innerHTML = '<div style="padding:20px;text-align:center;color:#9a8d7e">Loading…</div>';
    (TABFNS[name] || TABFNS.overview)(body);
  }

  var TABFNS = {
    overview: function(body){
      adminApi('/stats').then(function(s){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Live</h3>';
        [
          ['Players', fmt(s.users.n) + ' (' + s.users.banned + ' banned)'],
          ['Ember', fmt(s.users.ember)],
          ['Tribes', fmt(s.tribes.n)],
          ['Wars', s.wars.active + ' active / ' + s.wars.total + ' total'],
          ['Maintenance', s.maintenance ? 'ON' : 'off'],
        ].forEach(function(row){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>' + row[0] + '</b></div><span class="val">' + row[1] + '</span>';
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
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
            if ((t.minigame || 'hold') === m) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener('change', function(){
            act('/trial/minigame', { slug: t.slug, minigame: sel.value }, t.slug + ' → ' + sel.value);
          });
          r.innerHTML = '<div class="lbl"><b>' + esc(t.name) + '</b><span>+' + fmt(t.reward_ember) + 'E</span></div>';
          r.appendChild(sel);
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
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
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
    },
    codes: function(body){
      adminApi('/codes').then(function(list){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Gift Codes (' + list.length + ')</h3>';
        list.slice(0, 30).forEach(function(c){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>' + esc(c.code) + '</b><span>' + fmt(c.amount) + ' ' + esc(c.kind) +
            ' · used ' + c.uses + (c.max_uses ? '/' + c.max_uses : '') + '</span></div>';
          var del = document.createElement('button');
          del.className = 'w-btn danger'; del.textContent = 'Delete';
          del.addEventListener('click', function(){
            act('/codes/delete', { code: c.code }, 'Deleted').then(function(){ TABFNS.codes(body); });
          });
          r.appendChild(del);
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
    },
    xquests: function(body){
      adminApi('/x-claims?status=pending').then(function(list){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Pending X Claims (' + list.length + ')</h3>';
        if (!list.length){
          g.innerHTML += '<div style="padding:16px;text-align:center;color:#9a8d7e">No pending claims.</div>';
        }
        list.forEach(function(c){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>@' + esc(c.x_handle) + '</b><span>' + esc(c.quest_title) +
            ' · ' + esc(c.first_name || c.username || c.user_id) + ' · ' + fmt(c.quest_reward_ember) + 'E</span></div>';
          var ap = document.createElement('button'); ap.className = 'w-btn'; ap.textContent = 'Approve';
          ap.addEventListener('click', function(){
            act('/x-claims/approve', { id: c.id }, 'Approved').then(function(){ TABFNS.xquests(body); });
          });
          var rj = document.createElement('button'); rj.className = 'w-btn danger'; rj.textContent = 'Reject';
          rj.style.marginLeft = '6px';
          rj.addEventListener('click', function(){
            var reason = prompt('Reason for rejection:');
            if (!reason) return;
            act('/x-claims/reject', { id: c.id, reason: reason }, 'Rejected').then(function(){ TABFNS.xquests(body); });
          });
          r.appendChild(ap); r.appendChild(rj);
          g.appendChild(r);
        });
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
    },
    feed: function(body){
      adminApi('/feed?limit=30').then(function(list){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.innerHTML = '<h3>Recent Activity</h3>';
        list.slice(0, 30).forEach(function(ev){
          var r = document.createElement('div'); r.className = 'w-row';
          r.innerHTML = '<div class="lbl"><b>' + esc(ev.text) + '</b><span>' + esc(ev.type) + ' · ' + new Date(ev.ts).toLocaleTimeString() + '</span></div>';
          g.appendChild(r);
        });
        if (!list.length){
          g.innerHTML += '<div style="padding:16px;text-align:center;color:#9a8d7e">No activity yet.</div>';
        }
        body.appendChild(g);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
    },
    control: function(body){
      body.innerHTML = '';
      var g = document.createElement('div'); g.className = 'w-group';
      g.innerHTML = '<h3>Maintenance</h3>';
      var en = document.createElement('button'); en.className = 'w-btn danger'; en.textContent = 'Enable';
      en.addEventListener('click', function(){ act('/maintenance', { on:'on' }, 'Maintenance ON'); });
      var off = document.createElement('button'); off.className = 'w-btn'; off.textContent = 'Disable';
      off.style.marginLeft = '8px';
      off.addEventListener('click', function(){ act('/maintenance', { on:'off' }, 'Maintenance off'); });
      g.appendChild(en); g.appendChild(off);
      body.appendChild(g);
    },
    danger: function(body){
      adminApi('/reset/preview', { method:'POST' }).then(function(p){
        body.innerHTML = '';
        var g = document.createElement('div'); g.className = 'w-group';
        g.style.borderColor = 'rgba(192,57,43,.5)';
        g.innerHTML = '<h3 style="color:#ff8a8a">Progression Reset</h3>' +
          '<p style="font-size:12px;color:#e7c8c3;margin:0 0 10px">' + p.usersWithProgress +
          ' users, ' + p.tribes + ' tribes, ' + p.activeWars + ' active wars affected.</p>';
        var b = document.createElement('button'); b.className = 'w-btn danger'; b.textContent = 'Reset Progression';
        b.addEventListener('click', function(){
          var w = prompt('Type RESET to confirm progression wipe');
          if ((w || '').toUpperCase() !== 'RESET') return;
          act('/reset/progression', {}, 'Progression reset started…').then(function(){ toast('Reset complete'); });
        });
        g.appendChild(b);
        body.appendChild(g);

        var g2 = document.createElement('div'); g2.className = 'w-group';
        g2.style.borderColor = 'rgba(192,57,43,.5)';
        g2.innerHTML = '<h3 style="color:#ff8a8a">Factory Reset</h3>' +
          '<p style="font-size:12px;color:#e7c8c3;margin:0 0 10px">Deletes everything except user accounts.</p>';
        var b2 = document.createElement('button'); b2.className = 'w-btn danger'; b2.textContent = 'Factory Reset';
        b2.addEventListener('click', function(){
          var w = prompt('Type FACTORY to confirm full reset');
          if ((w || '').toUpperCase() !== 'FACTORY') return;
          act('/reset/factory', {}, 'Factory reset started…').then(function(){ toast('Reset complete'); });
        });
        g2.appendChild(b2);
        body.appendChild(g2);
      }).catch(function(e){ body.innerHTML = '<div style="color:#9a8d7e;padding:16px">' + esc(e.message) + '</div>'; });
    },
  };
}
})();