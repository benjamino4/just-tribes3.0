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
  { id: 'codes',      label: 'Gift Codes',    ico: 'admin-codes' },
  { id: 'xquests',    label: 'X Quests',      ico: 'admin-quests' },
  { id: 'trials',     label: 'Trials',        ico: 'admin-trials' },
  { id: 'economy',    label: 'Economy',       ico: 'admin-economy' },
  { id: 'bonfires',   label: 'Bonfires',      ico: 'admin-bonfire' },
  { id: 'names',      label: 'Names Pool',    ico: 'admin-names' },
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
  var inp = h('input', { type: 'range', min: min, max: max, step: step || 1, value: value });
  var val = h('span', { class: 'wval' }, String(value));
  inp.addEventListener('input', function(){ val.textContent = inp.value; });
  inp.addEventListener('change', function(){ saveCfg(key, inp.value); });
  var ctl = h('div', { class: 'wslider' }, inp);
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

PANELS.codes = function(panel){
  panel.innerHTML = '';
  var createWrap = h('div', { class: 'wgroup' });
  createWrap.innerHTML =
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
      var del = h('button', { class: 'btn tiny danger', text: 'Delete' });
      del.addEventListener('click', function(){
        if (confirm('Delete code ' + c.code + '?')) act('/codes/delete', { code: c.code }, 'Deleted').then(function(){ PANELS.codes(panel); });
      });
      r.appendChild(copyBtn);
      r.appendChild(del);
      host.appendChild(r);
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

/* ---------- boot ---------- */
if (token){
  api('/stats').then(function(){ showConsole(); loadFeedInitial(); })
    .catch(function(){ localStorage.removeItem(KEY); token = ''; });
}
})();