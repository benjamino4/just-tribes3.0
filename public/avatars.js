/* =====================================================================
   Avatar picker (player side).
   Adds an "Avatar" section to the Profile screen where the player can
   pick an animated (pulsing) SVG avatar. The chosen avatar also replaces
   the initial-letter bubble in the profile hero.

   Standalone: does NOT touch app.js. It watches #sc-profile and injects
   itself whenever the profile screen (re)renders. All avatar SVGs are
   sanitised server-side before storage, so rendering them is safe.
===================================================================== */
(function(){
  'use strict';

  function api(path, body, opts){
    if (typeof window.api === 'function') return window.api(path, body, opts);
    return Promise.reject(new Error('api unavailable'));
  }
  function toast(msg, kind){ if (typeof window.toast === 'function') window.toast(msg, kind); }
  function haptic(t){ if (typeof window.haptic === 'function') window.haptic(t); }
  function hydrate(){ if (typeof window.hydrateIcons === 'function') window.hydrateIcons(); }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>\"']/g, function(c){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c];
    });
  }

  /* ---------- styles ---------- */
  function injectStyles(){
    if (document.getElementById('x-avatars-css')) return;
    var css = [
      '@keyframes sv-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}',
      '.sv-animated{animation:sv-pulse 2.4s ease-in-out infinite;transform-origin:center}',
      '.sv-animated svg{display:block;width:100%;height:100%}',
      '.avatar-picker-section{margin:14px 0 4px}',
      '.avatar-picker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:12px;margin-top:10px}',
      '.avatar-opt{position:relative;aspect-ratio:1/1;border-radius:50%;overflow:hidden;cursor:pointer;',
        'background:radial-gradient(circle at 50% 40%,rgba(255,150,60,.18),rgba(0,0,0,.28));',
        'border:2px solid transparent;transition:border-color .2s,transform .15s;-webkit-tap-highlight-color:transparent}',
      '.avatar-opt:active{transform:scale(.94)}',
      '.avatar-opt svg{display:block;width:100%;height:100%}',
      '.avatar-opt.sel{border-color:var(--flame,#ff7a18);box-shadow:0 0 0 3px rgba(255,122,24,.25)}',
      '.avatar-opt.sel::after{content:"";position:absolute;right:4px;bottom:4px;width:18px;height:18px;border-radius:50%;',
        'background:var(--flame,#ff7a18);box-shadow:0 0 8px rgba(255,122,24,.8)}',
      '.avatar-empty-mini{padding:14px;text-align:center;color:var(--mut,#9a8f84);font-size:13px;',
        'border:1px dashed var(--line2,rgba(255,255,255,.12));border-radius:12px;margin-top:10px}',
      '.profile-avatar-xl.sv-animated{padding:0;overflow:hidden}',
      '.profile-avatar-xl.sv-animated svg{width:100%;height:100%}'
    ].join('');
    var st = document.createElement('style');
    st.id = 'x-avatars-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------- render ---------- */
  var busy = false;

  function applyHero(host, svg){
    var hero = host.querySelector('.profile-avatar-xl');
    if (!hero) return;
    if (svg){
      hero.classList.add('sv-animated');
      hero.innerHTML = svg;
    }
  }

  function buildSection(host, data){
    var list = (data && data.avatars) || [];
    var selected = data && data.selected;

    var section = document.createElement('div');
    section.className = 'avatar-picker-section';

    var head = document.createElement('div');
    head.className = 'section-head';
    head.innerHTML = '<b>Avatar</b><span class="muted">' + list.length + ' available</span>';
    section.appendChild(head);

    if (!list.length){
      var empty = document.createElement('div');
      empty.className = 'avatar-empty-mini';
      empty.textContent = 'No avatars available yet.';
      section.appendChild(empty);
    } else {
      var grid = document.createElement('div');
      grid.className = 'avatar-picker-grid';
      list.forEach(function(a){
        var opt = document.createElement('button');
        opt.type = 'button';
        opt.className = 'avatar-opt sv-animated' + (a.id === selected ? ' sel' : '');
        opt.setAttribute('aria-label', a.name || a.slug);
        opt.title = a.name || a.slug;
        opt.innerHTML = a.svg || '';
        opt.addEventListener('click', function(){
          if (busy || a.id === selected) return;
          busy = true;
          haptic('light');
          api('/avatar/select', { id: a.id }).then(function(res){
            selected = a.id;
            grid.querySelectorAll('.avatar-opt').forEach(function(el){ el.classList.remove('sel'); });
            opt.classList.add('sel');
            applyHero(host, (res && res.avatar && res.avatar.svg) || a.svg);
            toast('Avatar updated');
            if (typeof window.refresh === 'function') try { window.refresh(); } catch(e){}
          }).catch(function(e){
            toast(e.message || 'Could not set avatar', 'error');
          }).then(function(){ busy = false; });
        });
        grid.appendChild(opt);
      });
      section.appendChild(grid);

      // pulse the currently-selected avatar into the hero bubble
      var cur = list.filter(function(a){ return a.id === selected; })[0];
      if (cur) applyHero(host, cur.svg);
    }
    return section;
  }

  function enhance(host){
    if (!host) return;
    // profile not rendered yet, or our section already present
    if (!host.querySelector('.profile-hero')) return;
    if (host.querySelector('.avatar-picker-section')) return;

    // placeholder so we don't fire twice while the fetch is in flight
    var body = host.querySelector('.screen-body');
    if (!body) return;
    var marker = document.createElement('div');
    marker.className = 'avatar-picker-section';
    marker.setAttribute('data-loading', '1');
    // insert right after the hero
    var hero = host.querySelector('.profile-hero');
    if (hero && hero.nextSibling) body.insertBefore(marker, hero.nextSibling);
    else body.appendChild(marker);

    api('/avatars', undefined, { method: 'GET' }).then(function(data){
      var section = buildSection(host, data);
      if (marker.parentNode) marker.parentNode.replaceChild(section, marker);
      else body.appendChild(section);
      hydrate();
    }).catch(function(){
      if (marker.parentNode) marker.parentNode.removeChild(marker);
    });
  }

  function start(){
    var host = document.getElementById('sc-profile');
    if (!host){ setTimeout(start, 400); return; }
    injectStyles();
    try {
      var mo = new MutationObserver(function(){ enhance(host); });
      mo.observe(host, { childList: true });
    } catch(e){}
    enhance(host);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
