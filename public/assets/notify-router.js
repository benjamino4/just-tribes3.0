/* =====================================================================
   TRIBES 3.0 - notification router
   Routes every legacy toast() call through the Dynamic Island (notify)
   and gives each notification type a UNIQUE look, icon and entrance.
   Signature types: claim / war / kiva  (plus good / warn / bad / info)
===================================================================== */
(function(){
  'use strict';
  if (window.__notifyRouter) return; window.__notifyRouter = true;

  /* --- bespoke animated icons (24x24, currentColor) --- */
  var SVG = {
    claim:
      '<svg viewBox="0 0 24 24" class="nfx nfx-claim" aria-hidden="true">'+
        '<path class="c-flame" d="M12 3c2.2 3.1-1 4.2 1 7.2 1 1.5.4 3-.7 4-1.4-.9-2.1-2.5-1.5-4.1C8.6 12 7.6 14.2 8.4 16.2c.7 1.7 2.2 2.9 3.6 2.9 2.5 0 4.2-2.1 4.2-4.6C16.2 10.3 14 6.6 12 3z"/>'+
        '<circle class="c-sp c-sp1" cx="6" cy="7" r="1"/><circle class="c-sp c-sp2" cx="18" cy="6" r="1"/><circle class="c-sp c-sp3" cx="19" cy="14" r="1"/>'+
      '</svg>',
    war:
      '<svg viewBox="0 0 24 24" class="nfx nfx-war" aria-hidden="true">'+
        '<g class="w-a"><path d="M3.5 4.5l9.5 9.5"/><path d="M13 14.5l2.5 2.5"/><path d="M3 4l2 .3.3 2"/></g>'+
        '<g class="w-b"><path d="M20.5 4.5L11 14"/><path d="M11 14.5L8.5 17"/><path d="M21 4l-2 .3-.3 2"/></g>'+
        '<circle class="w-clash" cx="12" cy="12.6" r="1.1"/>'+
      '</svg>',
    kiva:
      '<svg viewBox="0 0 24 24" class="nfx nfx-kiva" aria-hidden="true">'+
        '<path class="k-bubble" d="M4 6.2A2.2 2.2 0 016.2 4h11.6A2.2 2.2 0 0120 6.2v6.6a2.2 2.2 0 01-2.2 2.2H9.5L5.5 18v-3h.7A2.2 2.2 0 014 12.8z"/>'+
        '<path class="k-flame" d="M12 7.4c.9 1-.3 1.6.4 2.5.3.4 0 1-.4 1.2-.5-.3-.7-.9-.5-1.4-.5.4-.7 1-.4 1.6.2.4.6.7 1 .7.8 0 1.2-.7 1.2-1.4 0-1-.8-2-1.3-2.7z"/>'+
      '</svg>'
  };

  /* --- classify a legacy toast into a flavour --- */
  function classify(msg, kind){
    var m = (msg || '').toLowerCase();
    if (/\bwar\b|chant|declared|battle|raid|rival|attack/.test(m))
      return { flavor:'war',   title:'War!',           severity:'danger',  svg:SVG.war,   duration:4600 };
    if (/claim|blessing|daily|gathered|\bash\b|streak|reward|loot/.test(m))
      return { flavor:'claim', title:'Reward Claimed',  severity:'success', svg:SVG.claim, duration:5200 };
    if (/kiva|pyre|donat|message|joined the fire|tribe is born|left the tribe|blessed/.test(m))
      return { flavor:'kiva',  title:'Kiva',            severity:'default', svg:SVG.kiva,  duration:4600 };
    // generic fallbacks by kind
    if (kind === 'good') return { flavor:'good', title:'Done',      severity:'success', duration:4000 };
    if (kind === 'warn') return { flavor:'warn', title:'Heads up',  severity:'warn',    duration:4200 };
    if (kind === 'bad')  return { flavor:'bad',  title:'Trouble',   severity:'danger',  duration:4600 };
    return { flavor:'info', title:'Notice', severity:'default', duration:4000 };
  }

  function sparkle(el){
    var wrap = document.createElement('div');
    wrap.className = 'nfx-sparks';
    for (var i = 0; i < 7; i++){
      var s = document.createElement('i');
      s.style.setProperty('--a', (Math.random()*360).toFixed(0) + 'deg');
      s.style.setProperty('--d', (28 + Math.random()*26).toFixed(0) + 'px');
      s.style.setProperty('--t', (Math.random()*140).toFixed(0) + 'ms');
      wrap.appendChild(s);
    }
    el.appendChild(wrap);
    setTimeout(function(){ wrap.remove(); }, 1100);
  }

  function decorate(handle, info){
    if (!handle || !handle.el) return;
    var el = handle.el;
    el.classList.add('flav-' + info.flavor);
    if (info.svg){
      var box = el.querySelector('.notify-ico');
      if (box) box.innerHTML = info.svg;
    }
    if (info.flavor === 'claim') sparkle(el);
  }

  var origToast = (typeof window.toast === 'function') ? window.toast : null;

  function routedToast(msg, kind, ico){
    if (typeof window.notify !== 'function'){
      if (origToast) return origToast(msg, kind, ico);
      return null;
    }
    var info = classify(msg, kind);
    var handle = window.notify({
      title: info.title,
      msg: msg,
      severity: info.severity,
      duration: info.duration,
      icon: 'bell'
    });
    decorate(handle, info);
    return handle;
  }

  window.toast = routedToast;   // reroute every existing toast(...) call
  window.tribesNotify = routedToast;
})();
