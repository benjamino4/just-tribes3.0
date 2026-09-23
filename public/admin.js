// TRIBES Warden Console — client. No inline handlers; all dynamic text escaped.
(function(){
'use strict';
var KEY='tribes_admin_token';
var token=localStorage.getItem(KEY)||'';

function esc(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c];});}
function fmt(n){return (Number(n)||0).toLocaleString('en-US');}
function $(s){return document.querySelector(s);}
function toast(msg,bad){var t=$('#toast');t.textContent=msg;t.className='toast show'+(bad?' bad':'');
  clearTimeout(t._t);t._t=setTimeout(function(){t.className='toast';},2600);}

function api(path,opts){
  opts=opts||{};opts.headers=opts.headers||{};
  opts.headers['X-Admin-Token']=token;
  if(opts.body){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(opts.body);}
  return fetch('/api/admin'+path,opts).then(function(r){
    return r.json().then(function(j){if(!r.ok||j.ok===false)throw new Error(j.error||('HTTP '+r.status));return j.data;});});
}
function act(path,body,msg){return api(path,{method:'POST',body:body}).then(function(d){
  toast(msg||'Done');return d;}).catch(function(e){toast(e.message,true);throw e;});}

// ---- login ----
function showConsole(){$('#login').hidden=true;$('#console').hidden=false;loadStats();refreshFlag();}
function doLogin(){
  var t=$('#token').value.trim();if(!t){return;}
  token=t;
  api('/stats').then(function(){localStorage.setItem(KEY,token);showConsole();})
    .catch(function(e){$('#loginErr').textContent=e.message==='bad admin token'?'That token was rejected.':e.message;});
}
$('#enterBtn').addEventListener('click',doLogin);
$('#token').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
$('#logoutBtn').addEventListener('click',function(){localStorage.removeItem(KEY);token='';location.reload();});

// ---- tabs ----
var loaders={stats:loadStats,players:function(){},tribes:loadTribes,wars:loadWars,
  payments:loadPayments,economy:loadEcon,control:function(){}};
document.querySelectorAll('.tab').forEach(function(b){
  b.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active');});
    document.querySelectorAll('.panel').forEach(function(x){x.classList.remove('active');});
    b.classList.add('active');
    var name=b.getAttribute('data-tab');
    $('#tab-'+name).classList.add('active');
    (loaders[name]||function(){})();
  });
});

function refreshFlag(){
  api('/econ').then(function(c){
    var on=Number(c.maintenance)?true:false;
    var f=$('#maintFlag');f.textContent=on?'\uD83D\uDD27 Maintenance ON':'\u25CF Live';
    f.className='pill'+(on?' hot':'');
  }).catch(function(){});
}

