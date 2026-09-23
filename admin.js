/* =====================================================================
   TRIBES — Admin economy control room (frontend DRAFT)
   ⚠ The password gate below is CLIENT-SIDE ONLY and offers NO real
   security. Before launch, put this behind real server-side auth and
   move economy writes to an authenticated API. For now it edits the
   same localStorage key ('tribes.econ') the game reads on boot.
===================================================================== */
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const el=(t,c,h)=>{const n=document.createElement(t);if(c)n.className=c;if(h!=null)n.innerHTML=h;return n;};

// ---- DRAFT password (replace with server-side auth) ----
const ADMIN_PW='firekeeper';

// mini starfield ambiance
(function stars(){const c=$('#starfield');if(!c)return;const x=c.getContext('2d');let W,H,st=[];
  function rs(){W=c.width=innerWidth;H=c.height=innerHeight;st=[];const n=Math.min(110,(W*H)/11000);
    for(let i=0;i<n;i++)st.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.3+.2,a:Math.random(),s:Math.random()*.02+.004});}
  function tick(){x.clearRect(0,0,W,H);for(const s of st){s.a+=s.s;const o=.3+Math.abs(Math.sin(s.a))*.7;
    x.globalAlpha=o;x.fillStyle=s.r>1?'#ffd9a0':'#cfe0ff';x.beginPath();x.arc(s.x,s.y,s.r,0,7);x.fill();}
    x.globalAlpha=1;requestAnimationFrame(tick);}
  addEventListener('resize',rs);rs();tick();})();

function toast(msg,kind=''){const t=el('div','toast '+kind,`<span class="t-ico">\u2713</span><span>${msg}</span>`);
  $('#toastRoot').appendChild(t);setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},2200);}

// ---- built-in defaults (mirror app.js catalog) ----
const DEF={ ashRate:30, foundEmber:25000, foundMembers:5,
  quests:[['feed','Feed the Fire',250],['ash','Gather the Ash',180],['stoke','Stoke the Great Pyre',300],['cry','Answer the War Cry',120],['invite','Call a Wanderer',500]],
  store:[['torch','Torch · Ember',1200],['totem','Totem · Ember',3200],['charm','Charm · Stars',75],['horn','Horn · Ember',2600],['auto','Eternal Flame · Stars',150]],
  relics:[['firestone','Firestone · Stars',120],['boneidol','Bone Idol · Stars',280],['sundisc','Sun Disc · Stars',640],['moonshard','Moon Shard · Stars',520]],
  packs:[['spark','Spark',100],['flame','Flame',550],['blaze','Blaze',1200],['inferno','Inferno',3200]],
  upgrades:[['hearth','Hearth Level',5000],['well','Ember Well',8000],['tower','Watchtower',12000],['forge','Great Forge',20000]],
  slogans:['While the fire burns, the tribe endures.','Ash to ember, ember to empire.','We keep the flame our fathers lit.','No cold night outlasts a stoked hearth.']
};

function loadEcon(){try{return JSON.parse(localStorage.getItem('tribes.econ')||'{}')||{};}catch(e){return {};}}
let ECON=loadEcon();
function gval(group,id,def){return (ECON[group]&&ECON[group][id]!=null)?ECON[group][id]:def;}
function cval(k,def){return ECON[k]!=null?ECON[k]:def;}
function section(title,rows){
  const s=el('section','card'); s.style.margin='0 0 14px';
  s.innerHTML=`<h3 style="font-family:Cinzel;margin:0 0 12px;color:#ffe6b8">${title}</h3>`;
  const g=el('div','a-grid');
  rows.forEach(r=>{
    g.appendChild(el('div','',`<label>${r.label}</label>${r.sub?`<div class="sub">${r.sub}</div>`:''}`));
    const inp=el('input'); inp.type='number'; inp.value=r.val; inp.placeholder='default';
    if(r.core)inp.dataset.core=r.core; else {inp.dataset.group=r.group;inp.dataset.id=r.id;}
    g.appendChild(inp);
  });
  s.appendChild(g); return s;
}

