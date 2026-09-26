/* =====================================================================
   TRIBES 3.0 - ui-fx.js
   Progressive enhancement layer. Watches the Ranks + War screens and
   injects a podium and a live momentum bar. Fully re-entry guarded and
   read-only against the DOM that app.js renders. Never blocks the app.
===================================================================== */
(function(){
  'use strict';
  var esc = function(s){ var d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; };

  /* ---------------- Leaderboard podium ---------------- */
  function buildPodium(box){
    var body = box.querySelector('.screen-body');
    if (!body || body.querySelector('.lbx-podium')) return;      // guard
    var rows = body.querySelectorAll('.card');
    if (rows.length < 3) return;                                  // need a top 3
    var top = [];
    for (var i=0; i<3; i++){
      var r = rows[i];
      var nameEl = r.querySelector('.rk-name');
      var scEl   = r.querySelector('.rk-score');
      if (!nameEl || !scEl) return;
      var name = nameEl.textContent.replace(/\s*\u00b7\s*you\s*$/i,'').trim();
      top.push({ name:name, score:scEl.textContent.trim(), you:/\byou\b/i.test(nameEl.textContent) });
    }
    var crowns = ['\uD83D\uDC51','','']; // crown only for #1
    var html = '<div class="lbx-podium">';
    for (var p=0; p<3; p++){
      var rank = p+1, t = top[p];
      html += '<div class="lbx-col lbx-'+rank+'">'+
        (rank===1 ? '<div class="lbx-crown">'+crowns[0]+'</div>' : '')+
        '<div class="lbx-av">'+rank+'</div>'+
        '<div class="lbx-name">'+esc(t.name)+(t.you?' \u00b7 you':'')+'</div>'+
        '<div class="lbx-sc">'+esc(t.score)+'</div>'+
        '<div class="lbx-plinth">'+rank+'</div>'+
      '</div>';
    }
    html += '</div>';
    var title = body.querySelector('.screen-title');
    if (title) title.insertAdjacentHTML('afterend', html);
    else body.insertAdjacentHTML('afterbegin', html);
  }

  /* ---------------- War momentum + urgency ---------------- */
  function buildMomentum(box){
    var war = (window.S && window.S.war) || null;
    if (!war || !war.fronts || !war.fronts.length) return;
    var body = box.querySelector('#warBody') || box;
    var arena = body.querySelector('.war-arena');
    if (!arena || arena.querySelector('.wfx-momentum')) return;    // guard
    var mineA = war.mine === 'attacker';
    var mine = 0, foe = 0;
    war.fronts.forEach(function(f){
      var a = Number(f.attacker_score)||0, d = Number(f.defender_score)||0;
      mine += mineA ? a : d; foe += mineA ? d : a;
    });
    var tot = Math.max(1, mine + foe);
    var mp = Math.max(3, Math.min(97, mine/tot*100));
    var html = '<div class="wfx-momentum">'+
      '<div class="wfx-mrow"><span class="me">Your surge '+Math.round(mp)+'%</span>'+
      '<span class="foe">'+(100-Math.round(mp))+'% foe</span></div>'+
      '<div class="wfx-track"><i class="wfx-fill me" style="width:0%"></i>'+
      '<i class="wfx-fill foe" style="width:0%"></i></div></div>';
    arena.insertAdjacentHTML('beforeend', html);
    // animate on next frame
    requestAnimationFrame(function(){
      var f = arena.querySelectorAll('.wfx-fill');
      if (f[0]) f[0].style.width = mp + '%';
      if (f[1]) f[1].style.width = (100-mp) + '%';
    });
  }

  function watchCountdown(){
    var cd = document.getElementById('warCd');
    if (!cd) return;
    var arena = cd.closest('.war-arena');
    if (!arena) return;
    var txt = cd.textContent || '';
    // urgent when only seconds / <1 min shown (no 'h' and no 'm' with big value)
    var urgent = /resolving/i.test(txt) || (/^[0-9]{1,2}s$/i.test(txt.trim())) || (/\b0m\b/i.test(txt));
    arena.classList.toggle('war-urgent', !!urgent);
  }

  /* ---------------- Observers ---------------- */
  function scan(){
    var ranks = document.getElementById('sc-ranks');
    if (ranks && ranks.classList.contains('active') !== false) { try{ buildPodium(ranks); }catch(e){} }
    var war = document.getElementById('sc-war');
    if (war) { try{ buildMomentum(war); }catch(e){} }
    try{ watchCountdown(); }catch(e){}
  }

  function start(){
    scan();
    var root = document.getElementById('app') || document.body;
    var mo = new MutationObserver(function(){
      // debounce with rAF to avoid thrashing during renders
      if (mo._q) return; mo._q = true;
      requestAnimationFrame(function(){ mo._q = false; scan(); });
    });
    mo.observe(root, { childList:true, subtree:true });
    setInterval(watchCountdown, 1000); // keep urgency in sync with app ticker
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* =====================================================================
   TRIBES 3.0 - ui-fx nav layer
   (1) hard guard so only ONE .tabbar ever renders (kills the double bar)
   (2) a unique, self-animated icon for every tab section
   Runs independently of app.js; re-entry guarded via data flags.
===================================================================== */
(function(){
  'use strict';
  if (window.__navfx) return; window.__navfx = true;

  // --- unique animated icon per tab (24x24, currentColor) ---
  var ICONS = {
    fire:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-fire" aria-hidden="true">'+
        '<path class="ic-flame" d="M12 3c2.2 3.1-1 4.2 1 7.2 1 1.5.4 3-.7 4-1.4-.9-2.1-2.5-1.5-4.1C8.6 12 7.6 14.2 8.4 16.2c.7 1.7 2.2 2.9 3.6 2.9 2.5 0 4.2-2.1 4.2-4.6C16.2 10.3 14 6.6 12 3z"/>'+
        '<path class="ic-core" d="M12 12.6c.8.9-.3 1.6.4 2.6.3.5 0 1.1-.5 1.3-.6-.3-.9-1-.6-1.6-.6.5-.8 1.3-.3 2 .3.4.7.7 1.1.7.9 0 1.5-.8 1.5-1.7 0-1.2-.9-2.4-2.1-3.3z"/>'+
      '</svg>',
    war:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-war" aria-hidden="true">'+
        '<g class="ic-swA"><path d="M3.5 4.5l9.5 9.5"/><path d="M13 14.5l2.5 2.5"/><path d="M3 4l2 .3.3 2"/></g>'+
        '<g class="ic-swB"><path d="M20.5 4.5L11 14"/><path d="M11 14.5L8.5 17"/><path d="M21 4l-2 .3-.3 2"/></g>'+
        '<circle class="ic-clash" cx="12" cy="12.6" r="1.1"/>'+
      '</svg>',
    trials:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-trials" aria-hidden="true">'+
        '<rect class="ic-scroll" x="6" y="3.5" width="12" height="17" rx="2.4"/>'+
        '<path class="ic-ln ic-ln1" d="M9 8.5h6"/><path class="ic-ln ic-ln2" d="M9 12h6"/><path class="ic-ln ic-ln3" d="M9 15.5h4"/>'+
      '</svg>',
    ranks:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-ranks" aria-hidden="true">'+
        '<path class="ic-crown" d="M3.5 17l2.2-9.5 4.1 5.2L12 6l2.2 6.7 4.1-5.2L20.5 17z"/>'+
        '<path class="ic-base" d="M4 17.5h16"/>'+
        '<circle class="ic-gem" cx="12" cy="9.4" r="1.05"/>'+
        '<rect class="ic-shine" x="3" y="5" width="4" height="14"/>'+
      '</svg>',
    tribe:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-tribe" aria-hidden="true">'+
        '<path class="ic-shield" d="M12 3l7 2.6v5.2c0 5-3 8.1-7 10.2-4-2.1-7-5.2-7-10.2V5.6z"/>'+
        '<path class="ic-emb" d="M12 8.8c1 1.1-.4 1.8.4 2.9.3.5.1 1.1-.4 1.4-.6-.3-.8-1-.6-1.6-.6.4-.8 1.2-.4 1.9.3.5.7.8 1.1.8.9 0 1.4-.8 1.4-1.6 0-1.1-.9-2.2-2-3z"/>'+
      '</svg>',
    kiva:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-kiva" aria-hidden="true">'+
        '<path class="ic-bubble" d="M4 6.2A2.2 2.2 0 016.2 4h11.6A2.2 2.2 0 0120 6.2v6.6a2.2 2.2 0 01-2.2 2.2H9.5L5.5 18v-3h.7A2.2 2.2 0 014 12.8z"/>'+
        '<path class="ic-kflame" d="M12 7.4c.9 1-.3 1.6.4 2.5.3.4 0 1-.4 1.2-.5-.3-.7-.9-.5-1.4-.5.4-.7 1-.4 1.6.2.4.6.7 1 .7.8 0 1.2-.7 1.2-1.4 0-1-.8-2-1.3-2.7z"/>'+
      '</svg>',
    store:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-store" aria-hidden="true">'+
        '<path class="ic-bag" d="M6 8h12l-1.1 11.2a1 1 0 01-1 .8H8.1a1 1 0 01-1-.8z"/>'+
        '<path class="ic-handle" d="M9 8.4V6.6a3 3 0 016 0v1.8"/>'+
        '<circle class="ic-tag" cx="12" cy="13" r="1"/>'+
      '</svg>',
    profile:
      '<svg viewBox="0 0 24 24" class="tab-anim ta-profile" aria-hidden="true">'+
        '<circle class="ic-ring" cx="12" cy="12" r="9"/>'+
        '<circle class="ic-head" cx="12" cy="9.4" r="3.1"/>'+
        '<path class="ic-torso" d="M5.6 19.2c.5-3.3 3.2-5.4 6.4-5.4s5.9 2.1 6.4 5.4"/>'+
      '</svg>'
  };

  function killDoubleBars(){
    var bars = document.querySelectorAll('nav.tabbar, .tabbar');
    if (bars.length <= 1) return;
    // keep the last-rendered real nav (the one app.js populates), drop the rest
    var keep = null;
    for (var i = bars.length - 1; i >= 0; i--){
      if (bars[i].querySelector('.tab')){ keep = bars[i]; break; }
    }
    if (!keep) keep = bars[bars.length - 1];
    bars.forEach(function(b){ if (b !== keep) b.remove(); });
  }

  function enhanceNav(){
    killDoubleBars();
    var nav = document.querySelector('.tabbar');
    if (!nav) return;
    nav.querySelectorAll('.tab').forEach(function(tab){
      var id = tab.getAttribute('data-tab');
      var svg = ICONS[id];
      if (!svg) return;
      var box = tab.querySelector('.tab-icon');
      if (!box || box.getAttribute('data-fx') === id) return;
      box.setAttribute('data-fx', id);
      box.innerHTML = svg;
    });
  }

  function start(){
    enhanceNav();
    var root = document.getElementById('app') || document.body;
    var mo = new MutationObserver(function(){
      if (mo._q) return; mo._q = true;
      requestAnimationFrame(function(){ mo._q = false; enhanceNav(); });
    });
    mo.observe(root, { childList:true, subtree:true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