// ---- stats ----
function loadStats(){
  api('/stats').then(function(s){
    var cards=[
      ['Players',fmt(s.users.n),s.users.banned+' banned'],
      ['Ember in play',fmt(s.users.ember),''],
      ['Stars held',fmt(s.users.stars)+' \u2b50',''],
      ['Tribes',fmt(s.tribes.n),'Pyre '+fmt(s.tribes.pyre)],
      ['Loyalty',fmt(s.tribes.loyalty),''],
      ['Wars',fmt(s.wars.active),s.wars.total+' all-time'],
      ['Star tx',fmt(s.payments.startx||s.payments.starTx||0),fmt(s.payments.stars)+' \u2b50'],
      ['TON tx',fmt(s.payments.tontx||s.payments.tonTx||0),'']
    ];
    $('#statCards').innerHTML=cards.map(function(c){
      return '<div class="stat"><div class="k">'+esc(c[0])+'</div><div class="v">'+esc(c[1])+
        '</div><div class="sub">'+esc(c[2])+'</div></div>';}).join('');
    refreshFlag();
  }).catch(function(e){toast(e.message,true);});
}
// ---- players ----
function searchPlayers(){
  api('/players?q='+encodeURIComponent($('#pQuery').value.trim())).then(function(rows){
    $('#playerCard').innerHTML='';
    if(!rows.length){$('#playerList').innerHTML='<p class="muted">No players found.</p>';return;}
    $('#playerList').innerHTML=rows.map(function(r){
      return '<div class="item" data-pid="'+esc(r.id)+'"><div><div class="name">'+esc(r.first_name||'')+
        ' <span class="m">@'+esc(r.username||'?')+'</span></div><div class="m">#'+esc(r.id)+' \u00b7 '+esc(r.role)+
        ' \u00b7 '+fmt(r.ember)+'E \u00b7 '+fmt(r.stars)+'\u2b50 \u00b7 '+fmt(r.loyalty)+'\u2764</div></div>'+
        (r.banned?'<span class="badge ban">banned</span>':'<span class="badge">'+esc(r.role)+'</span>')+'</div>';
    }).join('');
    document.querySelectorAll('#playerList .item').forEach(function(it){
      it.addEventListener('click',function(){openPlayer(it.getAttribute('data-pid'));});});
  }).catch(function(e){toast(e.message,true);});
}
function openPlayer(id){
  api('/player/'+id).then(function(p){
    if(!p){toast('No such player',true);return;}
    var roles=['Toddler','Kin','Hunter','Elder','Head','Chief'];
    $('#playerCard').innerHTML='<div class="dcard"><h3>'+esc(p.first_name||'')+' <span class="m">@'+
      esc(p.username||'?')+'</span></h3><div class="kv">'+
      '<span class="l">ID</span><span>'+esc(p.id)+'</span>'+
      '<span class="l">Role</span><span>'+esc(p.role)+'</span>'+
      '<span class="l">Ember</span><span>'+fmt(p.ember)+'</span>'+
      '<span class="l">Stars</span><span>'+fmt(p.stars)+' \u2b50</span>'+
      '<span class="l">Loyalty</span><span>'+fmt(p.loyalty)+'</span>'+
      '<span class="l">Streak</span><span>'+esc(p.streak)+'</span>'+
      '<span class="l">Tribe</span><span>'+esc(p.tribe_name||'\u2014')+'</span>'+
      '<span class="l">Banned</span><span>'+(p.banned?('yes \u2014 '+esc(p.ban_reason||'')):'no')+'</span></div>'+
      '<div class="acts">'+
        '<input id="gA" type="number" placeholder="amount"><select id="gK"><option>ember</option><option>stars</option><option>loyalty</option></select>'+
        '<button class="btn tiny" data-a="grant">Grant</button>'+
        '<select id="rS">'+roles.map(function(x){return '<option'+(x===p.role?' selected':'')+'>'+x+'</option>';}).join('')+'</select>'+
        '<button class="btn tiny" data-a="role">Set role</button>'+
        '<input id="lV" type="number" placeholder="loyalty"><button class="btn tiny" data-a="loyalty">Set loyalty</button>'+
        (p.banned?'<button class="btn tiny" data-a="unban">Unban</button>':'<input id="bR" placeholder="reason"><button class="btn tiny danger" data-a="ban">Ban</button>')+
      '</div></div>';
    var pid=p.id;
    $('#playerCard').querySelectorAll('[data-a]').forEach(function(btn){
      btn.addEventListener('click',function(){var a=btn.getAttribute('data-a');
        if(a==='grant')act('/grant',{id:pid,kind:$('#gK').value,amount:$('#gA').value},'Granted').then(function(){openPlayer(pid);});
        else if(a==='role')act('/role',{id:pid,role:$('#rS').value},'Role set').then(function(){openPlayer(pid);});
        else if(a==='loyalty')act('/loyalty',{id:pid,value:$('#lV').value},'Loyalty set').then(function(){openPlayer(pid);});
        else if(a==='ban')act('/ban',{id:pid,reason:($('#bR')||{}).value||''},'Banned').then(function(){openPlayer(pid);});
        else if(a==='unban')act('/unban',{id:pid},'Unbanned').then(function(){openPlayer(pid);});
      });});
  }).catch(function(e){toast(e.message,true);});
}
$('#pSearch').addEventListener('click',searchPlayers);
$('#pQuery').addEventListener('keydown',function(e){if(e.key==='Enter')searchPlayers();});