function renderPanel(){
  const p=$('#panel'); p.innerHTML='';
  p.appendChild(el('div','a-head',`<div><div class="a-title">TRIBES · Admin</div><span class="badge">● live economy</span></div><a class="btn btn-ghost" href="index.html">← Game</a>`));
  p.appendChild(el('p','muted','Changes write to the live economy the game reads on next launch. Clear a field to fall back to the built-in default.'));

  p.appendChild(section('Core Economy',[
    {label:'Ash rate',sub:'minutes per idle Ash',core:'ashRate',val:cval('ashRate',DEF.ashRate)},
    {label:'Found cost — Ember',sub:'Ember to found a band',core:'foundEmber',val:cval('foundEmber',DEF.foundEmber)},
    {label:'Found cost — Kin',sub:'members required',core:'foundMembers',val:cval('foundMembers',DEF.foundMembers)},
  ]));
  p.appendChild(section('Quest Rewards · Ember',DEF.quests.map(q=>({label:q[1],group:'quests',id:q[0],val:gval('quests',q[0],q[2])}))));
  p.appendChild(section('Store Prices',DEF.store.map(q=>({label:q[1],group:'store',id:q[0],val:gval('store',q[0],q[2])}))));
  p.appendChild(section('Relic Prices · Stars',DEF.relics.map(q=>({label:q[1],group:'relics',id:q[0],val:gval('relics',q[0],q[2])}))));
  p.appendChild(section('Star Packs · ⭐ granted',DEF.packs.map(q=>({label:q[1],group:'packs',id:q[0],val:gval('packs',q[0],q[2])}))));
  p.appendChild(section('Upgrade Base Costs · Ember',DEF.upgrades.map(q=>({label:q[1],group:'upgrades',id:q[0],val:gval('upgrades',q[0],q[2])}))));

  const sl=el('section','card'); sl.style.margin='0 0 14px';
  sl.innerHTML='<h3 style="font-family:Cinzel;margin:0 0 6px;color:#ffe6b8">Rotating Slogans</h3><p class="tiny" style="margin:0 0 8px">One line each.</p>';
  const ta=el('textarea'); ta.id='slogans'; ta.rows=5;
  ta.style.cssText='width:100%;padding:11px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:#fff;font-size:.85rem;resize:vertical;font-family:Inter';
  ta.value=((ECON.slogans&&ECON.slogans.length)?ECON.slogans:DEF.slogans).join('\n');
  sl.appendChild(ta); p.appendChild(sl);
}

function save(){
  const out={};
  $('#panel').querySelectorAll('input[data-core]').forEach(i=>{ if(i.value!=='')out[i.dataset.core]=Number(i.value); });
  $('#panel').querySelectorAll('input[data-group]').forEach(i=>{ if(i.value==='')return;
    const g=i.dataset.group; (out[g]=out[g]||{})[i.dataset.id]=Number(i.value); });
  const sl=$('#slogans').value.split('\n').map(s=>s.trim()).filter(Boolean);
  if(sl.length)out.slogans=sl;
  localStorage.setItem('tribes.econ',JSON.stringify(out));
  ECON=out; toast('Economy saved — live for players','good');
}
function resetAll(){ if(!confirm('Reset all economy overrides to built-in defaults?'))return;
  localStorage.removeItem('tribes.econ'); ECON={}; renderPanel(); toast('Reset to defaults','warn'); }

function mountSavebar(){
  const b=el('div','savebar');
  const rst=el('button','btn btn-ghost','Reset'); rst.id='resetBtn';
  const sb=el('button','btn btn-primary btn-shine','Save · Go live'); sb.id='saveBtn'; sb.style.flex='1';
  b.appendChild(rst); b.appendChild(sb); $('#savebarRoot').appendChild(b);
}

function unlock(){
  $('#gate').style.display='none'; $('#panel').style.display='block';
  renderPanel(); mountSavebar();
  $('#saveBtn').addEventListener('click',save);
  $('#resetBtn').addEventListener('click',resetAll);
  sessionStorage.setItem('tribes.admin','1');
}
function tryLogin(){
  if($('#pw').value===ADMIN_PW){ unlock(); }
  else{ const g=$('#gate'); if(g.animate)g.animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'translateX(0)'}],{duration:260});
    toast('Wrong password','warn'); }
}
$('#loginBtn').addEventListener('click',tryLogin);
$('#pw').addEventListener('keydown',e=>{if(e.key==='Enter')tryLogin();});
if(sessionStorage.getItem('tribes.admin')==='1')unlock();
