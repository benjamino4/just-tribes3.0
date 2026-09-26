/* =====================================================================
   TRIBES 3.0 - war-council.js
   Frontend for the War Council: War Might meter, Tribe Idol (live state),
   the Warband roster, the Muster vote, Charm loadout and active relics.
   Additive: injects a panel into the War screen, talks to /api/council/*,
   degrades silently if the backend migration has not run.
===================================================================== */
(function(){
  'use strict';
  if (window.__wc_init) return; window.__wc_init = true;

  var api = function(p, b, o){ return window.api ? window.api(p, b, o) : Promise.reject('no api'); };
  function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }
  function el(html){ var t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstElementChild; }
  function toast(title, msg, sev){ if (window.notify) window.notify({ title:title, msg:msg||'', severity:sev||'info' }); }

  var IDOL_ICON = { dormant:'\uD83D\uDDFF', blazing:'\uD83D\uDD25', cracking:'\u26A1', shattered:'\uD83D\uDC80' };
  var POS_LABEL = { chieftain:'Chieftain', warlord:'Warlord', shaman:'Shaman', warrior:'Warrior' };
  var RELIC_GLYPH = { combo:'\uD83D\uDCEF', slow:'\uD83D\uDEE1\uFE0F', revive:'\uD83D\uDD25', reveal:'\uD83C\uDF1E' };

  var state = null, busy = false;

  function pct(v){ return Math.max(0, Math.min(100, v)); }

  /* ---------------- render ---------------- */
  function render(box){
    if (!state || !state.available){
      var old = box.querySelector('#wcPanel'); if (old) old.remove();
      return;
    }
    if (!state.in_tribe) return;
    var panel = box.querySelector('#wcPanel');
    if (!panel){ panel = el('<div id="wcPanel" class="wc-panel"></div>'); box.appendChild(panel); }
    panel.innerHTML =
      sectionMight() + sectionIdol() + sectionWarband() + sectionMuster() + sectionCharms() + sectionRolesGuide() + sectionRelicGallery();
    wire(panel);
  }

  function sectionMight(){
    var m = state.might || {}; var t = m.total || 0;
    var wb = m.warband || 0, rb = Math.round((m.relicBonus||0)*100), ib = Math.round((m.idolBuff||0)*100);
    var mo = Math.round(((m.morale||1)-1)*100);
    return '<div class="wc-card wc-might">'+
      '<div class="wc-h">War Might'+ (m.mustered ? '' : ' <span class="wc-warn">no warband mustered</span>') +'</div>'+
      '<div class="wc-might-num">'+ t.toLocaleString() +'</div>'+
      '<div class="wc-might-bd">'+
        chip('Warband', wb) + chip('Relics', '+'+rb+'%') + chip('Idol', '+'+ib+'%') +
        chip('Morale', (mo>=0?'+':'')+mo+'%') +
      '</div></div>';
  }
  function chip(k,v){ return '<span class="wc-chip"><b>'+esc(v)+'</b><i>'+esc(k)+'</i></span>'; }

  function sectionIdol(){
    var idol = (state.might && state.might.idol) || null;
    if (!idol) return '';
    var st = idol.state || 'dormant';
    var fp = idol.forge_progress||0, fg = idol.forge_goal||1;
    return '<div class="wc-card wc-idol wc-idol-'+esc(st)+'">'+
      '<div class="wc-idol-face">'+ (IDOL_ICON[st]||IDOL_ICON.dormant) +'</div>'+
      '<div class="wc-idol-body">'+
        '<div class="wc-h">'+esc(idol.name||'Great Totem')+' <span class="wc-tier">T'+(idol.tier||1)+'</span></div>'+
        '<div class="wc-idol-state">'+esc(st)+' \u00b7 +'+Math.round((idol.buff_value||0)*100)+'% Might</div>'+
        '<div class="wc-forge-bar"><i style="width:'+pct(fp/fg*100)+'%"></i></div>'+
        '<div class="wc-forge-row"><span class="tiny">'+fp.toLocaleString()+' / '+fg.toLocaleString()+' Ember</span>'+
          '<button class="wc-btn wc-forge" data-forge="5000">Feed 5k</button></div>'+
      '</div></div>';
  }

  function sectionWarband(){
    var roles = state.roles || [];
    var body;
    if (!roles.length){
      body = '<div class="tiny wc-empty">No warband seated. Call a Muster to choose who fights.</div>';
    } else {
      body = '<div class="wc-roster">' + roles.map(function(r){
        return '<div class="wc-seat wc-'+esc(r.position)+'">'+
          '<span class="wc-seat-av">'+esc((r.name||'K').slice(0,1).toUpperCase())+'</span>'+
          '<span class="wc-seat-name">'+esc(r.name)+'</span>'+
          '<span class="wc-seat-pos">'+esc(POS_LABEL[r.position]||r.position)+'</span>'+
        '</div>';
      }).join('') + '</div>';
    }
    var lead = state.is_leader ?
      '<button class="wc-btn wc-primary" data-muster="open">Call a Muster</button>' : '';
    return '<div class="wc-card wc-warband"><div class="wc-h">The Warband <span class="tiny">'+
      roles.length+'/'+(state.slots_cap||3)+'</span></div>'+ body + lead +'</div>';
  }

  function sectionMuster(){
    var mu = state.muster;
    if (!mu) return '';
    var mine = (mu.my_votes||[]).map(function(v){ return Number(v.candidate_id); });
    var cands = (mu.candidates||[]).map(function(c){
      var voted = mine.indexOf(Number(c.id)) >= 0;
      var dis = c.eligible ? '' : ' disabled';
      return '<div class="wc-cand'+(voted?' voted':'')+(c.eligible?'':' inelig')+'">'+
        '<span class="wc-cand-name">'+esc(c.name)+'</span>'+
        '<span class="wc-cand-meta tiny">'+c.loyalty.toLocaleString()+' loy \\u00b7 '+c.streak+'d \\u00b7 '+c.votes+' \\u2b50</span>'+
        '<button class="wc-btn wc-vote" data-vote="'+c.id+'"'+dis+'>'+(voted?'Backed':(c.eligible?'Back':'Not ready'))+'</button>'+
      '</div>';
    }).join('');
    var close = state.is_leader ?
      '<button class="wc-btn wc-primary" data-muster="close">Seal the Muster</button>' : '';
    return '<div class="wc-card wc-muster"><div class="wc-h">The Muster <span class="tiny">back up to '+
      mu.slots+' kin</span></div><div class="wc-cands">'+cands+'</div>'+ close +'</div>';
  }

  function sectionCharms(){
    var charms = state.my_charms || [];
    if (!charms.length) return '';
    var lo = {}; (state.my_loadout||[]).forEach(function(s){ lo[Number(s.relic_id)] = true; });
    var passives = charms.filter(function(c){ return c.kind !== 'active'; });
    var actives  = charms.filter(function(c){ return c.kind === 'active'; });
    var loadHtml = passives.map(function(c){
      var on = !!lo[Number(c.id)];
      return '<button class="wc-charm rar-'+esc(c.rarity)+(on?' on':'')+'" data-charm="'+c.id+'">'+
        '<b>'+esc(c.name)+'</b><i class="tiny">+'+Math.round((c.buff_value||0)*100)+'% \\u00b7 '+esc(c.domain)+'</i>'+
      '</button>';
    }).join('');
    var actHtml = actives.map(function(c){
      return '<button class="wc-charm wc-active rar-'+esc(c.rarity)+'" data-fire="'+c.id+'">'+
        '<b>'+(RELIC_GLYPH[c.war_effect]||'\\u2694\\uFE0F')+' '+esc(c.name)+'</b>'+
        '<i class="tiny">'+esc(c.war_effect||'')+' \\u00b7 '+(c.cooldown_min||0)+'m cd</i>'+
      '</button>';
    }).join('');
    return '<div class="wc-card wc-charms"><div class="wc-h">Your Charms <span class="tiny">tap to equip (max 3)</span></div>'+
      '<div class="wc-charm-grid">'+loadHtml+'</div>'+
      (actHtml ? '<div class="wc-h2">War relics</div><div class="wc-charm-grid">'+actHtml+'</div>' : '')+
    '</div>';
  }

  /* ---------------- interactions ---------------- */
  function currentLoadout(){
    return (state.my_loadout||[]).map(function(s){ return Number(s.relic_id); }).filter(Boolean);
  }
  function act(fn){
    if (busy) return; busy = true;
    Promise.resolve().then(fn).catch(function(e){
      var msg = (e && e.message) || (e && e.data && e.data.error) || 'Try again';
      toast('The Council balks', msg, 'warning');
    }).then(function(){ busy = false; refresh(); });
  }
  function wire(panel){
    panel.querySelectorAll('[data-forge]').forEach(function(b){
      b.addEventListener('click', function(){ act(function(){
        return api('/council/idol/forge', { amount: Number(b.getAttribute('data-forge')) })
          .then(function(){ toast('The Idol drinks deep', 'Ember offered to the totem.', 'success'); });
      }); });
    });
    panel.querySelectorAll('[data-muster]').forEach(function(b){
      var k = b.getAttribute('data-muster');
      b.addEventListener('click', function(){ act(function(){
        return api('/council/muster/'+k, {}).then(function(){
          var t = k==='open' ? 'Muster called' : 'Muster sealed';
          var m = k==='open' ? 'Kin may now vote the warband.' : 'The warband is set.';
          toast(t, m, 'success');
        });
      }); });
    });
    panel.querySelectorAll('[data-vote]').forEach(function(b){
      b.addEventListener('click', function(){ act(function(){
        return api('/council/muster/vote', { candidateId: Number(b.getAttribute('data-vote')), position:'warrior' });
      }); });
    });
    panel.querySelectorAll('[data-charm]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = Number(b.getAttribute('data-charm'));
        var lo = currentLoadout(); var i = lo.indexOf(id);
        if (i >= 0){ lo.splice(i, 1); }
        else { if (lo.length >= 3){ toast('Loadout full','Unequip a charm first.','warning'); return; } lo.push(id); }
        act(function(){ return api('/council/loadout', { slots: lo }); });
      });
    });
    panel.querySelectorAll('[data-fire]').forEach(function(b){
      b.addEventListener('click', function(){ act(function(){
        return api('/council/relic/fire', { relicId: Number(b.getAttribute('data-fire')) }).then(function(r){
          if (r && r.ok){ toast((r.by||'A kin')+' invoked '+(r.name||'a relic'), 'Effect: '+(r.effect||'?'), 'success'); }
        });
      }); });
    });
  }

  /* ---------------- data ---------------- */
  function refresh(){
    return api('/council/state', undefined, { method:'GET' }).then(function(s){
      state = s || null;
      var box = document.querySelector('#sc-war #warBody') || document.querySelector('#sc-war');
      if (box){ render(box); }
    }).catch(function(){ /* silent: backend not ready */ });
  }

  /* ---------------- boot: watch the War screen ---------------- */
  function ensure(){
    var war = document.getElementById('sc-war');
    if (!war) return;
    var body = war.querySelector('#warBody') || war;
    if (!body.querySelector('.war-arena') && !body.querySelector('.screen-body')) return;
    if (body.querySelector('#wcPanel')) return;
    refresh();
  }
  function start(){
    var root = document.getElementById('app') || document.body;
    var mo = new MutationObserver(function(){
      if (mo._q) return; mo._q = true;
      requestAnimationFrame(function(){ mo._q = false; ensure(); });
    });
    mo.observe(root, { childList:true, subtree:true });
    ensure();
    setInterval(function(){ if (document.querySelector('#sc-war #wcPanel')){ refresh(); } }, 15000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  /* ---------------- Council roles visual guide ---------------- */
  var ROLE_GUIDE = [
    { key:'chieftain', glyph:'\uD83D\uDC51', name:'Chieftain', tag:'Leads the tribe',
      desc:'Calls the Muster, sets the war stance and forges the Tribe Idol. Their morale bonus lifts the whole warband.' },
    { key:'warlord', glyph:'\u2694\uFE0F', name:'Warlord', tag:'Commands the front',
      desc:'Fires active war relics and drives raids. Warlord actions carry the biggest War Might multiplier on offence.' },
    { key:'shaman', glyph:'\uD83D\uDD2E', name:'Shaman', tag:'Wards & revives',
      desc:'Masters defensive charms \u2014 wards that blunt the enemy surge and Ashfang revives that rebuild a broken front.' },
    { key:'warrior', glyph:'\uD83D\uDEE1\uFE0F', name:'Warrior', tag:'The warband',
      desc:'Every kin who musters in. Warriors stack loyalty and donations into War Might and share the post-war spoils.' }
  ];
  function sectionRolesGuide(){
    var cards = ROLE_GUIDE.map(function(r){
      return '<div class="wc-role-card wc-role-'+esc(r.key)+'">'+
        '<div class="wc-role-glyph">'+r.glyph+'</div>'+
        '<div class="wc-role-info"><div class="wc-role-top"><b>'+esc(r.name)+'</b><span>'+esc(r.tag)+'</span></div>'+
        '<p>'+esc(r.desc)+'</p></div></div>';
    }).join('');
    return '<details class="wc-card wc-collapse">'+
      '<summary><span class="wc-h">War Council roles</span><span class="tiny">how the council works</span></summary>'+
      '<div class="wc-role-grid">'+cards+'</div></details>';
  }

  /* ---------------- Relic gallery (shared card template) ---------------- */
  var RELIC_CACHE = null, RELIC_FETCHING = false;
  var DOMAIN_GLYPH2 = { fire:'\uD83D\uDD25', bone:'\uD83E\uDDB4', sun:'\u2600\uFE0F', moon:'\uD83C\uDF19', ash:'\u2604\uFE0F' };
  var RARS = ['common','rare','epic','legendary'];

  function relicArt(r){
    if (r.svg) return r.svg;
    var src = r.image_url || (r.icon_file ? ('/assets/relics/'+r.icon_file) : '');
    if (src) return '<img src="'+esc(src)+'" alt="" loading="lazy">';
    return '<span class="relic-card-glyph">'+(DOMAIN_GLYPH2[r.domain]||'\uD83C\uDFFA')+'</span>';
  }
  function relicCardHTML(r){
    var rarity = RARS.indexOf(String(r.rarity)) >= 0 ? r.rarity : 'common';
    var bv = Number(r.buff_value) || 0;
    var tags = '<span class="relic-tag dom-'+esc(r.domain||'fire')+'">'+(DOMAIN_GLYPH2[r.domain]||'')+' '+esc(r.domain||'fire')+'</span>'+
      '<span class="relic-tag">'+esc(r.kind||'passive')+'</span>'+
      (r.war_effect ? '<span class="relic-tag">'+esc(r.war_effect)+'</span>' : '');
    var stat = '<span>'+esc(r.buff_type||'none')+(bv?(' \u00b7 '+bv):'')+'</span>'+
      (Number(r.cooldown_min)>0 ? '<span>CD '+esc(r.cooldown_min)+'m</span>' : '')+
      (Number(r.price_stars)>0 ? '<span>\u2b50 '+esc(r.price_stars)+'</span>' : '');
    var owned = Number(r.owned)>0 ? '<span class="relic-owned">Owned \u00d7'+esc(r.owned)+'</span>' : '';
    return '<div class="relic-card rc-'+rarity+(Number(r.owned)>0?' rc-have':'')+'">'+
      '<div class="relic-card-art">'+relicArt(r)+owned+'</div>'+
      '<div class="relic-card-body">'+
        '<div class="relic-card-top"><span class="relic-card-name">'+esc(r.name||r.slug)+'</span>'+
        '<span class="relic-card-rar">'+esc(rarity)+'</span></div>'+
        '<div class="relic-card-tags">'+tags+'</div>'+
        (r.description?'<p class="relic-card-desc">'+esc(r.description)+'</p>':'')+
        '<div class="relic-card-stat">'+stat+'</div>'+
      '</div></div>';
  }
  function fillRelicGrid(){
    var g = document.querySelector('#wcRelicGrid');
    if (!g || !RELIC_CACHE) return;
    g.innerHTML = RELIC_CACHE.length ? RELIC_CACHE.map(relicCardHTML).join('') : '<p class="tiny">No relics yet.</p>';
  }
  function fetchRelicsOnce(){
    if (RELIC_CACHE){ setTimeout(fillRelicGrid, 0); return; }
    if (RELIC_FETCHING) return;
    RELIC_FETCHING = true;
    api('/relics', undefined, { method:'GET' }).then(function(res){
      RELIC_CACHE = (res && res.relics) || [];
      RELIC_FETCHING = false; fillRelicGrid();
    }).catch(function(){ RELIC_FETCHING = false; });
  }
  function sectionRelicGallery(){
    fetchRelicsOnce();
    var inner = RELIC_CACHE ? (RELIC_CACHE.length ? RELIC_CACHE.map(relicCardHTML).join('') : '<p class="tiny">No relics yet.</p>') : '<p class="tiny">Loading relics\u2026</p>';
    return '<details class="wc-card wc-collapse">'+
      '<summary><span class="wc-h">Relic codex</span><span class="tiny">every relic + what you hold</span></summary>'+
      '<div id="wcRelicGrid" class="relic-lib-grid">'+inner+'</div></details>';
  }
})();