// ---- tribes ----
function loadTribes(){
  api('/tribes').then(function(rows){
    $('#tribeCard').innerHTML='';
    if(!rows.length){$('#tribeList').innerHTML='<p class="muted">No tribes yet.</p>';return;}
    $('#tribeList').innerHTML=rows.map(function(t){
      return '<div class="item" data-tid="'+esc(t.id)+'"><div><div class="name">'+esc(t.name)+
        '</div><div class="m">#'+esc(t.id)+' \u00b7 '+fmt(t.members)+' kin \u00b7 '+fmt(t.loyalty_total)+
        '\u2764 \u00b7 Pyre '+fmt(t.treasury)+'</div></div><span class="badge win">'+esc(t.wins)+'W/'+esc(t.losses)+'L</span></div>';
    }).join('');
    document.querySelectorAll('#tribeList .item').forEach(function(it){
      it.addEventListener('click',function(){openTribe(it.getAttribute('data-tid'));});});
  }).catch(function(e){toast(e.message,true);});
}
function openTribe(id){
  api('/tribe/'+id).then(function(t){
    if(!t){toast('No such tribe',true);return;}
    var roster=(t.roster||[]).map(function(m){return '<div class="m">\u2022 #'+esc(m.id)+' '+esc(m.first_name||'')+
      ' ('+esc(m.role)+', '+fmt(m.loyalty)+'\u2764)</div>';}).join('');
    $('#tribeCard').innerHTML='<div class="dcard"><h3>'+esc(t.name)+'</h3><div class="kv">'+
      '<span class="l">ID</span><span>'+esc(t.id)+'</span>'+
      '<span class="l">Kin</span><span>'+fmt(t.members)+'</span>'+
      '<span class="l">Loyalty</span><span>'+fmt(t.loyalty_total)+'</span>'+
      '<span class="l">Pyre</span><span>'+fmt(t.treasury)+'</span>'+
      '<span class="l">Record</span><span>'+esc(t.wins)+'W / '+esc(t.losses)+'L</span></div>'+
      '<div class="acts"><input id="tN" placeholder="new name"><button class="btn tiny" data-a="rename">Rename</button>'+
      '<input id="tT" type="number" placeholder="treasury"><button class="btn tiny" data-a="treasury">Set Pyre</button>'+
      '<button class="btn tiny danger" data-a="disband">Disband</button></div>'+
      (roster?'<div style="margin-top:12px">'+roster+'</div>':'')+'</div>';
    var tid=t.id;
    $('#tribeCard').querySelectorAll('[data-a]').forEach(function(btn){
      btn.addEventListener('click',function(){var a=btn.getAttribute('data-a');
        if(a==='rename')act('/tribe/rename',{id:tid,name:$('#tN').value},'Renamed').then(loadTribes);
        else if(a==='treasury')act('/tribe/treasury',{id:tid,value:$('#tT').value},'Pyre set').then(function(){openTribe(tid);});
        else if(a==='disband'){if(confirm('Disband this tribe? Members are freed.'))act('/tribe/disband',{id:tid},'Disbanded').then(loadTribes);}
      });});
  }).catch(function(e){toast(e.message,true);});
}

