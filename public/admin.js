/* =====================================================================
   TRIBES Warden Console — real two-column client.
===================================================================== */
(function(){
'use strict';

var KEY = 'tribes_admin_token';
var token = localStorage.getItem(KEY) || '';
var SSE = null;
var FEED_PAUSED = false;
var FEED_LAST_ID = 0;

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(n){return (Number(n)||0).toLocaleString('en-US');}
function $(s){return document.querySelector(s);}
function $$(s){return [...document.querySelectorAll(s)];}
function h(tag, props, kids){
  var el = document.createElement(tag);
  if (props){
    for (var k in props){
      if (k === 'class') el.className = props[k];
      else if (k === 'text') el.textContent = props[k];
      else if (k === 'html') el.innerHTML = props[k];
      else if (k === 'onclick') el.addEventListener('click', props[k]);
      else if (k === 'oninput') el.addEventListener('input', props[k]);
      else el.setAttribute(k, props[k]);
    }
  }
  if (kids){
    (Array.isArray(kids) ? kids : [kids]).forEach(function(c){
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
  }
  return el;
}
function iconSpan(name, cls, size){
  var parts = ['data-icon="' + name + '"'];
  if (cls) parts.push('data-icon-class="' + cls + '"');
  if (size) parts.push('data-icon-size="' + size + '"');
  return '<span ' + parts.join(' ') + '></span>';
}
function toast(msg, bad){
  var t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(t._t);
  t._t = setTimeout(function(){ t.className = 'toast'; }, 2400);
}
function api(path, opts){
  opts = opts || {};
  opts.headers = opts.headers || {};
  opts.headers['X-Admin-Token'] = token;
  if (opts.body){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(opts.body); }
  return fetch('/api/admin' + path, opts).then(function(r){
    return r.json().then(function(j){
      if (!r.ok || j.ok === false) throw new Error(j.error || ('HTTP ' + r.status));
      return j.data;
    });
  });
}
function act(path, body, msg){
  return api(path, { method:'POST', body: body || {} })
    .then(function(d){ if (msg) toast(msg); return d; })
    .catch(function(e){ toast(e.message, true); throw e; });
}

/* ---------- button press physics (delegated) ---------- */
document.addEventListener('pointerdown', function(e){
  var b = e.target.closest('.btn');
  if (!b) return;
  var r = b.getBoundingClientRect();
  b.style.setProperty('--rx', ((e.clientX - r.left) / r.width * 100) + '%');
  b.style.setProperty('--ry', ((e.clientY - r.top) / r.height * 100) + '%');
  b.classList.add('pressing');
});
document.addEventListener('pointerup', function(){ $$('.btn.pressing').forEach(function(b){ b.classList.remove('pressing'); }); });
document.addEventListener('pointercancel', function(){ $$('.btn.pressing').forEach(function(b){ b.classList.remove('pressing'); }); });

/* ---------- login ---------- */
function showConsole(){
  $('#login').hidden = true;
  $('#console').hidden = false;
  openSSE();
  renderNav();
  openPanel('overview');
}
function doLogin(){
  var t = $('#token').value.trim();
  if (!t) return;
  token = t;
  api('/stats').then(function(){
    localStorage.setItem(KEY, token);
    showConsole();
  }).catch(function(e){
    $('#loginErr').textContent = e.message === 'bad admin token' ? 'That token was rejected.' : e.message;
  });
}
$('#enterBtn').addEventListener('click', doLogin);
$('#token').addEventListener('keydown', function(e){ if (e.key === 'Enter') doLogin(); });
$('#logoutBtn').addEventListener('click', function(){
  localStorage.removeItem(KEY);
  if (SSE) try { SSE.close(); } catch(e){}
  location.reload();
});

/* ---------- SSE ---------- */
function openSSE(){
  setConn('connecting');
  try {
    SSE = new EventSource('/api/admin/stream?token=' + encodeURIComponent(token));
    SSE.onopen = function(){ setConn('on'); };
    SSE.onerror = function(){ setConn('off'); };
    SSE.onmessage = function(ev){
      try {
        var msg = JSON.parse(ev.data);
        if (msg.type === 'stats') renderLiveStats(msg);
        if (msg.type === 'audit') pushFeed({
          id: Date.now(),
          ts: new Date().toISOString(),
          type: 'audit',
          severity: /reset/i.test(msg.action||'') ? 'danger' : 'info',
          text: msg.action + ': ' + (msg.detail || ''),
        });
        if (msg.type === 'reset') toast('Reset complete: ' + msg.kind);
        if (msg.type === 'hello') setConn('on');
      } catch(e){}
    };
  } catch(e){ setConn('off'); }
}
function setConn(state){
  var el = $('#connState');
  if (!el) return;
  el.className = 'pill ' + (state === 'on' ? 'conn-on' : state === 'connecting' ? '' : 'conn-off');
  el.textContent = state === 'on' ? 'live' : state === 'connecting' ? 'connecting' : 'offline';
}
function renderLiveStats(s){
  var el = $('#liveStats');
  if (!el) return;
  el.className = 'pill stat-pill live';
  el.textContent = 'players ' + fmt(s.users && s.users.n || 0) + ' · wars ' + fmt(s.wars && s.wars.active || 0);
}

/* ---------- feed rail ---------- */
function pushFeed(evt){
  if (FEED_PAUSED) return;
  var list = $('#feedList');
  if (!list) return;
  var el = document.createElement('div');
  el.className = 'feed-item sev-' + (evt.severity || 'info');
  el.innerHTML =
    '<div class="fi-top"><span class="fi-type">' + esc(evt.type || 'log') + '</span>' +
    '<span class="fi-time">' + new Date(evt.ts).toLocaleTimeString() + '</span></div>' +
    '<div class="fi-text">' + esc(evt.text || '') + '</div>';
  list.insertBefore(el, list.firstChild);
  while (list.children.length > 200) list.removeChild(list.lastChild);
}
function loadFeedInitial(){
  api('/feed?limit=40').then(function(list){
    var host = $('#feedList');
    if (!host) return;
    host.innerHTML = '';
    list.slice().reverse().forEach(function(evt){
      pushFeed({ id: evt.id, ts: evt.ts, type: evt.type, severity: evt.severity, text: evt.text });
    });
  }).catch(function(){});
}
$('#feedPause').addEventListener('click', function(){
  FEED_PAUSED = !FEED_PAUSED;
  $('#feedPause').textContent = FEED_PAUSED ? 'Resume' : 'Pause';
});

/* ---------- nav ---------- */
var SECTIONS = [
  { id: 'overview',   label: 'Overview',      ico: 'admin-feed' },
  { id: 'players',    label: 'Players',       ico: 'admin-users' },
  { id: 'tribes',     label: 'Tribes',        ico: 'admin-tribes' },
  { id: 'wars',       label: 'Wars',          ico: 'admin-wars' },
  { id: 'payments',   label: 'Payments',      ico: 'admin-payments' },
  { id: 'wallets',    label: 'Wallets',       ico: 'admin-payments' },
  { id: 'codes',      label: 'Gift Codes',    ico: 'admin-codes' },
  { id: 'xquests',    label: 'X Quests',      ico: 'admin-quests' },
  { id: 'trials',     label: 'Trials',        ico: 'admin-trials' },
  { id: 'economy',    label: 'Economy',       ico: 'admin-economy' },
  { id: 'bonfires',   label: 'Bonfires',      ico: 'admin-bonfire' },
  { id: 'names',      label: 'Names Pool',    ico: 'admin-names' },
  { id: 'avatars',    label: 'Avatars',       ico: 'admin-names' },
  { id: 'relics',     label: 'Relics',        ico: 'admin-quests' },
  { id: 'control',    label: 'Control',       ico: 'admin-control' },
  { id: 'feed',       label: 'Feed',          ico: 'admin-feed' },
  { id: 'danger',     label: 'Danger Zone',   ico: 'admin-danger', danger: true },
];
function renderNav(){
  var tree = $('#navTree'); tree.innerHTML = '';
  SECTIONS.forEach(function(s){
    var btn = h('button', {
      class: 'nav-item' + (s.danger ? ' danger' : ''),
      'data-id': s.id,
      onclick: function(){ openPanel(s.id); }
    });
    btn.innerHTML = iconSpan(s.ico, '', 16) + '<span>' + s.label + '</span>';
    tree.appendChild(btn);
  });
  var search = $('#navSearch');
  search.oninput = function(){
    var q = search.value.toLowerCase();
    $$('#navTree .nav-item').forEach(function(b){
      var label = b.textContent.toLowerCase();
      b.style.display = (!q || label.indexOf(q) !== -1) ? '' : 'none';
    });
  };
}

function openPanel(id){
  $$('#navTree .nav-item').forEach(function(b){
    b.classList.toggle('active', b.getAttribute('data-id') === id);
  });
  var s = SECTIONS.find(function(x){ return x.id === id; }) || SECTIONS[0];
  $('#panelTitle').textContent = s.label;
  $('#panelSub').textContent = '';
  var panel = $('#panel');
  panel.innerHTML = '<div class="loading">Loading…</div>';
  (PANELS[id] || PANELS.overview)(panel);
}

/* ---------- widgets ---------- */
function widget(label, hint, control, key, opts){
  var row = h('div', { class: 'wrow' });
  var l = h('div', { class: 'wlbl' });
  l.innerHTML = '<b>' + esc(label) + '</b>' + (hint ? '<span>' + esc(hint) + '</span>' : '');
  row.appendChild(l);

  var ctl = h('div', { class: 'wctl' });
  ctl.appendChild(control);
  if (key){
    var saved = h('span', { class: 'saved' }, '✓');
    saved.setAttribute('data-saved', key);
    ctl.appendChild(saved);
    if (opts && opts.default !== undefined){
      ctl.appendChild(h('button', {
        class: 'wreset', title: 'Reset to default', text: '↺',
        onclick: function(){ saveCfg(key, opts.default); }
      }));
    }
  }
  row.appendChild(ctl);
  return row;
}
function slider(label, hint, key, value, min, max, step, opts){
  var stp = step || 1;
  var inp = h('input', { type: 'range', min: min, max: max, step: stp, value: value });
  // Editable typed number so admins can enter exact values (incl. beyond the
  // slider's max) instead of only dragging.
  var num = h('input', { type: 'number', class: 'wnum', min: min, step: stp, value: value });
  function commit(v){
    var n = Number(v);
    if (!isFinite(n)) return;
    if (n < min) n = min;
    // keep the range thumb in bounds but allow the number to exceed max
    inp.value = Math.min(Number(max), n);
    num.value = n;
    saveCfg(key, n);
  }
  inp.addEventListener('input', function(){ num.value = inp.value; });
  inp.addEventListener('change', function(){ commit(inp.value); });
  num.addEventListener('change', function(){ commit(num.value); });
  var ctl = h('div', { class: 'wslider' }, [inp, num]);
  return widget(label, hint, ctl, key, Object.assign({}, opts, { default: value }));
}
function toggle(label, hint, key, value){
  var t = h('div', { class: 'wtog' + (Number(value) ? ' on' : '') });
  t.addEventListener('click', function(){
    var on = !t.classList.contains('on');
    t.classList.toggle('on', on);
    saveCfg(key, on ? 1 : 0);
  });
  return widget(label, hint, t, key);
}
function stepper(label, hint, key, value, min, max, step){
  var v = h('span', { class: 'v' }, String(value));
  var minus = h('button', { text: '−', onclick: function(){
    var n = Math.max(min, Number(v.textContent) - (step || 1));
    v.textContent = String(n); saveCfg(key, n);
  }});
  var plus = h('button', { text: '+', onclick: function(){
    var n = Math.min(max, Number(v.textContent) + (step || 1));
    v.textContent = String(n); saveCfg(key, n);
  }});
  var ctl = h('div', { class: 'wstep' }, [minus, v, plus]);
  return widget(label, hint, ctl, key);
}
function seg(label, hint, key, value, options){
  var ctl = h('div', { class: 'wseg' });
  options.forEach(function(o){
    var b = h('button', { text: o.label, class: o.value === value ? 'active' : '' });
    b.addEventListener('click', function(){
      $$('.wseg button', ctl).forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
      saveCfg(key, o.value);
    });
    ctl.appendChild(b);
  });
  return widget(label, hint, ctl, key);
}
function textRow(label, hint, key, value){
  var inp = h('input', { class: 'winput', value: value || '' });
  inp.addEventListener('change', function(){ saveCfg(key, inp.value); });
  return widget(label, hint, inp, key);
}

function saveCfg(key, value){
  var saved = $$('[data-saved="' + key + '"]')[0];
  if (saved){ saved.className = 'saved show'; saved.textContent = 'saving…'; }
  api('/econ', { method: 'POST', body: { key: key, value: value } }).then(function(){
    if (saved){ saved.className = 'saved show'; saved.textContent = '✓ Saved'; }
  }).catch(function(e){
    if (saved){ saved.className = 'saved err'; saved.textContent = '✕ Failed'; }
  });
}

/* ---------- panels ---------- */
var PANELS = {};

PANELS.overview = function(panel){
  api('/stats').then(function(s){
    panel.innerHTML = '';
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Live</h3>';
    var grid = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px' });
    [
      ['Players', s.users.n, s.users.banned + ' banned'],
      ['Ember', fmt(s.users.ember), ''],
      ['Tribes', s.tribes.n, 'Pyre ' + fmt(s.tribes.pyre)],
      ['Wars', s.wars.active, s.wars.total + ' all-time'],
      ['Stars tx', fmt(s.payments.starTx || 0), fmt(s.payments.stars) + ' Stars'],
    ].forEach(function(row){
      var box = h('div', { style: 'padding:12px;background:rgba(0,0,0,.25);border-radius:12px;border:1px solid var(--line)' });
      box.innerHTML = '<div style="font-size:11px;color:var(--mut);text-transform:uppercase;letter-spacing:.06em">' + esc(row[0]) + '</div>' +
        '<div style="font-size:22px;font-weight:800;color:var(--gold);margin-top:2px">' + esc(String(row[1])) + '</div>' +
        '<div style="font-size:11px;color:var(--mut)">' + esc(String(row[2])) + '</div>';
      grid.appendChild(box);
    });
    g.appendChild(grid);
    panel.appendChild(g);
    $('#panelSub').textContent = 'Live stats — SSE stream';
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

PANELS.players = function(panel){
  panel.innerHTML = '<div class="wgroup"><h3>Search players</h3>' +
    '<div class="wrow"><input id="pSearch" class="winput" style="flex:1;max-width:none" placeholder="name, @user or id">' +
    '<button id="pGo" class="btn tiny">Search</button></div><div id="pList"></div></div>';
  $('#pGo').addEventListener('click', doSearch);
  $('#pSearch').addEventListener('keydown', function(e){ if (e.key === 'Enter') doSearch(); });
  function doSearch(){
    var q = $('#pSearch').value.trim();
    api('/players?q=' + encodeURIComponent(q)).then(function(rows){
      var host = $('#pList'); host.innerHTML = '';
      rows.forEach(function(r){
        var row = h('div', { class: 'wlist-row' });
        row.innerHTML = '<div class="wl-body"><b>' + esc(r.first_name || '') +
          ' <span style="color:var(--mut)">@' + esc(r.username || '?') + '</span></b>' +
          '<span>#' + esc(r.id) + ' · ' + esc(r.role) + ' · ' + fmt(r.ember) + 'E · ' + fmt(r.loyalty) + 'L' +
          (r.banned ? ' · BANNED' : '') + '</span></div>';
        host.appendChild(row);
      });
    }).catch(function(e){ toast(e.message, true); });
  }
};

PANELS.tribes = function(panel){
  panel.innerHTML = '';
  api('/tribes').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Tribes (' + list.length + ')</h3>';
    list.forEach(function(t){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-ico">' + iconSpan('tribe-shield', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(t.name) + '</b>' +
        '<span>#' + esc(t.id) + ' · ' + fmt(t.members) + ' kin · ' + fmt(t.loyalty_total) + 'L · Pyre ' + fmt(t.treasury) +
        ' · ' + esc(t.wins) + 'W/' + esc(t.losses) + 'L</span></div>';
      g.appendChild(r);
    });
    panel.appendChild(g);
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

PANELS.wars = function(panel){
  panel.innerHTML = '';
  api('/wars').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Active Wars (' + list.length + ')</h3>';
    if (!list.length) g.innerHTML += '<p class="muted" style="padding:12px 0">No active wars.</p>';
    list.forEach(function(w){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-ico">' + iconSpan('war-swords', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(w.a_name) + ' vs ' + esc(w.d_name) + '</b>' +
        '<span>#' + esc(w.id) + ' · ' + esc(w.challenge_id) + ' · stance ' + esc(w.stance || '-') + '</span></div>';
      var cancel = h('button', { class: 'btn tiny danger', text: 'Cancel' });
      cancel.addEventListener('click', function(){
        if (confirm('Cancel war #' + w.id + '?')) act('/war/cancel', { id: w.id }, 'Cancelled').then(function(){ PANELS.wars(panel); });
      });
      r.appendChild(cancel);
      g.appendChild(r);
    });
    panel.appendChild(g);
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

PANELS.payments = function(panel){
  panel.innerHTML = '';
  api('/payments').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Recent payments</h3>';
    if (!list.length) g.innerHTML += '<p class="muted" style="padding:12px 0">No payments yet.</p>';
    list.slice(0, 40).forEach(function(p){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-ico">' + iconSpan('admin-payments', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(p.kind) + ' ' + fmt(p.amount) + (p.currency === 'XTR' ? ' Stars' : '') + '</b>' +
        '<span>user ' + esc(p.user_id) + ' · ' + esc(p.status) + (p.refunded ? ' (refunded)' : '') + '</span></div>';
      if (!p.refunded){
        var rf = h('button', { class: 'btn tiny danger', text: 'Refund' });
        rf.addEventListener('click', function(){
          if (confirm('Refund this payment?')) act('/refund', { chargeId: p.charge_id }, 'Refunded').then(function(){ PANELS.payments(panel); });
        });
        r.appendChild(rf);
      }
      g.appendChild(r);
    });
    panel.appendChild(g);
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

PANELS.wallets = function(panel){
  panel.innerHTML = '';
  var g = h('div', { class: 'wgroup' });
  g.innerHTML =
    '<h3>Wallets &amp; Allocation</h3>' +
    '<p class="wsub">Connecting a TON wallet verifies a player for token allocation. Search and set each player\u2019s allocation.</p>' +
    '<div class="wrow"><input id="wSearch" class="winput" style="flex:1;max-width:none" placeholder="Search username / wallet / id"/></div>' +
    '<div id="wSummary" class="wrow"></div>' +
    '<div id="wList"></div>';
  panel.appendChild(g);

  function load(){
    var qv = ($('#wSearch') && $('#wSearch').value.trim()) || '';
    api('/wallets' + (qv ? '?q=' + encodeURIComponent(qv) : '')).then(function(res){
      var sum = res.summary || {};
      var sEl = $('#wSummary');
      if (sEl) sEl.innerHTML =
        '<span class="wval">Linked ' + fmt(sum.linked || 0) + ' · Verified ' + fmt(sum.verified || 0) +
        ' · Allocated ' + fmt(sum.allocated || 0) + '</span>';
      var host = $('#wList');
      var rows = res.rows || [];
      if (!rows.length){ host.innerHTML = '<p class="muted" style="padding:12px 0">No connected wallets.</p>'; return; }
      host.innerHTML = '<h3>Connected wallets (' + rows.length + ')</h3>';
      rows.forEach(function(u){
        var addr = u.ton_address || '';
        var shortAddr = addr.length > 14 ? addr.slice(0, 6) + '…' + addr.slice(-6) : addr;
        var r = h('div', { class: 'wlist-row' });
        r.innerHTML = '<div class="wl-ico">' + iconSpan('admin-payments', '', 20) + '</div>' +
          '<div class="wl-body"><b>' + esc(u.username || ('#' + u.id)) +
          (u.verified ? ' <span style="color:var(--gold);font-weight:700">✓ verified</span>' : ' <span style="color:var(--mut)">unverified</span>') + '</b>' +
          '<span>' + esc(shortAddr) + ' · ' + fmt(u.ember) + 'E</span></div>';
        var alloc = h('input', { class: 'winput', type: 'number', min: '0', value: String(u.allocation || 0), style: 'width:120px' });
        var save = h('button', { class: 'btn tiny', text: 'Set' });
        save.addEventListener('click', function(){
          act('/allocation', { id: u.id, value: Number(alloc.value) || 0 }, 'Allocation set').then(load);
        });
        r.appendChild(alloc);
        r.appendChild(save);
        host.appendChild(r);
      });
    }).catch(function(e){ var host = $('#wList'); if (host) host.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }
  var si;
  $('#wSearch').addEventListener('input', function(){ clearTimeout(si); si = setTimeout(load, 250); });
  load();
};

PANELS.codes = function(panel){
  panel.innerHTML = '';
  var createWrap = h('div', { class: 'wgroup' });  createWrap.innerHTML =
    '<h3>Create gift code</h3>' +
    '<div class="wrow"><input id="cCode" class="winput" style="flex:1;max-width:none" placeholder="CODE" maxlength="32"/></div>' +
    '<div class="wrow">' +
      '<select id="cKind" class="winput"><option value="ember">Ember</option><option value="loyalty">Loyalty</option></select>' +
      '<input id="cAmount" class="winput" type="number" min="1" placeholder="Amount"/>' +
      '<input id="cMax" class="winput" type="number" min="0" placeholder="Max uses (0=∞)"/>' +
      '<input id="cDays" class="winput" type="number" min="0" placeholder="Expires (days)"/>' +
      '<button id="cAdd" class="btn primary sm" style="width:auto">Create</button>' +
    '</div>' +
    '<div id="cList"></div>';
  panel.appendChild(createWrap);
  $('#cAdd').addEventListener('click', function(){
    var code = $('#cCode').value.trim();
    var kind = $('#cKind').value;
    var amount = Number($('#cAmount').value) || 0;
    var maxUses = Number($('#cMax').value) || 0;
    var days = Number($('#cDays').value) || 0;
    if (!code || amount < 1){ toast('Enter code and amount', true); return; }
    act('/codes', { code: code, kind: kind, amount: amount, maxUses: maxUses, expiresDays: days }, 'Code created')
      .then(function(){ PANELS.codes(panel); });
  });

  api('/codes').then(function(list){
    var host = $('#cList');
    if (!list.length){ host.innerHTML = '<p class="muted" style="padding:12px 0">No codes yet.</p>'; return; }
    host.innerHTML = '<h3>Codes (' + list.length + ')</h3>';
    list.forEach(function(c){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-ico">' + iconSpan('admin-codes', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(c.code) + '</b>' +
        '<span>' + fmt(c.amount) + ' ' + esc(c.kind) + ' · used ' + esc(c.uses) + (c.max_uses ? '/' + esc(c.max_uses) : '') +
        (c.expires_at ? ' · expires ' + new Date(c.expires_at).toLocaleDateString() : '') + '</span></div>';
      var copyBtn = h('button', { class: 'btn tiny', text: 'Copy' });
      copyBtn.addEventListener('click', function(){
        navigator.clipboard.writeText(c.code).then(function(){ toast('Copied'); });
      });
      var editBtn = h('button', { class: 'btn tiny', text: 'Edit' });
      var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
      del.addEventListener('click', function(){
        if (confirm('Delete code ' + c.code + '?')) act('/codes/delete', { code: c.code }, 'Deleted').then(function(){ PANELS.codes(panel); });
      });
      r.appendChild(copyBtn);
      r.appendChild(editBtn);
      r.appendChild(del);
      host.appendChild(r);

      // inline editor (hidden until Edit is pressed)
      var editRow = h('div', { class: 'wrow' });
      editRow.style.display = 'none';
      editRow.style.margin = '4px 0 12px';
      editRow.innerHTML =
        '<select class="winput eKind"><option value="ember">Ember</option><option value="loyalty">Loyalty</option></select>' +
        '<input class="winput eAmount" type="number" min="1" placeholder="Amount"/>' +
        '<input class="winput eMax" type="number" min="0" placeholder="Max uses (0=∞)"/>' +
        '<input class="winput eDays" type="number" min="0" placeholder="Expires (days, blank=keep)"/>' +
        '<button class="btn primary sm eSave" style="width:auto">Save</button>' +
        '<button class="btn sm eCancel" style="width:auto">Cancel</button>';
      host.appendChild(editRow);

      editBtn.addEventListener('click', function(){
        var open = editRow.style.display !== 'none';
        if (open){ editRow.style.display = 'none'; return; }
        editRow.style.display = 'flex';
        editRow.querySelector('.eKind').value = c.kind;
        editRow.querySelector('.eAmount').value = c.amount;
        editRow.querySelector('.eMax').value = c.max_uses || 0;
        editRow.querySelector('.eDays').value = '';
      });
      editRow.querySelector('.eCancel').addEventListener('click', function(){ editRow.style.display = 'none'; });
      editRow.querySelector('.eSave').addEventListener('click', function(){
        var patch = {
          kind: editRow.querySelector('.eKind').value,
          amount: Number(editRow.querySelector('.eAmount').value) || 0,
          max_uses: Number(editRow.querySelector('.eMax').value) || 0,
        };
        if (patch.amount < 1){ toast('Amount must be at least 1', true); return; }
        var days = editRow.querySelector('.eDays').value;
        if (days !== '' && days !== null) patch.expiresDays = Number(days) || 0;
        act('/codes/update', { code: c.code, patch: patch }, 'Code updated')
          .then(function(){ PANELS.codes(panel); });
      });
    });
  }).catch(function(e){ toast(e.message, true); });
};

PANELS.xquests = function(panel){
  panel.innerHTML = '';
  api('/x-stats').then(function(s){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>X Quests Overview</h3>';
    [
      ['Active quests', s.active_quests],
      ['Pending', s.pending],
      ['Approved', s.approved],
      ['Rejected', s.rejected],
      ['Linked handles', s.linked_handles],
    ].forEach(function(row){
      var r = h('div', { class: 'wrow' });
      r.innerHTML = '<div class="wlbl"><b>' + esc(row[0]) + '</b></div><span class="wval">' + fmt(row[1]) + '</span>';
      g.appendChild(r);
    });
    panel.appendChild(g);
  }).catch(function(){});

  var queuePanel = h('div', { class: 'wgroup' });
  queuePanel.innerHTML = '<h3>Pending claims</h3><div id="xqQueue"></div>';
  panel.appendChild(queuePanel);

  /* ----- create quest form ----- */
  var createWrap = h('div', { class: 'wgroup' });
  createWrap.innerHTML =
    '<h3>Create X quest</h3>' +
    '<div class="wrow">' +
      '<input id="xqSlug" class="winput" placeholder="slug (a-z0-9_)" maxlength="40"/>' +
      '<input id="xqTitle" class="winput" style="flex:1;max-width:none" placeholder="Title" maxlength="80"/>' +
    '</div>' +
    '<div class="wrow"><input id="xqDesc" class="winput" style="flex:1;max-width:none" placeholder="Description" maxlength="240"/></div>' +
    '<div class="wrow">' +
      '<select id="xqKind" class="winput">' +
        '<option value="follow">follow</option><option value="retweet">retweet</option>' +
        '<option value="like">like</option><option value="tweet">tweet</option>' +
        '<option value="hashtag">hashtag</option><option value="quote">quote</option>' +
      '</select>' +
      '<input id="xqTarget" class="winput" style="flex:1;max-width:none" placeholder="Target (URL / @handle / #tag)" maxlength="120"/>' +
    '</div>' +
    '<div class="wrow">' +
      '<input id="xqTargetLabel" class="winput" placeholder="Button label" maxlength="80"/>' +
      '<input id="xqReward" class="winput" type="number" min="0" placeholder="Reward Ember"/>' +
      '<input id="xqPerUser" class="winput" type="number" min="1" placeholder="Per-user limit" value="1"/>' +
      '<input id="xqMax" class="winput" type="number" min="0" placeholder="Max completions (0=∞)"/>' +
      '<input id="xqSort" class="winput" type="number" placeholder="Sort" value="100"/>' +
      '<button id="xqAdd" class="btn primary sm" style="width:auto">Create</button>' +
    '</div>' +
    '<div id="xqList"></div>';
  panel.appendChild(createWrap);

  $('#xqAdd').addEventListener('click', function(){
    var data = {
      slug: $('#xqSlug').value.trim(),
      title: $('#xqTitle').value.trim(),
      description: $('#xqDesc').value.trim(),
      kind: $('#xqKind').value,
      target: $('#xqTarget').value.trim(),
      target_label: $('#xqTargetLabel').value.trim(),
      reward_ember: Number($('#xqReward').value) || 0,
      per_user_limit: Number($('#xqPerUser').value) || 1,
      max_completions: Number($('#xqMax').value) || 0,
      sort_order: Number($('#xqSort').value) || 100
    };
    if (data.slug.length < 2){ toast('Enter a slug (2+ chars)', true); return; }
    act('/x-quests', data, 'Quest created').then(function(){ PANELS.xquests(panel); });
  });

  loadQuests();

  function loadQuests(){
    api('/x-quests').then(function(list){
      var host = $('#xqList');
      if (!list.length){ host.innerHTML = '<p class="muted" style="padding:12px 0">No quests yet.</p>'; return; }
      host.innerHTML = '<h3>All quests (' + list.length + ')</h3>';
      list.forEach(function(qz){
        var r = h('div', { class: 'wlist-row' });
        r.innerHTML = '<div class="wl-ico">' + iconSpan('brand-x', '', 20) + '</div>' +
          '<div class="wl-body"><b>' + esc(qz.title) + ' <span style="color:var(--mut);font-weight:600">(' + esc(qz.slug) + ')</span>' +
          (qz.active ? '' : ' · <span style="color:var(--mut)">hidden</span>') + '</b>' +
          '<span>' + esc(qz.kind) + ' · +' + fmt(qz.reward_ember) + 'E · limit ' + esc(qz.per_user_limit) +
          (qz.max_completions ? ' · cap ' + fmt(qz.max_completions) : '') +
          ' · pending ' + fmt(qz.pending || 0) + ' · approved ' + fmt(qz.approved || 0) + '</span></div>';
        var tog = h('button', { class: 'btn tiny', text: qz.active ? 'Hide' : 'Show' });
        tog.addEventListener('click', function(){
          act('/x-quests/toggle', { id: qz.id, active: qz.active ? false : true }, qz.active ? 'Hidden' : 'Shown')
            .then(loadQuests);
        });
        var editBtn = h('button', { class: 'btn tiny', text: 'Edit' });
        var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
        del.addEventListener('click', function(){
          if (confirm('Delete quest "' + (qz.title || qz.slug) + '"? Claims are removed too.'))
            act('/x-quests/delete', { id: qz.id }, 'Deleted').then(loadQuests);
        });
        r.appendChild(tog);
        r.appendChild(editBtn);
        r.appendChild(del);
        host.appendChild(r);

        var editRow = h('div', { class: 'wrow' });
        editRow.style.display = 'none';
        editRow.style.margin = '4px 0 12px';
        editRow.style.flexWrap = 'wrap';
        editRow.innerHTML =
          '<input class="winput eTitle" placeholder="Title"/>' +
          '<input class="winput eTarget" placeholder="Target"/>' +
          '<input class="winput eLabel" placeholder="Button label"/>' +
          '<input class="winput eReward" type="number" min="0" placeholder="Reward Ember"/>' +
          '<input class="winput eLimit" type="number" min="1" placeholder="Per-user limit"/>' +
          '<input class="winput eCap" type="number" min="0" placeholder="Max completions"/>' +
          '<input class="winput eSort" type="number" placeholder="Sort"/>' +
          '<button class="btn primary sm eSave" style="width:auto">Save</button>' +
          '<button class="btn sm eCancel" style="width:auto">Cancel</button>';
        host.appendChild(editRow);

        editBtn.addEventListener('click', function(){
          var open = editRow.style.display !== 'none';
          if (open){ editRow.style.display = 'none'; return; }
          editRow.style.display = 'flex';
          editRow.querySelector('.eTitle').value = qz.title || '';
          editRow.querySelector('.eTarget').value = qz.target || '';
          editRow.querySelector('.eLabel').value = qz.target_label || '';
          editRow.querySelector('.eReward').value = qz.reward_ember || 0;
          editRow.querySelector('.eLimit').value = qz.per_user_limit || 1;
          editRow.querySelector('.eCap').value = qz.max_completions || 0;
          editRow.querySelector('.eSort').value = qz.sort_order || 100;
        });
        editRow.querySelector('.eCancel').addEventListener('click', function(){ editRow.style.display = 'none'; });
        editRow.querySelector('.eSave').addEventListener('click', function(){
          var patch = {
            id: qz.id,
            title: editRow.querySelector('.eTitle').value.trim(),
            target: editRow.querySelector('.eTarget').value.trim(),
            target_label: editRow.querySelector('.eLabel').value.trim(),
            reward_ember: Number(editRow.querySelector('.eReward').value) || 0,
            per_user_limit: Number(editRow.querySelector('.eLimit').value) || 1,
            max_completions: Number(editRow.querySelector('.eCap').value) || 0,
            sort_order: Number(editRow.querySelector('.eSort').value) || 100
          };
          act('/x-quests/update', patch, 'Saved').then(function(){ PANELS.xquests(panel); });
        });
      });
    }).catch(function(e){ var host = $('#xqList'); if (host) host.innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }
  function loadQueue(){
    api('/x-claims?status=pending').then(function(list){
      var host = $('#xqQueue');
      if (!list.length){ host.innerHTML = '<p class="muted" style="padding:12px 0">No pending claims.</p>'; return; }
      host.innerHTML = '';
      list.forEach(function(c){
        var r = h('div', { class: 'wlist-row' });
        r.innerHTML = '<div class="wl-ico">' + iconSpan('brand-x', '', 20) + '</div>' +
          '<div class="wl-body"><b>@' + esc(c.x_handle) + ' · ' + esc(c.quest_title) + '</b>' +
          '<span>' + esc(c.first_name || c.username || ('#' + c.user_id)) + ' · ' + fmt(c.quest_reward_ember) + 'E' +
          (c.handle_owner_user && c.handle_owner_user !== c.user_id ? ' · HANDLE ALREADY LINKED' : '') + '</span></div>';
        var ap = h('button', { class: 'btn tiny', text: 'Approve' });
        ap.addEventListener('click', function(){
          act('/x-claims/approve', { id: c.id }, 'Approved').then(loadQueue);
        });
        var rj = h('button', { class: 'btn tiny danger', text: 'Reject' });
        rj.addEventListener('click', function(){
          var reason = prompt('Reason:');
          if (!reason) return;
          act('/x-claims/reject', { id: c.id, reason: reason }, 'Rejected').then(loadQueue);
        });
        r.appendChild(ap);
        r.appendChild(rj);
        host.appendChild(r);
      });
    }).catch(function(e){ $('#xqQueue').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }
  loadQueue();
};

PANELS.trials = function(panel){
  panel.innerHTML = '';
  api('/trials').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Trials</h3><p class="wsub">Edit reward, cooldown, and minigame per trial.</p>';
    list.forEach(function(t){
      var row = h('div', { class: 'wlist-row' });
      row.innerHTML = '<div class="wl-ico">' + iconSpan('trials-scroll', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(t.name) + ' <span style="color:var(--mut);font-weight:600">(' + esc(t.slug) + ')</span></b>' +
        '<span>+' + fmt(t.reward_ember) + 'E · +' + fmt(t.reward_loyalty) + 'L · cd ' + esc(t.cooldown_hours) + 'h · ' + esc(t.minigame || 'hold') + '</span></div>';
      var mg = h('select', { class: 'winput', style: 'min-width:100px' });
      ['hold','stoke','feed','cry','sift','ad'].forEach(function(m){
        var o = h('option', { value: m, text: m });
        if ((t.minigame || 'hold') === m) o.selected = true;
        mg.appendChild(o);
      });
      mg.addEventListener('change', function(){
        act('/trial/minigame', { slug: t.slug, minigame: mg.value }, t.slug + ' → ' + mg.value)
          .then(function(){ PANELS.trials(panel); });
      });
      row.appendChild(mg);
      g.appendChild(row);
    });
    panel.appendChild(g);
    $('#panelSub').textContent = list.length + ' trials';
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

PANELS.economy = function(panel){ configPanel(panel, [
  { group: 'Idle Ash', items: [
    { k: 'ashMinutes', label: 'Ash interval', hint: 'Minutes per ash', type: 'slider', min: 5, max: 120 },
    { k: 'ashCap', label: 'Ash cap', hint: 'Max stored', type: 'slider', min: 1, max: 20 },
    { k: 'ashUnit', label: 'Ash value', hint: 'Ember per ash', type: 'slider', min: 10, max: 500 },
  ]},
  { group: 'Check-in', items: [
    { k: 'checkin_base', label: 'Check-in base', hint: 'Ember', type: 'slider', min: 100, max: 2000 },
    { k: 'checkin_streakStep', label: 'Streak step', hint: 'Ember per day', type: 'slider', min: 0, max: 200 },
    { k: 'checkin_streakMax', label: 'Streak max bonus', hint: 'Ember', type: 'slider', min: 0, max: 5000 },
  ]},
  { group: 'Tribe', items: [
    { k: 'foundEmber', label: 'Found cost', hint: 'Ember', type: 'slider', min: 1000, max: 200000 },
  ]},
]); };

PANELS.bonfires = function(panel){
  panel.innerHTML = '';
  api('/bonfires').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Active bonfires</h3>';
    if (!list.length) g.innerHTML += '<p class="muted" style="padding:12px 0">No bonfires yet.</p>';
    list.slice(0, 5).forEach(function(b){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-ico">' + iconSpan('admin-bonfire', '', 20) + '</div>' +
        '<div class="wl-body"><b>' + esc(b.title) + '</b>' +
        '<span>' + esc(b.metric) + ' ×' + esc(b.multiplier) + ' · ends ' + esc(String(b.end_at).slice(0, 16)) + '</span></div>';
      var end = h('button', { class: 'btn tiny danger', text: 'End' });
      end.addEventListener('click', function(){ act('/bonfires/end', { id: b.id }, 'Ended').then(function(){ PANELS.bonfires(panel); }); });
      r.appendChild(end);
      g.appendChild(r);
    });
    panel.appendChild(g);
  }).catch(function(){});
};

PANELS.names = function(panel){
  panel.innerHTML = '';
  api('/names').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.innerHTML = '<h3>Name pool</h3><p class="wsub">' + list.length + ' names (' +
      list.filter(function(n){ return !n.claimed_by_tribe_id; }).length + ' unclaimed)</p>';
    list.slice(0, 80).forEach(function(n){
      var r = h('div', { class: 'wlist-row' });
      r.innerHTML = '<div class="wl-body"><b>' + esc(n.name) + '</b>' +
        '<span>' + (n.claimed_by_tribe_id ? 'claimed by #' + esc(n.claimed_by_tribe_id) : 'unclaimed') + '</span></div>';
      if (!n.claimed_by_tribe_id){
        var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
        del.addEventListener('click', function(){ act('/names/delete', { id: n.id }, 'Deleted').then(function(){ PANELS.names(panel); }); });
        r.appendChild(del);
      }
      g.appendChild(r);
    });
    var addRow = h('div', { class: 'wlist-row' });
    var inp = h('input', { class: 'winput', placeholder: 'New tribe name' });
    var add = h('button', { class: 'btn tiny', text: 'Add' });
    add.addEventListener('click', function(){
      var v = inp.value.trim();
      if (!v) return;
      act('/names/add', { name: v }, 'Added').then(function(){ PANELS.names(panel); });
    });
    addRow.appendChild(inp);
    addRow.appendChild(add);
    g.appendChild(addRow);
    panel.appendChild(g);
  }).catch(function(){});
};

PANELS.avatars = function(panel){
  panel.innerHTML = '';

  var up = h('div', { class: 'wgroup' });
  up.appendChild(h('h3', { text: 'Add avatars' }));
  up.appendChild(h('p', { class: 'wsub', text: 'Upload one or many .svg files. Each file becomes a selectable animated avatar. Scripts and event handlers are stripped automatically.' }));

  var fileRow = h('div', { class: 'wlist-row' });
  var file = h('input', { class: 'winput', type: 'file', accept: '.svg,image/svg+xml', multiple: true });
  fileRow.appendChild(file);
  up.appendChild(fileRow);

  var nameRow = h('div', { class: 'wlist-row' });
  var nameInp = h('input', { class: 'winput', placeholder: 'Optional name / prefix (defaults to file name)' });
  nameRow.appendChild(nameInp);
  up.appendChild(nameRow);

  var status = h('p', { class: 'wsub', text: '' });
  var upBtn = h('button', { class: 'btn primary', text: 'Upload' });
  upBtn.addEventListener('click', function(){
    var files = file.files ? Array.prototype.slice.call(file.files) : [];
    if (!files.length) return toast('Choose one or more SVG files', true);
    upBtn.disabled = true;
    var prefix = nameInp.value.trim();
    var done = 0, failed = 0;
    function slugify(base){
      var raw = prefix ? (prefix + '-' + base) : base;
      return raw.toLowerCase().replace(/[^a-z0-9\-]+/g, '-').replace(/^\-+/, '').replace(/\-+$/, '');
    }
    function next(i){
      if (i >= files.length){
        upBtn.disabled = false;
        status.textContent = '';
        toast('Uploaded ' + done + (failed ? (' · ' + failed + ' failed') : ''), failed > 0);
        PANELS.avatars(panel);
        return;
      }
      var f = files[i];
      status.textContent = 'Uploading ' + (i + 1) + ' / ' + files.length + '… (' + f.name + ')';
      var reader = new FileReader();
      reader.onload = function(){
        var svg = String(reader.result || '');
        var base = f.name.replace(/\.svg$/i, '');
        var nm = (files.length > 1)
          ? (prefix ? (prefix + ' ' + base) : base)
          : (prefix || base);
        api('/avatars', { method: 'POST', body: { slug: slugify(base), name: nm, svg: svg } })
          .then(function(){ done++; })
          .catch(function(){ failed++; })
          .then(function(){ next(i + 1); });
      };
      reader.onerror = function(){ failed++; next(i + 1); };
      reader.readAsText(f);
    }
    next(0);
  });
  up.appendChild(upBtn);
  up.appendChild(status);
  panel.appendChild(up);

  api('/avatars').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.appendChild(h('h3', { text: 'Avatar library' }));
    g.appendChild(h('p', { class: 'wsub', text: list.length + ' avatars (' + list.filter(function(a){ return a.active; }).length + ' active)' }));

    var grid = h('div', { class: 'avatar-admin-grid' });
    list.forEach(function(a){
      var card = h('div', { class: 'avatar-admin-card' + (a.active ? '' : ' off') });
      var prev = h('div', { class: 'avatar-admin-prev sv-animated' });
      prev.innerHTML = a.svg || '';
      var meta = h('div', { class: 'avatar-admin-meta' });
      meta.appendChild(h('b', { text: a.name || a.slug }));
      meta.appendChild(h('span', { text: a.slug + (a.active ? '' : ' · hidden') }));
      var actions = h('div', { class: 'avatar-admin-actions' });
      var tog = h('button', { class: 'btn tiny ghost', text: a.active ? 'Hide' : 'Show' });
      tog.addEventListener('click', function(){
        act('/avatars/toggle', { id: a.id, active: a.active ? 'off' : 'on' }, a.active ? 'Hidden' : 'Shown')
          .then(function(){ PANELS.avatars(panel); });
      });
      var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
      del.addEventListener('click', function(){
        if (confirm('Delete avatar "' + (a.name || a.slug) + '"? Players using it will lose it.'))
          act('/avatars/delete', { id: a.id }, 'Deleted').then(function(){ PANELS.avatars(panel); });
      });
      actions.appendChild(tog); actions.appendChild(del);
      card.appendChild(prev); card.appendChild(meta); card.appendChild(actions);
      grid.appendChild(card);
    });
    if (!list.length) grid.appendChild(h('p', { class: 'muted', text: 'No avatars yet — upload some above.' }));
    g.appendChild(grid);
    panel.appendChild(g);
    $('#panelSub').textContent = list.length + ' avatars';
  }).catch(function(e){ panel.appendChild(h('p', { class: 'muted', text: e.message })); });
};

PANELS.control = function(panel){
  panel.innerHTML = '';
  var g = h('div', { class: 'wgroup' });
  g.innerHTML = '<h3>Maintenance mode</h3><p class="wsub">Freezes player actions. Reads still work.</p>';
  var row = h('div', { class: 'wrow' });
  var on = h('button', { class: 'btn tiny', text: 'Enable' });
  var off = h('button', { class: 'btn tiny ghost', text: 'Disable' });
  on.addEventListener('click', function(){ act('/maintenance', { on: 'on' }, 'Maintenance ON'); });
  off.addEventListener('click', function(){ act('/maintenance', { on: 'off' }, 'Maintenance off'); });
  row.appendChild(on); row.appendChild(off);
  g.appendChild(row);
  panel.appendChild(g);

  var b = h('div', { class: 'wgroup' });
  b.innerHTML = '<h3>Broadcast</h3><p class="wsub">Sends a message to every non-banned player via the game bot.</p>';
  var ta = h('textarea', { placeholder: 'Your message…', rows: 3,
    style: 'width:100%;padding:11px;border-radius:10px;background:rgba(0,0,0,.3);border:1px solid var(--line2);color:var(--ink);font-family:inherit;margin-bottom:10px' });
  var send = h('button', { class: 'btn primary', text: 'Send to all' });
  send.addEventListener('click', function(){
    var txt = ta.value.trim();
    if (!txt) return toast('Write a message', true);
    if (confirm('Send to every player?')) act('/broadcast', { text: txt }, 'Broadcast sent').then(function(d){ toast('Sent to ' + fmt(d.sent)); ta.value = ''; });
  });
  b.appendChild(ta); b.appendChild(send);
  panel.appendChild(b);
};

PANELS.feed = function(panel){
  panel.innerHTML = '';
  var g = h('div', { class: 'wgroup' });
  g.innerHTML = '<h3>Recent activity</h3><div id="feedPanelList"></div>';
  panel.appendChild(g);
  function load(){
    api('/feed?limit=60').then(function(list){
      var host = $('#feedPanelList');
      host.innerHTML = '';
      list.slice().reverse().forEach(function(evt){
        var r = h('div', { class: 'wlist-row' });
        r.innerHTML = '<div class="wl-ico">' + iconSpan(evt.icon || 'admin-feed', '', 20) + '</div>' +
          '<div class="wl-body"><b>' + esc(evt.text) + '</b>' +
          '<span>' + esc(evt.type) + ' · ' + new Date(evt.ts).toLocaleString() + '</span></div>';
        host.appendChild(r);
      });
    }).catch(function(e){ $('#feedPanelList').innerHTML = '<p class="muted">' + esc(e.message) + '</p>'; });
  }
  load();
};

PANELS.danger = function(panel){
  panel.innerHTML = '';
  api('/reset/preview', { method: 'POST' }).then(function(p){
    var g = h('div', { class: 'wgroup danger-card' });
    g.innerHTML = '<h3>Progression Reset</h3>' +
      '<p>Wipes all free-currency progress, tribe membership, and active wars. <b>Keeps</b> accounts, purchased cosmetics, and Stars.</p>' +
      '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:12px;font-family:monospace;color:#ffcf7a;margin:0 0 14px;white-space:pre-line">' +
        'Users: ' + fmt(p.users) + ' (' + fmt(p.usersWithProgress) + ' with progress)\n' +
        'Tribes: ' + fmt(p.tribes) + '\n' +
        'Active wars: ' + fmt(p.activeWars) + ' / ' + fmt(p.totalWars) + ' total' +
      '</div>';
    var btn = h('button', { class: 'btn danger', text: 'Reset Progression' });
    btn.addEventListener('click', function(){ confirmReset('progression', p, 'RESET'); });
    g.appendChild(btn);
    panel.appendChild(g);

    var g2 = h('div', { class: 'wgroup danger-card' });
    g2.innerHTML = '<h3>Factory Reset</h3>' +
      '<p>Deletes everything except user accounts. All tribes, wars, chronicles, Kiva messages, codes, cosmetics, and payment records are wiped.</p>' +
      '<div style="background:rgba(0,0,0,.3);border-radius:12px;padding:12px;font-family:monospace;color:#ffcf7a;margin:0 0 14px;white-space:pre-line">' +
        'Users: ' + fmt(p.users) + ' (kept)\n' +
        'Tribes: ' + fmt(p.tribes) + ' (deleted)\n' +
        'Wars: ' + fmt(p.totalWars) + ' (deleted)\n' +
        'Kiva messages: ' + fmt(p.kivaMessages) + ' (deleted)\n' +
        'Codes: ' + fmt(p.codes) + ' (deleted)\n' +
        'Payments: ' + fmt(p.payments) + ' (deleted)' +
      '</div>';
    var btn2 = h('button', { class: 'btn danger', text: 'Factory Reset' });
    btn2.addEventListener('click', function(){ confirmReset('factory', p, 'FACTORY'); });
    g2.appendChild(btn2);
    panel.appendChild(g2);

    var g3 = h('div', { class: 'wgroup danger-card' });
    g3.innerHTML = '<h3>Backup first</h3><p>Download a JSON snapshot of the entire database before resetting.</p>';
    var bk = h('button', { class: 'btn', text: 'Download backup' });
    bk.addEventListener('click', function(){
      api('/reset/backup', { method: 'POST' }).then(function(data){
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tribes-backup-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
        a.click();
        toast('Backup downloaded');
      }).catch(function(e){ toast(e.message, true); });
    });
    g3.appendChild(bk);
    panel.appendChild(g3);
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
};

function confirmReset(kind, preview, word){
  var bg = h('div', { class: 'modal-bg' });
  var card = h('div', { class: 'modal-card' });
  card.innerHTML = '<h3>' + (kind === 'factory' ? 'Factory Reset' : 'Progression Reset') + '</h3>' +
    '<p>This cannot be undone. Type <b style="color:#ffcf7a">' + word + '</b> to confirm.</p>';
  var inp = h('input', { placeholder: 'Type ' + word + ' to confirm' });
  card.appendChild(inp);
  var row = h('div', { class: 'row' });
  var cancel = h('button', { class: 'btn ghost', text: 'Cancel' });
  var go = h('button', { class: 'btn danger', text: 'Reset now' });
  cancel.addEventListener('click', function(){ document.body.removeChild(bg); });
  go.addEventListener('click', function(){
    if (inp.value.trim().toUpperCase() !== word){ toast('Type ' + word + ' exactly', true); return; }
    document.body.removeChild(bg);
    var path = kind === 'factory' ? '/reset/factory' : '/reset/progression';
    act(path, {}, 'Reset started…').then(function(){
      toast('Reset complete');
      openPanel('danger');
    });
  });
  row.appendChild(cancel);
  row.appendChild(go);
  card.appendChild(row);
  bg.appendChild(card);
  document.body.appendChild(bg);
  inp.focus();
}

function configPanel(panel, groups){
  panel.innerHTML = '';
  api('/econ').then(function(cfg){
    var defs = cfg._defaults || {};
    groups.forEach(function(g){
      var el = h('div', { class: 'wgroup' });
      el.innerHTML = '<h3>' + esc(g.group) + '</h3>';
      g.items.forEach(function(it){
        var v = cfg[it.k];
        var d = defs[it.k];
        var row;
        if (it.type === 'slider'){
          row = slider(it.label, it.hint, it.k, Number(v), it.min, it.max, 1, { default: d });
        } else if (it.type === 'stepper'){
          row = stepper(it.label, it.hint, it.k, Number(v), it.min, it.max, 1);
        } else if (it.type === 'toggle'){
          row = toggle(it.label, it.hint, it.k, v);
        } else {
          row = textRow(it.label, it.hint, it.k, v);
        }
        el.appendChild(row);
      });
      panel.appendChild(el);
    });
  }).catch(function(e){ panel.innerHTML = '<div class="loading">' + esc(e.message) + '</div>'; });
}

/* ---------- relics (create / modify + card art) ---------- */
var RELIC_RARITIES = ['common', 'rare', 'epic', 'legendary'];
var RELIC_DOMAINS  = ['fire', 'bone', 'sun', 'moon', 'ash'];
var RELIC_KINDS    = ['passive', 'active'];
var RELIC_EFFECTS  = ['', 'combo', 'slow', 'ward', 'revive', 'reveal', 'siege'];
var DOMAIN_GLYPH   = { fire:'\uD83D\uDD25', bone:'\uD83E\uDDB4', sun:'\u2600\uFE0F', moon:'\uD83C\uDF19', ash:'\u2604\uFE0F' };

function relicArtHTML(r){
  if (r.svg) return r.svg;
  var src = r.image_url || (r.icon_file ? ('/assets/relics/' + r.icon_file) : '');
  if (src) return '<img src="' + esc(src) + '" alt="" loading="lazy">';
  return '<span class="relic-card-glyph">' + (DOMAIN_GLYPH[r.domain] || '\uD83C\uDFFA') + '</span>';
}

// Reusable relic card (player view + admin preview share this markup + CSS).
function renderRelicCard(r){
  var rarity = RELIC_RARITIES.indexOf(String(r.rarity)) >= 0 ? r.rarity : 'common';
  var card = h('div', { class: 'relic-card rc-' + rarity + (r.active === false ? ' rc-off' : '') });
  var art = h('div', { class: 'relic-card-art' });
  art.innerHTML = relicArtHTML(r);
  var body = h('div', { class: 'relic-card-body' });
  var top = h('div', { class: 'relic-card-top' });
  top.appendChild(h('span', { class: 'relic-card-name', text: r.name || r.slug || 'Unnamed relic' }));
  top.appendChild(h('span', { class: 'relic-card-rar', text: rarity }));
  body.appendChild(top);
  var tags = h('div', { class: 'relic-card-tags' });
  tags.appendChild(h('span', { class: 'relic-tag dom-' + (r.domain || 'fire'), text: (DOMAIN_GLYPH[r.domain] || '') + ' ' + (r.domain || 'fire') }));
  tags.appendChild(h('span', { class: 'relic-tag', text: r.kind || 'passive' }));
  if (r.war_effect) tags.appendChild(h('span', { class: 'relic-tag', text: r.war_effect }));
  body.appendChild(tags);
  if (r.description) body.appendChild(h('p', { class: 'relic-card-desc', text: r.description }));
  var stat = h('div', { class: 'relic-card-stat' });
  var bv = Number(r.buff_value) || 0;
  stat.appendChild(h('span', { text: (r.buff_type || 'none') + (bv ? (' \u00b7 ' + bv) : '') }));
  if (Number(r.cooldown_min) > 0) stat.appendChild(h('span', { text: 'CD ' + r.cooldown_min + 'm' }));
  if (Number(r.price_stars) > 0) stat.appendChild(h('span', { text: '\u2b50 ' + r.price_stars }));
  body.appendChild(stat);
  card.appendChild(art);
  card.appendChild(body);
  return card;
}

function relicSelect(label, options, value){
  var wrap = h('label', { class: 'relic-field' });
  wrap.appendChild(h('span', { text: label }));
  var sel = h('select', { class: 'winput' });
  options.forEach(function(o){
    var opt = h('option', { value: o, text: o === '' ? '(none)' : o });
    if (String(o) === String(value)) opt.selected = true;
    sel.appendChild(opt);
  });
  wrap.appendChild(sel);
  wrap._input = sel;
  return wrap;
}
function relicText(label, value, ph){
  var wrap = h('label', { class: 'relic-field' });
  wrap.appendChild(h('span', { text: label }));
  var inp = h('input', { class: 'winput', placeholder: ph || '', value: value == null ? '' : value });
  wrap.appendChild(inp);
  wrap._input = inp;
  return wrap;
}

PANELS.relics = function(panel){
  panel.innerHTML = '';
  var editing = { id: null, svg: null, image_url: null };

  var ed = h('div', { class: 'wgroup' });
  ed.appendChild(h('h3', { text: 'Forge / modify a relic' }));
  ed.appendChild(h('p', { class: 'wsub', text: 'Set the buff, domain and war effect, then attach card art (SVG or PNG). Scripts are stripped from SVGs automatically.' }));

  var grid = h('div', { class: 'relic-form-grid' });
  var fName   = relicText('Name', '', 'Ashfang');
  var fSlug   = relicText('Slug (optional)', '', 'auto from name');
  var fRar    = relicSelect('Rarity', RELIC_RARITIES, 'common');
  var fDom    = relicSelect('Domain', RELIC_DOMAINS, 'fire');
  var fKind   = relicSelect('Kind', RELIC_KINDS, 'passive');
  var fCtr    = relicSelect('Counters', [''].concat(RELIC_DOMAINS), '');
  var fEff    = relicSelect('War effect', RELIC_EFFECTS, '');
  var fBuffT  = relicText('Buff type', 'none', 'war_combo');
  var fBuffV  = relicText('Buff value', '0', '0.25');
  var fCd     = relicText('Cooldown (min)', '0', '30');
  var fPrice  = relicText('Price (stars)', '0', '0');
  var fSort   = relicText('Sort order', '100', '100');
  [fName, fSlug, fRar, fDom, fKind, fCtr, fEff, fBuffT, fBuffV, fCd, fPrice, fSort]
    .forEach(function(f){ grid.appendChild(f); });
  ed.appendChild(grid);

  var fDesc = h('textarea', { class: 'winput relic-desc', placeholder: 'Short flavour / effect description', rows: 2 });
  ed.appendChild(fDesc);

  var artRow = h('div', { class: 'wlist-row' });
  var artFile = h('input', { class: 'winput', type: 'file', accept: '.svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg' });
  var clearArt = h('button', { class: 'btn tiny ghost', text: 'Clear art' });
  artRow.appendChild(artFile); artRow.appendChild(clearArt);
  ed.appendChild(h('p', { class: 'wsub', text: 'Card art \u2014 upload an .svg (inline, animatable) or a .png/.webp (\u2264180KB).' }));
  ed.appendChild(artRow);

  var preview = h('div', { class: 'relic-preview-wrap' });
  ed.appendChild(preview);

  function collect(){
    return {
      id: editing.id,
      name: fName._input.value.trim(),
      slug: fSlug._input.value.trim(),
      rarity: fRar._input.value,
      domain: fDom._input.value,
      kind: fKind._input.value,
      counters: fCtr._input.value,
      war_effect: fEff._input.value,
      buff_type: fBuffT._input.value.trim(),
      buff_value: fBuffV._input.value.trim(),
      cooldown_min: fCd._input.value.trim(),
      price_stars: fPrice._input.value.trim(),
      sort_order: fSort._input.value.trim(),
      description: fDesc.value.trim(),
      svg: editing.svg,
      image_url: editing.image_url,
      active: true
    };
  }
  function refreshPreview(){
    preview.innerHTML = '';
    preview.appendChild(h('span', { class: 'wsub', text: 'Live preview' }));
    preview.appendChild(renderRelicCard(collect()));
  }
  [fName, fRar, fDom, fKind, fEff, fBuffT, fBuffV, fCd, fPrice]
    .forEach(function(f){ f._input.addEventListener('input', refreshPreview); f._input.addEventListener('change', refreshPreview); });
  fDesc.addEventListener('input', refreshPreview);

  artFile.addEventListener('change', function(){
    var f = artFile.files && artFile.files[0];
    if (!f) return;
    var reader = new FileReader();
    if (/svg/i.test(f.type) || /\.svg$/i.test(f.name)){
      reader.onload = function(){ editing.svg = String(reader.result || ''); editing.image_url = null; refreshPreview(); };
      reader.readAsText(f);
    } else {
      reader.onload = function(){ editing.image_url = String(reader.result || ''); editing.svg = null; refreshPreview(); };
      reader.readAsDataURL(f);
    }
  });
  clearArt.addEventListener('click', function(){ editing.svg = null; editing.image_url = null; artFile.value = ''; refreshPreview(); });

  var saveRow = h('div', { class: 'wlist-row' });
  var saveBtn = h('button', { class: 'btn primary', text: 'Save relic' });
  var resetBtn = h('button', { class: 'btn ghost', text: 'New / clear' });
  saveRow.appendChild(saveBtn); saveRow.appendChild(resetBtn);
  ed.appendChild(saveRow);
  panel.appendChild(ed);

  function loadInto(r){
    editing.id = r.id; editing.svg = r.svg || null; editing.image_url = r.image_url || null;
    fName._input.value = r.name || ''; fSlug._input.value = r.slug || '';
    fRar._input.value = r.rarity || 'common'; fDom._input.value = r.domain || 'fire';
    fKind._input.value = r.kind || 'passive'; fCtr._input.value = r.counters || '';
    fEff._input.value = r.war_effect || ''; fBuffT._input.value = r.buff_type || 'none';
    fBuffV._input.value = r.buff_value || 0; fCd._input.value = r.cooldown_min || 0;
    fPrice._input.value = r.price_stars || 0; fSort._input.value = r.sort_order == null ? 100 : r.sort_order;
    fDesc.value = r.description || '';
    saveBtn.textContent = 'Save changes'; refreshPreview();
    ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function clearForm(){
    editing = { id: null, svg: null, image_url: null };
    [fName, fSlug, fBuffT, fBuffV, fCd, fPrice, fSort].forEach(function(f){ f._input.value = ''; });
    fBuffT._input.value = 'none'; fBuffV._input.value = '0'; fCd._input.value = '0';
    fPrice._input.value = '0'; fSort._input.value = '100';
    fRar._input.value = 'common'; fDom._input.value = 'fire'; fKind._input.value = 'passive';
    fCtr._input.value = ''; fEff._input.value = ''; fDesc.value = '';
    artFile.value = ''; saveBtn.textContent = 'Save relic'; refreshPreview();
  }
  resetBtn.addEventListener('click', clearForm);

  saveBtn.addEventListener('click', function(){
    var body = collect();
    if (!body.name){ toast('Name is required', true); return; }
    saveBtn.disabled = true;
    act('/relics', body, editing.id ? 'Relic updated' : 'Relic forged')
      .then(function(){ saveBtn.disabled = false; PANELS.relics(panel); })
      .catch(function(){ saveBtn.disabled = false; });
  });

  refreshPreview();

  api('/relics').then(function(list){
    var g = h('div', { class: 'wgroup' });
    g.appendChild(h('h3', { text: 'Relic library' }));
    g.appendChild(h('p', { class: 'wsub', text: list.length + ' relics (' + list.filter(function(r){ return r.active; }).length + ' active)' }));
    var lib = h('div', { class: 'relic-lib-grid' });
    list.forEach(function(r){
      var cell = h('div', { class: 'relic-lib-cell' });
      cell.appendChild(renderRelicCard(r));
      var actions = h('div', { class: 'relic-lib-actions' });
      var edit = h('button', { class: 'btn tiny', text: 'Edit' });
      edit.addEventListener('click', function(){ loadInto(r); });
      var tog = h('button', { class: 'btn tiny ghost', text: r.active ? 'Hide' : 'Show' });
      tog.addEventListener('click', function(){ act('/relics/toggle', { id: r.id, active: r.active ? 'off' : 'on' }, r.active ? 'Hidden' : 'Shown').then(function(){ PANELS.relics(panel); }); });
      var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
      del.addEventListener('click', function(){ if (confirm('Delete relic "' + (r.name || r.slug) + '"? Holders lose it.')) act('/relics/delete', { id: r.id }, 'Deleted').then(function(){ PANELS.relics(panel); }); });
      actions.appendChild(edit); actions.appendChild(tog); actions.appendChild(del);
      cell.appendChild(actions);
      lib.appendChild(cell);
    });
    if (!list.length) lib.appendChild(h('p', { class: 'muted', text: 'No relics yet \u2014 forge one above.' }));
    g.appendChild(lib);
    panel.appendChild(g);
    $('#panelSub').textContent = list.length + ' relics';
  }).catch(function(e){ panel.appendChild(h('p', { class: 'muted', text: e.message })); });
};
/* ---------- boot ---------- */
if (token){
  api('/stats').then(function(){ showConsole(); loadFeedInitial(); })
    .catch(function(){ localStorage.removeItem(KEY); token = ''; });
}
})();