// ---- wars ----
function loadWars(){
  api('/wars').then(function(rows){
    if(!rows.length){$('#warList').innerHTML='<p class="muted">No active wars.</p>';return;}
    $('#warList').innerHTML=rows.map(function(w){
      return '<div class="item" style="cursor:default"><div><div class="name">'+esc(w.a_name)+
        ' <span class="m">'+fmt(w.attacker_score)+' vs '+fmt(w.defender_score)+'</span> '+esc(w.d_name)+
        '</div><div class="m">war #'+esc(w.id)+' \u00b7 '+esc(w.challenge_id)+' \u00b7 goal '+fmt(w.goal)+'</div></div>'+
        '<div style="display:flex;gap:6px"><button class="btn tiny" data-rw="'+esc(w.id)+'">Resolve</button>'+
        '<button class="btn tiny danger" data-cw="'+esc(w.id)+'">Cancel</button></div></div>';
    }).join('');
    $('#warList').querySelectorAll('[data-rw]').forEach(function(b){b.addEventListener('click',function(){
      act('/war/resolve',{id:b.getAttribute('data-rw')},'Resolved').then(loadWars);});});
    $('#warList').querySelectorAll('[data-cw]').forEach(function(b){b.addEventListener('click',function(){
      act('/war/cancel',{id:b.getAttribute('data-cw')},'Cancelled').then(loadWars);});});
  }).catch(function(e){toast(e.message,true);});
}
$('#waStart').addEventListener('click',function(){
  act('/war/start',{attacker:$('#waAtk').value,defender:$('#waDef').value},'War started').then(loadWars);});

// ---- payments ----
function loadPayments(){
  api('/payments').then(function(rows){
    if(!rows.length){$('#payList').innerHTML='<p class="muted">No payments.</p>';return;}
    $('#payList').innerHTML=rows.map(function(p){
      return '<div class="item" style="cursor:default"><div><div class="name">'+esc(p.kind)+' '+fmt(p.amount)+
        (p.currency==='XTR'?' \u2b50':'')+'</div><div class="m">user '+esc(p.user_id)+' \u00b7 '+esc(p.status)+
        ' \u00b7 '+esc(p.charge_id)+'</div></div>'+(p.refunded?'<span class="badge ban">refunded</span>':
        '<button class="btn tiny" data-rf="'+esc(p.charge_id)+'">Refund</button>')+'</div>';
    }).join('');
    $('#payList').querySelectorAll('[data-rf]').forEach(function(b){b.addEventListener('click',function(){
      if(confirm('Refund this payment?'))act('/refund',{chargeId:b.getAttribute('data-rf')},'Refunded').then(loadPayments);});});
  }).catch(function(e){toast(e.message,true);});
}

// ---- economy ----
function loadEcon(){
  api('/econ').then(function(c){
    var defs=c._defaults||{};
    $('#econGrid').innerHTML=Object.keys(defs).map(function(k){
      return '<div class="efield"><label>'+esc(k)+'</label><div class="def">default '+esc(defs[k])+
        '</div><div class="er"><input value="'+esc(c[k])+'" data-k="'+esc(k)+'">'+
        '<button class="btn tiny" data-save="'+esc(k)+'">Save</button></div></div>';
    }).join('');
    $('#econGrid').querySelectorAll('[data-save]').forEach(function(b){b.addEventListener('click',function(){
      var k=b.getAttribute('data-save');var inp=$('#econGrid [data-k="'+k+'"]');
      act('/econ',{key:k,value:inp.value},k+' saved').then(refreshFlag);});});
  }).catch(function(e){toast(e.message,true);});
}
$('#econReset').addEventListener('click',function(){
  if(confirm('Reset all economy values to defaults?'))act('/econ/reset',{},'Economy reset').then(loadEcon);});

// ---- control ----
$('#maintOn').addEventListener('click',function(){act('/maintenance',{on:'on'},'Maintenance ON').then(refreshFlag);});
$('#maintOff').addEventListener('click',function(){act('/maintenance',{on:'off'},'Maintenance off').then(refreshFlag);});
$('#bcSend').addEventListener('click',function(){
  var txt=$('#bcText').value.trim();if(!txt){toast('Write a message first',true);return;}
  if(confirm('Send this to every player?'))act('/broadcast',{text:txt},'Broadcast sent').then(function(d){
    toast('Sent to '+fmt(d.sent)+' players');$('#bcText').value='';});});
$('#wipeBtn').addEventListener('click',function(){
  if(confirm('Wipe the season? Loyalty and war records reset for everyone.'))
    act('/wipeseason',{},'Season wiped');});
// __C1__
if(token){api('/stats').then(showConsole).catch(function(){localStorage.removeItem(KEY);token='';});}
})();
