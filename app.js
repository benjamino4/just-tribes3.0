/* =====================================================================
   TRIBES — Telegram Mini App (frontend prototype, mock economy)
   All state persists to localStorage. TON Connect / Stars are stubbed
   with realistic flows so you can wire real backends later.
===================================================================== */
'use strict';
const TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
try{ if(TG){ TG.ready(); TG.expand(); TG.setHeaderColor && TG.setHeaderColor('#0a0612'); } }catch(e){}

/* ---------- tiny helpers ---------- */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const el = (t,c,h)=>{const n=document.createElement(t); if(c)n.className=c; if(h!=null)n.innerHTML=h; return n;};
const fmt = n => n>=1e6 ? (n/1e6).toFixed(2)+'M' : n>=1e3 ? (n/1e3).toFixed(1)+'k' : Math.floor(n).toLocaleString();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>Date.now();
const haptic=(type='light')=>{try{TG&&TG.HapticFeedback&&TG.HapticFeedback.impactOccurred(type);}catch(e){}};
const notifH=(t='success')=>{try{TG&&TG.HapticFeedback&&TG.HapticFeedback.notificationOccurred(t);}catch(e){}};

function toast(msg,kind='',ico='!'){
  const t=el('div','toast '+kind, `<span class="t-ico">${ico}</span><span>${msg}</span>`);
  $('#toastRoot').appendChild(t);
  setTimeout(()=>{t.classList.add('out');setTimeout(()=>t.remove(),320);},2400);
}
function fxPop(text,x,y){
  const p=el('div','fx-pop',text); p.style.left=x+'px'; p.style.top=y+'px';
  document.body.appendChild(p); setTimeout(()=>p.remove(),900);
}

/* ---------- SVG icon library (drawn in code) ---------- */
const ICON={
  fire:'<svg viewBox="0 0 24 24"><path d="M12 3c1 4-3 5-3 9a3 3 0 0 0 6 0c0-2-1-3-1-4 2 1 3 3 3 6a5 5 0 1 1-10 0c0-4 4-5 5-11z"/></svg>',
  tribe:'<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 5-5s5 2 5 5M13 19c.5-2 2-4 4.5-4s4.5 2 4.5 5"/></svg>',
  ranks:'<svg viewBox="0 0 24 24"><path d="M6 9V4h12v5a6 6 0 0 1-12 0zM4 5H2v2a3 3 0 0 0 3 3M20 5h2v2a3 3 0 0 1-3 3M9 20h6M12 15v5"/></svg>',
  lands:'<svg viewBox="0 0 24 24"><path d="M3 20l6-11 4 6 3-5 5 10z"/></svg>',
  sky:'<svg viewBox="0 0 24 24"><path d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>',
  hearth:'<svg viewBox="0 0 24 24"><path d="M4 20V9l8-5 8 5v11M9 20v-6h6v6"/></svg>',
  well:'<svg viewBox="0 0 24 24"><path d="M5 9l7-4 7 4M6 9v11h12V9M9 20v-6a3 3 0 0 1 6 0v6"/></svg>',
  tower:'<svg viewBox="0 0 24 24"><path d="M8 21V8l4-5 4 5v13M8 8h8M6 21h12M10 21v-4h4v4"/></svg>',
  forge:'<svg viewBox="0 0 24 24"><path d="M4 15h9l3-3 4 2-2 4H4zM7 15V9a5 5 0 0 1 10 0"/></svg>'
};
/* ---------- game constants ---------- */
const STAGES=['Village','Town','Dynasty','Empire','Kingdom'];
const ROLES=[ // index = rank power
  {key:'toddler',name:'Toddler', power:0, perks:'Newcomer to the fire'},
  {key:'kin',    name:'Kin',     power:1, perks:'Can donate & chat'},
  {key:'hunter', name:'Hunter',  power:2, perks:'War Cry participant'},
  {key:'elder',  name:'Elder',   power:3, perks:'Vote weight x2, mentor Toddlers'},
  {key:'head',   name:'Head',    power:4, perks:'Edit Cave Wall, kick Kin, set Ember tax'},
  {key:'chief',  name:'Chief',   power:5, perks:'All powers — elected, can be recalled'}
];
// 40 real Neolithic / Paleolithic culture names
const TRIBE_NAMES=['Clovis','Natufian','Gravettian','Magdalenian','Solutrean','Aurignacian',
  'Jōmon','Yamnaya','Halaf','Dorset','Folsom','Mousterian','Hamangia','Cucuteni','Unetice',
  'Beaker','Corded','Samarra','Ubaid','Badari','Sunghir','Kebaran','Ahmarian','Azilian',
  'Maglemose','Ertebolle','Botai','Afanasievo','Sintashta','Trypillia','Windmill','Longshan',
  'Yangshao','Hongshan','Majiayao','Peiligang','Dawenkou','Sredny','Vinca','Starcevo'];

// totem emblems (SVG) — each tribe gets a unique crest
const TOTEMS=[
  '<path d="M20 60c0-18 8-30 30-30s30 12 30 30c0 6-6 8-10 4-6 8-34 8-40 0-4 4-10 2-10-4z"/><circle cx="38" cy="46" r="3"/><circle cx="62" cy="46" r="3"/>',/*mammoth*/
  '<path d="M25 70l25-45 25 45M35 55h30"/><circle cx="50" cy="20" r="6"/>',/*mountain*/
  '<circle cx="50" cy="45" r="16"/><path d="M50 12v10M50 68v10M17 45h10M73 45h10M28 23l7 7M65 60l7 7M72 23l-7 7M35 60l-7 7"/>',/*sun*/
  '<path d="M50 20c14 0 22 20 8 30 14 4 10 26-8 26s-22-22-8-26c-14-10-6-30 8-30z"/>',/*spiral serpent*/
  '<path d="M50 22c-4 8-16 6-16 18s10 16 16 26c6-10 16-14 16-26s-12-10-16-18z"/><path d="M40 40l-12-6M60 40l12-6"/>',/*antler*/
  '<path d="M28 68c8-6 8-20 22-20s14 14 22 20M50 30v18M40 24l10 6 10-6"/>',/*handprint*/
  '<path d="M20 45c14-14 46-14 60 0-14 14-46 14-60 0zM75 40c4 3 4 7 0 10"/><circle cx="35" cy="45" r="3"/>',/*fish*/
  '<path d="M50 22l8 16 18 2-13 12 4 18-17-9-17 9 4-18-13-12 18-2z"/>',/*star*/
  '<path d="M50 24c-10 0-16 8-16 18 0 14 16 26 16 26s16-12 16-26c0-10-6-18-16-18zM50 34a6 6 0 100 12 6 6 0 000-12z"/>',/*eye*/
  '<path d="M50 20v50M50 34l-16-10M50 34l16-10M50 50l-14 12M50 50l14 12"/>'/*tree*/
];
function hashStr(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
// deterministic unique theme per tribe: hue + totem + motto
const MOTTOS=['While the fire burns, we endure.','Ash to ember, ember to empire.','No cold night outlasts our hearth.',
  'We keep the flame our fathers lit.','One fire, one blood.','The bold feed the flame.','Rise from the stone.',
  'Our smoke reaches the sky.','Bound by the burning circle.','The hearth remembers.'];
function tribeTheme(name){
  const h=hashStr(name);
  // curated fire-safe hue offsets (deep red → gold → magenta → blue flame; no muddy greens)
  const HUES=[0,-20,-40,22,42,-55,58,300,322,342,268,246];
  return { hue:HUES[h%HUES.length], totem:TOTEMS[h%TOTEMS.length], motto:MOTTOS[h%MOTTOS.length] };
}
function applyTheme(name){
  const t=tribeTheme(name);
  document.documentElement.style.setProperty('--thue', t.hue+'deg');
  return t;
}
function tribeCrest(name){
  const t=tribeTheme(name);
  return `<svg class="crest" viewBox="0 0 100 110"><path d="M50 4l40 14v34c0 30-20 46-40 54C30 98 10 82 10 52V18z"
    fill="none" stroke="url(#gFlame)" stroke-width="3"/><g fill="none" stroke="url(#gFlame)" stroke-width="3"
    stroke-linecap="round" stroke-linejoin="round" transform="translate(20,16) scale(.6)">${t.totem}</g></svg>`;
}

const FOUND_COST={ember:25000, members:5, stars:0}; // to found a band

const QUESTS=[
  {id:'feed', t:'Feed the Fire',        d:'Daily check-in',            r:250, ico:'FIRE'},
  {id:'ash',  t:'Gather the Ash',       d:'Collect idle Ember 3×',    r:180, ico:'ASH'},
  {id:'stoke',t:'Stoke the Great Pyre',  d:'Donate 500+ Ember',        r:300, ico:'PYRE'},
  {id:'cry',  t:'Answer the War Cry',    d:'Open the Tribe screen',    r:120, ico:'WAR'},
  {id:'invite',t:'Call a Wanderer',      d:'Share your invite link',   r:500, ico:'INV'}
];

const STORE=[
  {id:'torch', name:'Torch',  desc:'+15% Ember for 4h',      cost:1200, cur:'ember', art:'torch'},
  {id:'totem', name:'Totem',  desc:'+1 idle Ash cap',        cost:3200, cur:'ember', art:'totem'},
  {id:'charm', name:'Charm',  desc:'Protect streak x1',      cost:75,   cur:'star',  art:'charm'},
  {id:'horn',  name:'Horn',   desc:'Boost War Cry reach',    cost:2600, cur:'ember', art:'horn'},
  {id:'auto',  name:'Eternal Flame', desc:'Auto-collect Ash for 7 days', cost:150, cur:'star', art:'flame', big:true},
];
const RELICS=[
  {id:'firestone',name:'Firestone', rar:'rare',  eff:'+10% idle Ember',        cost:120, cur:'star', starter:true, art:'firestone'},
  {id:'boneidol', name:'Bone Idol', rar:'epic',  eff:'+5% tribe loyalty share', cost:280, cur:'star', art:'idol'},
  {id:'sundisc',  name:'Sun Disc',  rar:'legend',eff:'+25% Ash cap & offline 12h',cost:640,cur:'star', art:'sun'},
  {id:'moonshard',name:'Moon Shard',rar:'legend',eff:'2× streak rewards',       cost:520, cur:'star', art:'moon'},
];
const STARPACKS=[
  {id:'spark', name:'Spark',  stars:100,  bonus:0,  price:'$1.99'},
  {id:'flame', name:'Flame',  stars:550,  bonus:10, price:'$9.99'},
  {id:'blaze', name:'Blaze',  stars:1200, bonus:20, price:'$19.99'},
  {id:'inferno',name:'Inferno',stars:3200,bonus:35, price:'$49.99'},
];
const UPGRADES=[
  {id:'hearth', name:'Hearth Level', ico:'hearth', desc:'Base Ember output',   base:5000},
  {id:'well',   name:'Ember Well',   ico:'well',   desc:'Idle Ash capacity',   base:8000},
  {id:'tower',  name:'Watchtower',   ico:'tower',  desc:'Offline duration',    base:12000},
  {id:'forge',  name:'Great Forge',  ico:'forge',  desc:'Relic effect power',   base:20000},
];
const SLOGANS=[
  'While the fire burns, the tribe endures.',
  'Ash to ember, ember to empire.',
  'We keep the flame our fathers lit.',
  'No cold night outlasts a stoked hearth.'
];
/* ---------- persistent state ---------- */
const SAVE_KEY='emberfall.v1';
const DEFAULT={
  name:(TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user&&TG.initDataUnsafe.user.first_name)||'Wanderer',
  ember:8420, stars:120, role:'hunter', loyalty:640,
  streak:4, lastCheckin:0, ashReadyAt:0, ashCap:3, ashRate:30, // minutes per ash unit
  autoUntil:0, wallet:null, walletName:null,
  settlement:1, // 0..4 stage index
  quests:{}, owned:['firestone'], pass:2, bpPremium:false,
  tribe:{
    name:'Aurignacian', level:7, members:38, avgLoyalty:71, pyre:184300, pyreGoal:250000,
    slogan:SLOGANS[0],
    up:{hearth:6,well:4,tower:3,forge:2}
  },
  refInvited:3
};
let S = load();
function load(){ try{const r=JSON.parse(localStorage.getItem(SAVE_KEY)); return r?{...structuredClone(DEFAULT),...r}:structuredClone(DEFAULT);}catch(e){return structuredClone(DEFAULT);} }
function save(){ try{localStorage.setItem(SAVE_KEY,JSON.stringify(S));}catch(e){} }

/* ---------- mock social data ---------- */
const FIRST=['Ugg','Mara','Bok','Tala','Grum','Ela','Rok','Nima','Dax','Sable','Vor','Ky','Ash','Fen','Oro'];
function seedMembers(n){
  const arr=[]; for(let i=0;i<n;i++){
    const nm=FIRST[i%FIRST.length]+(i>=FIRST.length?('-'+((i/FIRST.length|0)+1)):'');
    arr.push({name:nm, role:ROLES[clamp(5-Math.floor(i/6),1,5)].key,
      ember:Math.round(9000/(i+1)+Math.random()*1200),
      loyalty:clamp(96-i*2+((Math.random()*10)|0),20,99),
      online:Math.random()>.45});
  }
  return arr;
}
let MEMBERS=seedMembers(S.tribe.members);
const WORLD_TRIBES=TRIBE_NAMES.map((n,i)=>({name:n, lvl:12-i%9, avg:clamp(94-i*6+((Math.random()*8)|0),35,96), members:60-i*4}))
  .sort((a,b)=>b.avg-a.avg);
let CHAT=[
  {who:'Chief Ugg', me:false, text:'Stoke the Pyre, kin. War with Clovis at dusk.'},
  {who:'Mara', me:false, text:'Donated 2k Ember. For the fire!'},
  {who:'Elder Tala', me:false, text:'Toddlers — collect your Ash before it caps.'}
];

/* ---------- starfield canvas ---------- */
(function stars(){
  const c=$('#starfield'), x=c.getContext('2d'); let W,H,st=[];
  function rs(){W=c.width=innerWidth;H=c.height=innerHeight;st=[];
    const n=Math.min(140,(W*H)/9000);
    for(let i=0;i<n;i++)st.push({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.2,
      a:Math.random(),s:Math.random()*.02+.004});}
  function tick(){x.clearRect(0,0,W,H);
    for(const s of st){s.a+=s.s;const o=.3+Math.abs(Math.sin(s.a))*.7;
      x.globalAlpha=o;x.fillStyle=s.r>1?'#ffd9a0':'#cfe0ff';
      x.beginPath();x.arc(s.x,s.y,s.r,0,7);x.fill();}
    x.globalAlpha=1;requestAnimationFrame(tick);}
  addEventListener('resize',rs);rs();tick();
})();
/* ---------- SVG art factories ---------- */
function flameSVG(cls=''){return `<svg class="${cls}" viewBox="0 0 120 160"><use href="#flameSvg"/></svg>`;}
const ART={
  torch:'<svg viewBox="0 0 60 80"><rect x="27" y="30" width="6" height="46" rx="3" fill="#6b4326"/><path d="M30 4c5 12-8 14-8 24a8 8 0 0 0 16 0c0-6-4-8-8-24z" fill="url(#gFlame)"/></svg>',
  totem:'<svg viewBox="0 0 60 80"><rect x="18" y="8" width="24" height="64" rx="6" fill="#5a3a24"/><circle cx="30" cy="24" r="7" fill="#ffb03a"/><path d="M20 44h20M20 56h20" stroke="#ffd77a" stroke-width="3"/></svg>',
  charm:'<svg viewBox="0 0 60 80"><path d="M30 12l6 14 15 2-11 10 3 15-13-8-13 8 3-15L9 28l15-2z" fill="url(#gFlame)"/></svg>',
  horn:'<svg viewBox="0 0 60 80"><path d="M8 52c14 6 40 4 46-24-2 20-18 30-30 30-8 0-14-3-16-6z" fill="#e8d7b5"/></svg>',
  flame:'<svg viewBox="0 0 60 80"><path d="M30 6c8 18-12 22-12 38a12 12 0 0 0 24 0c0-8-4-12-12-38z" fill="url(#gFlame)"/><circle cx="30" cy="48" r="7" fill="#fff6d6"/></svg>',
  firestone:'<svg viewBox="0 0 60 80"><polygon points="30,8 50,30 40,64 20,64 10,30" fill="url(#gFlame)"/><polygon points="30,20 40,32 34,54 26,54" fill="#fff2cf" opacity=".7"/></svg>',
  idol:'<svg viewBox="0 0 60 80"><rect x="20" y="20" width="20" height="52" rx="8" fill="#d8c39a"/><circle cx="30" cy="18" r="11" fill="#e8d7b5"/><circle cx="26" cy="17" r="2" fill="#3a2416"/><circle cx="34" cy="17" r="2" fill="#3a2416"/></svg>',
  sun:'<svg viewBox="0 0 60 80"><g fill="url(#gFlame)"><circle cx="30" cy="40" r="16"/><g stroke="#ffd77a" stroke-width="3"><path d="M30 8v10M30 62v10M8 40h10M42 40h10M14 24l7 7M46 56l-7-7M46 24l-7 7M14 56l7-7"/></g></g></svg>',
  moon:'<svg viewBox="0 0 60 80"><path d="M40 12a24 24 0 1 0 0 56 20 20 0 0 1 0-56z" fill="#cfe0ff"/><circle cx="22" cy="30" r="3" fill="#9fb4dd"/></svg>'
};
function crestSVG(){ return tribeCrest(S.tribe.name); }

function settlementSVG(stage){
  const huts=stage+2, w=200, parts=[];
  for(let i=0;i<huts;i++){
    const x=20+i*(160/Math.max(1,huts-1)), y=60-(stage*3), h=26+stage*4;
    const grand = stage>=3;
    parts.push(`<polygon points="${x-16},${y+h} ${x},${y} ${x+16},${y+h}" fill="${grand?'#ff8a3a':'#c98a4a'}" opacity=".95"/>`);
    parts.push(`<rect x="${x-14}" y="${y+h}" width="28" height="${h*0.5}" fill="${grand?'#8a5a2a':'#7a4e28'}"/>`);
    if(stage>=2) parts.push(`<rect x="${x-3}" y="${y+h+6}" width="6" height="${h*0.4}" fill="#2a1a10"/>`);
  }
  if(stage>=4) parts.push('<polygon points="100,6 120,50 80,50" fill="#ffd77a"/><rect x="94" y="50" width="12" height="40" fill="#b98a3a"/>');
  return `<svg viewBox="0 0 ${w} 110" class="set-huts">${parts.join('')}</svg>`;
}

/* ---------- economy ---------- */
function addEmber(n){ S.ember=Math.max(0,S.ember+n); save(); paintBalances(); }
function addStars(n){ S.stars=Math.max(0,S.stars+n); save(); paintBalances(); }
function paintBalances(){ $('#emberBal').textContent=fmt(S.ember); $('#starBal').textContent=fmt(S.stars); }

function ashPending(){
  if(!S.ashReadyAt) return 0;
  const auto = S.autoUntil>now();
  const per = S.ashRate*60*1000;
  const cap = S.ashCap + (S.owned.includes('sundisc')?2:0);
  const units = Math.floor((now()-S.ashReadyAt)/per);
  return clamp(units, 0, auto?cap:cap);
}
function ashValue(){ return 420 + S.tribe.up.hearth*140; } // ember per ash unit
/* =====================================================================
   SCREEN: FIRE (home)
===================================================================== */
function roleObj(k){return ROLES.find(r=>r.key===k)||ROLES[0];}
function renderFire(){
  const scr=$('#screen-fire'); const r=roleObj(S.role);
  const canCheck = now()-S.lastCheckin > 20*60*60*1000 || S.lastCheckin===0;
  const pend=ashPending(); const cap=S.ashCap+(S.owned.includes('sundisc')?2:0);
  const streakPct=clamp((S.streak%7)/7*100,4,100);
  const emberDots=[...Array(9)].map((_,i)=>
    `<span class="ember-dot" style="left:${30+i*10}%;--dx:${(Math.random()*30-15)|0}px;animation-duration:${2.4+Math.random()*2}s;animation-delay:${Math.random()*3}s"></span>`).join('');
  scr.innerHTML=`
    <div class="hero stagger">
      <div class="hero-role">
        <div class="role-badge">
          <div class="ring"><span>${r.name[0]}</span></div>
          <div class="role-meta"><b>${S.name}</b><span>${r.name} · ${S.tribe.name}</span></div>
        </div>
        <span class="pill rank">Loyalty ${S.loyalty}</span>
      </div>
      <div class="campfire">
        <div class="cf-glow"></div>
        <div class="embers">${emberDots}</div>
        <div class="cf-flames">
          ${flameSVG('fl-1')}${flameSVG('fl-2')}${flameSVG('fl-3')}
          <div class="cf-logs"><i></i><i></i></div>
        </div>
      </div>
      <button id="feedBtn" class="btn btn-primary btn-block btn-shine ${canCheck?'':''}" ${canCheck?'':'disabled'}>
        ${canCheck?'▲ Feed the Fire · Day '+(S.streak+1):'Fire fed — come back tomorrow'}
      </button>
    </div>

    <div class="grid2 mt3">
      <div class="card glow stagger" style="display:grid;place-items:center;gap:6px">
        <div class="hearth-ring">
          <svg width="110" height="110"><circle class="hr-track" cx="55" cy="55" r="48"/><circle class="hr-val" cx="55" cy="55" r="48" style="stroke-dashoffset:${302-302*streakPct/100}"/></svg>
          <div class="hr-c"><b>${S.streak}</b><span>day streak</span></div>
        </div>
        <div class="tiny center">Next milestone: <b class="gold-txt">${nextMilestone(S.streak)} days</b></div>
      </div>
      <div class="card glow stagger">
        <div class="card-title">Gather the Ash</div>
        <p class="tiny">Idle Ember pools every ${S.ashRate} min. Collect before it caps.</p>
        <div class="ash-meter mt2">
          <div class="ash-orb ${pend>=cap?'full':''}"><i></i></div>
          <div class="flex1">
            <div class="row spread"><b class="ember-txt">${pend}/${cap}</b><span class="tiny">≈ ${fmt(pend*ashValue())} Ember</span></div>
            <div class="bar mt2"><i style="width:${pend/cap*100}%"></i></div>
          </div>
        </div>
        <button id="collectBtn" class="btn ${pend>0?'btn-gold':'btn-ghost'} btn-block mt3" ${pend>0?'':'disabled'}>Collect Ash</button>
        ${S.autoUntil>now()?'<div class="tiny center mt2">Eternal Flame active · auto-collecting</div>':'<button id="autoBtn" class="tiny center mt2" style="width:100%;color:#ffb03a;font-weight:700">⚡ Auto-collect for 7 days → Store</button>'}
      </div>
    </div>

    <div class="sec-head stagger"><h2>Daily Quests</h2><span class="hint">resets in ${hoursLeft()}h</span></div>
    <div class="stagger" id="questList"></div>

    <div class="sec-head stagger"><h2>Cave Wall</h2><span class="hint">${S.tribe.name}</span></div>
    <div class="cavewall stagger"><p>${S.tribe.slogan}</p></div>
    <div class="mt3"></div>`;
  renderQuests();
  $('#feedBtn').onclick=feedFire;
  const cb=$('#collectBtn'); if(cb) cb.onclick=collectAsh;
  const ab=$('#autoBtn'); if(ab) ab.onclick=()=>go('store');
}
function nextMilestone(s){return [7,14,30,60,100,180,365].find(m=>m>s)||365;}
function hoursLeft(){const d=new Date();return 23-d.getHours();}
function renderQuests(){
  const box=$('#questList'); if(!box) return; box.innerHTML='';
  QUESTS.forEach(q=>{
    const done=S.quests[q.id];
    const row=el('div','qrow'+(done?' done':''),
      `<div class="q-ico">${q.ico}</div>
       <div class="q-body"><b>${q.t}</b><div class="tiny">${q.d}</div></div>
       <div class="q-reward">${done?'✓ Claimed':'+'+q.r}</div>`);
    if(!done) row.onclick=(e)=>completeQuest(q,e);
    box.appendChild(row);
  });
}
function completeQuest(q,e){
  if(q.id==='cry'){ go('tribe'); }
  if(q.id==='invite'){ inviteFlow(); }
  S.quests[q.id]=true; addEmber(q.r); save();
  notifH('success'); toast(`Quest complete: +${q.r} Ember`,'good','✓');
  const r=e.currentTarget.getBoundingClientRect(); fxPop('+'+q.r,r.right-50,r.top);
  renderQuests();
}
function feedFire(e){
  const gap=now()-S.lastCheckin;
  const broke = S.lastCheckin>0 && gap>48*60*60*1000 && !S.owned.includes('charm');
  S.streak = broke?1:S.streak+1;
  S.lastCheckin=now();
  const base=250, bonus=Math.min(S.streak*25,500);
  const mult=S.owned.includes('moonshard')?2:1;
  const gain=(base+bonus)*mult;
  addEmber(gain); S.loyalty=clamp(S.loyalty+2,0,99); S.quests['feed']=true; save();
  notifH('success'); haptic('medium');
  const rr=e.currentTarget.getBoundingClientRect(); fxPop('+'+gain+' 🔥',rr.left+rr.width/2-30,rr.top-10);
  // milestone reward
  if([7,14,30,60,100].includes(S.streak)) milestoneReward(S.streak);
  else toast(`Fire fed · ${S.streak}-day streak · +${gain} Ember`,'good','▲');
  renderFire();
}
function milestoneReward(days){
  const map={7:{stars:20,txt:'Charm relic slot'},14:{ember:5000},30:{stars:75,txt:'Rare relic chest'},
    60:{stars:150},100:{stars:400,txt:'Legendary Sun Disc'}};
  const rw=map[days]||{ember:2000};
  if(rw.stars) addStars(rw.stars); if(rw.ember) addEmber(rw.ember);
  if(days===100 && !S.owned.includes('sundisc')) S.owned.push('sundisc');
  save();
  openModal(`<h3>🌟 ${days}-Day Streak!</h3><p class="sub">The fire has never gone cold.</p>
    <div class="sharecard"><div class="sc-crest">${crestSVG()}</div>
      <h4>${days} Days</h4><div class="sc-tribe">UNBROKEN FLAME</div>
      <div class="tiny">Reward: ${rw.stars?rw.stars+' ⭐':''} ${rw.ember?fmt(rw.ember)+' Ember':''} ${rw.txt?'· '+rw.txt:''}</div>
    </div>
    <button class="btn btn-gold btn-block mt3" onclick="EF.share('streak',${days})">Share this milestone</button>
    <button class="btn btn-ghost btn-block mt2" onclick="EF.close()">Keep the fire</button>`);
}
function collectAsh(e){
  const p=ashPending(); if(p<=0) return;
  const gain=p*ashValue(); addEmber(gain); S.ashReadyAt=now(); save();
  S._ashCollects=(S._ashCollects||0)+1; if(S._ashCollects>=3) S.quests['ash']=true;
  notifH('success'); haptic('medium');
  const rr=e.currentTarget.getBoundingClientRect(); fxPop('+'+fmt(gain),rr.left+rr.width/2-30,rr.top-10);
  toast(`Gathered ${p} Ash · +${fmt(gain)} Ember`,'good','✨');
  renderFire();
}
/* =====================================================================
   SCREEN: TRIBE
===================================================================== */
function renderTribe(){
  const scr=$('#screen-tribe'); const t=S.tribe;
  const myPower=roleObj(S.role).power;
  const canEditWall = myPower>=4; // Head & Chief
  const chief=MEMBERS.find(m=>m.role==='chief')||{name:'Ugg'};
  const head=MEMBERS.find(m=>m.role==='head')||{name:'Mara'};
  const elder=MEMBERS.find(m=>m.role==='elder')||{name:'Tala'};
  const top=[...MEMBERS].sort((a,b)=>b.ember-a.ember).slice(0,5);
  const pyrePct=clamp(t.pyre/t.pyreGoal*100,2,100);
  scr.innerHTML=`
    <div class="card glow stagger tribe-hero">
      <div class="row" style="gap:14px">
        <div class="tribe-crest">${tribeCrest(t.name)}</div>
        <div class="flex1"><div class="card-title" style="font-size:1.15rem">${t.name}</div>
          <div class="tiny">Level ${t.level} · ${t.members} kin · avg loyalty ${t.avgLoyalty}</div>
          <div class="tiny ember-txt" style="font-style:italic;margin-top:3px">“${tribeTheme(t.name).motto}”</div></div>
        <span class="pill rank">${STAGES[S.settlement]}</span>
      </div>
      <div class="sec-head" style="margin:14px 0 8px"><h2 style="font-size:.8rem">The Great Pyre</h2>
        <span class="hint">${fmt(t.pyre)} / ${fmt(t.pyreGoal)}</span></div>
      <div class="bar pyre"><i style="width:${pyrePct}%"></i></div>
      <div class="tiny mt2">Feed Ember to grow the treasury — fund the next tribe upgrade.</div>
      <div class="grid2 mt3">
        <button id="stokeBtn" class="btn btn-primary btn-shine">Stoke the Pyre</button>
        <button id="warcryBtn" class="btn btn-ghost" ${myPower>=2?'':'disabled'}>📯 War Cry</button>
      </div>
    </div>

    <div class="sec-head stagger"><h2>Tribe War</h2><span class="hint">live</span></div>
    <div class="war stagger">
      <div class="tiny center">Contribution battle — winner takes the loyalty pool</div>
      <div class="war-vs">
        <div class="war-side"><b>${t.name}</b><div class="sc" id="warUs">48,900</div></div>
        <div class="vs">VS</div>
        <div class="war-side"><b>Clovis</b><div class="sc">44,120</div></div>
      </div>
      <div class="bar"><i style="width:53%"></i></div>
      <div class="war-clock mt2" id="warClock">02:41:18</div>
    </div>

    <div class="sec-head stagger"><h2>Key Figures</h2></div>
    <div class="grid3 stagger">
      ${figureCard('Chief',chief.name,'chief')}
      ${figureCard('Head',head.name,'head')}
      ${figureCard('Elder',elder.name,'elder')}
    </div>

    <div class="sec-head stagger"><h2>Top Contributors</h2><span class="hint">by Ember</span></div>
    <div class="card stagger">${top.map((m,i)=>lbRow(m,i)).join('')}</div>

    <div class="sec-head stagger"><h2>Cave Wall</h2>${canEditWall?'<span class="hint ember-txt" id="editWall">edit ✎</span>':'<span class="hint">Head & Chief only</span>'}</div>
    <div class="cavewall stagger"><p>${t.slogan}</p></div>

    <div class="sec-head stagger"><h2>Council</h2></div>
    <div class="grid2 stagger">
      <button class="btn btn-ghost" id="voteBtn">🗳 Chief Vote</button>
      <button class="btn btn-ghost" id="mentorBtn">🤝 Mentorship</button>
    </div>

    <div class="sec-head stagger"><h2>Chatter</h2><span class="hint">${MEMBERS.filter(m=>m.online).length} online</span></div>
    <div class="card stagger"><div class="chat" id="chatBox"></div>
      <div class="chat-input"><input id="chatIn" placeholder="Speak to your kin..." maxlength="160"/>
      <button class="btn btn-primary" id="chatSend">Send</button></div></div>

    <div class="sec-head stagger"><h2>Roster</h2><span class="hint">${t.members} kin</span></div>
    <div class="card stagger" id="rosterBox"></div>

    <div class="grid2 mt3 stagger">
      <button class="btn btn-ghost" id="joinBtn">Join another tribe</button>
      <button class="btn btn-gold btn-shine" id="foundBtn">Found a new band</button>
    </div><div class="mt3"></div>`;
  S.quests['cry']=true; save();
  renderChat(); renderRoster();
  $('#stokeBtn').onclick=openStoke;
  $('#warcryBtn').onclick=()=>{notifH('success');toast('War Cry sent to all '+t.members+' kin!','good','📯');};
  $('#chatSend').onclick=sendChat; $('#chatIn').addEventListener('keydown',e=>{if(e.key==='Enter')sendChat();});
  $('#foundBtn').onclick=founderFlow; $('#joinBtn').onclick=joinFlow;
  $('#voteBtn').onclick=voteFlow; $('#mentorBtn').onclick=mentorFlow;
  const ew=$('#editWall'); if(ew) ew.onclick=editWall;
  startWarClock();
}
function figureCard(title,name,role){
  return `<div class="stat"><div class="avatar ${role} online" style="margin:0 auto 6px;background:${roleColor(role)}">${name[0]}</div>
    <b style="font-size:.9rem">${name}</b><span>${title}</span></div>`;
}
function roleColor(k){return {chief:'linear-gradient(140deg,#ff6b1a,#ff3d3d)',head:'linear-gradient(140deg,#ffb03a,#ff6b1a)',
  elder:'linear-gradient(140deg,#b26eff,#7a4bff)',hunter:'linear-gradient(140deg,#2ad4ff,#2a7bff)',
  kin:'linear-gradient(140deg,#6b5a82,#4a3a62)',toddler:'linear-gradient(140deg,#7c6d90,#5a4a72)'}[k]||'#5a4a72';}
function lbRow(m,i){
  return `<div class="mrow"><span class="lb-rank ${i===0?'top':''}">${i+1}</span>
    <div class="avatar ${m.online?'online':''}" style="background:${roleColor(m.role)}">${m.name[0]}</div>
    <div class="m-body"><b>${m.name}</b><div class="m-loyal">${roleObj(m.role).name} · loyalty ${m.loyalty}</div></div>
    <b class="ember-txt nowrap">${fmt(m.ember)}</b></div>`;
}
function renderRoster(){
  const box=$('#rosterBox'); if(!box) return;
  box.innerHTML=[...MEMBERS].sort((a,b)=>roleObj(b.role).power-roleObj(a.role).power).slice(0,12)
    .map(m=>`<div class="mrow"><div class="avatar ${m.online?'online':''}" style="background:${roleColor(m.role)}">${m.name[0]}</div>
      <div class="m-body"><b>${m.name}</b><div class="m-loyal">${roleObj(m.role).name}</div></div>
      <span class="pill ${m.online?'on':'off'}">${m.online?'online':'away'}</span></div>`).join('');
}
function renderChat(){
  const box=$('#chatBox'); if(!box) return;
  box.innerHTML=CHAT.map(m=>`<div class="msg ${m.me?'me':'them'}">${m.me?'':`<div class="who">${m.who}</div>`}${m.text}</div>`).join('');
  box.scrollTop=box.scrollHeight;
}
function sendChat(){
  const inp=$('#chatIn'); const v=(inp.value||'').trim(); if(!v) return;
  CHAT.push({who:S.name,me:true,text:escapeHtml(v)}); inp.value=''; renderChat(); haptic('light');
  setTimeout(()=>{const rep=['For the fire!','Aye, kin.','Stoking now.','Clovis will fall.'][Math.random()*4|0];
    CHAT.push({who:MEMBERS[Math.random()*6|0].name,me:false,text:rep});renderChat();},1200);
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
let warTimer=null;
function startWarClock(){
  clearInterval(warTimer); let s=2*3600+41*60+18;
  warTimer=setInterval(()=>{const c=$('#warClock');if(!c){clearInterval(warTimer);return;}
    s=Math.max(0,s-1);const h=(s/3600|0),m=((s%3600)/60|0),ss=s%60;
    c.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;},1000);
}
/* =====================================================================
   SCREEN: RANKS
===================================================================== */
function renderRanks(){
  const scr=$('#screen-ranks');
  const myTribeRank=WORLD_TRIBES.findIndex(t=>t.name===S.tribe.name);
  const kin=[...MEMBERS,{name:S.name,role:S.role,ember:S.ember,loyalty:S.loyalty,online:true,me:true}]
    .sort((a,b)=>b.ember-a.ember);
  const myKinRank=kin.findIndex(m=>m.me)+1;
  scr.innerHTML=`
    <div class="card glow stagger center">
      <div class="tiny">Airdrop allocation is split by <b class="gold-txt">tribe loyalty per member</b>.<br>Rise together — every kin's activeness feeds the share.</div>
    </div>
    <div class="sec-head stagger"><h2>World · Tribes</h2><span class="hint">avg loyalty / kin</span></div>
    <div class="card stagger">
      ${WORLD_TRIBES.map((t,i)=>`<div class="mrow ${t.name===S.tribe.name?'':''}" style="${t.name===S.tribe.name?'background:rgba(255,107,26,.12);border-radius:10px':''}">
        <span class="lb-rank ${i<3?'top':''}">${i+1}</span>
        <div class="avatar" style="background:${['linear-gradient(140deg,#ffd77a,#ff6b1a)','linear-gradient(140deg,#cfe0ff,#8aa)','linear-gradient(140deg,#e8b06a,#a0703a)'][i]||roleColor('kin')}">${t.name[0]}</div>
        <div class="m-body"><b>${t.name}${t.name===S.tribe.name?' <span class="tiny gold-txt">(you)</span>':''}</b><div class="m-loyal">Lv ${t.lvl} · ${t.members} kin</div></div>
        <b class="gold-txt nowrap">${t.avg}</b></div>`).join('')}
    </div>

    <div class="sec-head stagger"><h2>Kin · by Ember</h2><span class="hint">you: #${myKinRank}</span></div>
    <div class="card stagger">
      ${kin.slice(0,10).map((m,i)=>`<div class="mrow" style="${m.me?'background:rgba(255,107,26,.12);border-radius:10px':''}">
        <span class="lb-rank ${i<3?'top':''}">${i+1}</span>
        <div class="avatar ${m.online?'online':''}" style="background:${roleColor(m.role)}">${m.name[0]}</div>
        <div class="m-body"><b>${m.name}${m.me?' <span class="tiny gold-txt">(you)</span>':''}</b><div class="m-loyal">${roleObj(m.role).name}</div></div>
        <b class="ember-txt nowrap">${fmt(m.ember)}</b></div>`).join('')}
    </div>
    <div class="card glow stagger center mt3">
      <div class="tiny">Your tribe ranks <b class="gold-txt">#${myTribeRank+1}</b> of ${WORLD_TRIBES.length} worlds.</div>
      <button class="btn btn-gold btn-block btn-shine mt3" onclick="EF.share('rank',${myKinRank})">Share your rank card</button>
    </div><div class="mt3"></div>`;
}

/* =====================================================================
   SCREEN: LANDS
===================================================================== */
function renderLands(){
  const scr=$('#screen-lands'); const st=S.settlement;
  scr.innerHTML=`
    <div class="settlement stagger">
      <div class="sun"></div>${settlementSVG(st)}<div class="ground"></div>
    </div>
    <div class="stage-track stagger">
      ${STAGES.map((s,i)=>`<div class="stage-node ${i<st?'done':''} ${i===st?'cur done':''}">
        <div class="dot">${i+1}</div><small>${s}</small></div>`).join('')}
    </div>
    <div class="card glow stagger mt3">
      <div class="row spread"><div class="card-title">${STAGES[st]}</div>
        <span class="pill rank">Stage ${st+1}/5</span></div>
      <p class="tiny mt2">Upgrade your settlement using the Great Pyre. Each stage boosts tribe-wide Ember output.</p>
      ${st<4?`<button id="upSettle" class="btn btn-primary btn-block btn-shine mt3">Advance to ${STAGES[st+1]} · ${fmt(settleCost())} Pyre</button>`
        :'<div class="btn btn-gold btn-block mt3">Kingdom — max stage reached 👑</div>'}
      <button id="expandBtn" class="btn btn-ghost btn-block mt2">Expand Land · +5 kin · <span class="gold-txt">80 ⭐</span></button>
    </div>

    <div class="sec-head stagger"><h2>Tribe Upgrades</h2><span class="hint">spends Great Pyre</span></div>
    <div class="stagger" id="upList"></div>
    <div class="mt3"></div>`;
  renderUpgrades();
  const us=$('#upSettle'); if(us) us.onclick=upgradeSettlement;
  $('#expandBtn').onclick=()=>buyStars('expand',80,()=>{S.tribe.members+=5;MEMBERS=seedMembers(S.tribe.members);toast('Land expanded · +5 kin slots','good','⛰️');renderLands();});
}
function settleCost(){return 120000*(S.settlement+1);}
function renderUpgrades(){
  const box=$('#upList'); if(!box) return;
  box.innerHTML=UPGRADES.map(u=>{
    const lvl=S.tribe.up[u.id]; const cost=u.base*(lvl+1);
    return `<div class="up-row"><div class="up-ico">${ICON[u.ico]}</div>
      <div class="up-body"><b>${u.name}</b><div class="tiny">${u.desc}</div>
        <div class="up-lvl">${[...Array(8)].map((_,i)=>`<i class="${i<lvl?'on':''}"></i>`).join('')}</div></div>
      <button class="btn btn-gold" style="padding:9px 12px;font-size:.72rem" data-up="${u.id}">${fmt(cost)}<br><span style="font-size:.6rem">Pyre</span></button></div>`;
  }).join('');
  $$('[data-up]',box).forEach(b=>b.onclick=()=>upgradeTribe(b.dataset.up));
}
function upgradeSettlement(){
  const c=settleCost();
  if(S.tribe.pyre<c) return toast('Great Pyre too low — rally your kin to Stoke!','warn','!');
  S.tribe.pyre-=c; S.settlement=clamp(S.settlement+1,0,4); S.tribe.level+=2; save();
  notifH('success'); toast(`Settlement advanced to ${STAGES[S.settlement]}!`,'good','⛰️');
  renderLands();
}
function upgradeTribe(id){
  const u=UPGRADES.find(x=>x.id===id); const lvl=S.tribe.up[id]; const cost=u.base*(lvl+1);
  if(S.tribe.pyre<cost) return toast('Great Pyre too low for this upgrade','warn','!');
  S.tribe.pyre-=cost; S.tribe.up[id]++; save();
  notifH('success'); toast(`${u.name} → Lv ${S.tribe.up[id]}`,'good','✓');
  renderLands();
}
function openStoke(){
  openModal(`<h3>Stoke the Great Pyre</h3><p class="sub">Every Ember you feed grows the tribe treasury — and your loyalty.</p>
    <div class="field"><label>Amount of Ember</label><input id="stokeAmt" type="number" value="1000" min="1"/></div>
    <div class="grid3">${[500,2500,10000].map(a=>`<button class="btn btn-ghost" onclick="document.getElementById('stokeAmt').value=${a}">${fmt(a)}</button>`).join('')}</div>
    <div class="tiny center mt3">Your Ember: <b class="ember-txt">${fmt(S.ember)}</b></div>
    <button class="btn btn-primary btn-block btn-shine mt3" onclick="EF.doStoke()">Feed the Pyre</button>`);
}
function doStoke(){
  const a=Math.floor(+$('#stokeAmt').value||0);
  if(a<=0) return; if(a>S.ember) return toast('Not enough Ember','warn','!');
  addEmber(-a); S.tribe.pyre+=a; S.loyalty=clamp(S.loyalty+Math.min(5,Math.ceil(a/1000)),0,99);
  if(a>=500) S.quests['stoke']=true; save();
  notifH('success'); closeModal(); toast(`Fed ${fmt(a)} Ember to the Pyre · +loyalty`,'good','🔥');
  if(currentScreen==='tribe') renderTribe();
}
function editWall(){
  openModal(`<h3>Edit the Cave Wall</h3><p class="sub">Head & Chief only · seen by all kin at the Hearth</p>
    <div class="field"><label>Tribe slogan</label><input id="wallIn" maxlength="90" value="${S.tribe.slogan.replace(/"/g,'&quot;')}"/></div>
    <div class="name-chips">${SLOGANS.map(s=>`<button onclick="document.getElementById('wallIn').value='${s.replace(/'/g,"\\'")}'">${s.slice(0,18)}…</button>`).join('')}</div>
    <button class="btn btn-primary btn-block mt3" onclick="EF.saveWall()">Carve it</button>`);
}
function saveWall(){const v=(($('#wallIn').value)||'').trim();if(v){S.tribe.slogan=escapeHtml(v);save();}closeModal();toast('Cave Wall updated','good','✎');if(currentScreen==='tribe')renderTribe();}

/* =====================================================================
   SCREEN: STORE (Sky)
===================================================================== */
function renderStore(){
  const scr=$('#screen-store');
  scr.innerHTML=`
    <div class="pass stagger">
      <div class="row spread"><div><div class="card-title">Path of Fire</div><div class="tiny">Season 1 battle pass</div></div>
        ${S.bpPremium?'<span class="pill on">PREMIUM</span>':'<button class="btn btn-gold" style="padding:8px 12px;font-size:.74rem" onclick="EF.buyPass()">Unlock · 250 ⭐</button>'}</div>
      <div class="pass-track mt2">${[...Array(10)].map((_,i)=>`<div class="pass-node ${i<S.pass?'claimed':i===S.pass?'ready':''}">
        <div class="tier">${i+1}</div><small>${i%3===0?'⭐'+(i*5):fmt(i*800+500)}</small></div>`).join('')}</div>
    </div>

    <div class="sec-head stagger"><h2>Star Packs</h2><span class="hint">top up ⭐</span></div>
    <div class="grid2 stagger">
      ${STARPACKS.map(p=>`<div class="item"><div class="art">${ART.flame}</div>
        <b>${p.name}</b><div class="desc">${p.bonus?`<span class="gold-txt">+${p.bonus}% bonus</span>`:'starter pack'}</div>
        <button class="buy star" data-pack="${p.id}">Get ${fmt(Math.round(p.stars*(1+p.bonus/100)))} ⭐</button></div>`).join('')}
    </div>

    <div class="sec-head stagger"><h2>Store</h2><span class="hint">tools & boosts</span></div>
    <div class="shop-grid stagger">
      ${STORE.map(it=>storeCard(it)).join('')}
    </div>

    <div class="sec-head stagger"><h2>Relics</h2><span class="hint ember-txt">on-chain NFTs</span></div>
    <div class="shop-grid stagger">
      ${RELICS.map(r=>relicCard(r)).join('')}
    </div>

    <div class="sec-head stagger"><h2>Airdrop</h2></div>
    <div class="card glow stagger">
      <div class="row spread"><div class="card-title">$EMBER allocation</div><span class="pill rank" id="adEst">~ ${fmt(airdropEst())}</span></div>
      <p class="tiny mt2">Estimated from your loyalty, streak & tribe share. <b>Connect a TON wallet to qualify.</b></p>
      <button class="btn ${S.wallet?'btn-gold':'btn-ghost'} btn-block mt3" id="claimBtn">${S.wallet?'Claim allocation':'Connect wallet to claim'}</button>
    </div><div class="mt3"></div>`;
  $$('[data-pack]').forEach(b=>b.onclick=()=>buyPack(b.dataset.pack));
  $$('[data-buy]').forEach(b=>b.onclick=()=>buyItem(b.dataset.buy));
  $$('[data-relic]').forEach(b=>b.onclick=()=>buyRelic(b.dataset.relic));
  $('#claimBtn').onclick=()=> S.wallet?claimAirdrop():walletFlow();
}
function storeCard(it){
  const owned=S.owned.includes(it.id);
  return `<div class="item ${it.big?'':''}"><div class="art">${ART[it.art]||ART.flame}</div>
    <b>${it.name}</b><div class="desc">${it.desc}</div>
    <button class="buy ${it.cur==='star'?'star':''}" data-buy="${it.id}">${it.cur==='star'?it.cost+' ⭐':fmt(it.cost)+' 🔥'}</button></div>`;
}
function relicCard(r){
  const owned=S.owned.includes(r.id);
  return `<div class="item relic"><span class="nft-tag">NFT</span><span class="rar ${r.rar}">${r.rar}</span>
    <div class="art">${ART[r.art]}</div><b>${r.name}</b><div class="desc">${r.eff}</div>
    ${owned?'<div class="buy" style="background:rgba(46,220,140,.2);color:#7ef0b0">Owned ✓</div>'
      :`<button class="buy star" data-relic="${r.id}">${r.cost} ⭐</button>`}</div>`;
}
function airdropEst(){return Math.round(S.loyalty*40+S.streak*120+S.tribe.avgLoyalty*30+(S.wallet?5000:0));}
/* =====================================================================
   PURCHASES — Telegram Stars flow (stubbed invoice)
===================================================================== */
// Real integration: server creates invoice, TG.openInvoice(url, cb). Here we simulate.
function buyStars(reason,cost,onOk){
  if(S.stars<cost) return toast(`Need ${cost} ⭐ — top up in Star Packs`,'warn','⭐');
  openConfirm(`Spend ${cost} ⭐?`,`This will use ${cost} Telegram Stars.`,()=>{
    addStars(-cost); onOk&&onOk(); notifH('success');
  });
}
function buyPack(id){
  const p=STARPACKS.find(x=>x.id===id);
  const total=Math.round(p.stars*(1+p.bonus/100));
  // Real: TG.openInvoice(invoiceUrl, status=>{ if(status==='paid') ... })
  openConfirm(`Get the ${p.name} pack?`,`${fmt(total)} ⭐ Stars${p.bonus?` (includes +${p.bonus}% bonus)`:''} will be added via a Telegram Stars invoice on launch.`,()=>{
    addStars(total);
    notifH('success'); toast(`+${fmt(total)} Stars added`,'good','⭐'); renderStore();
  });
}
function buyItem(id){
  const it=STORE.find(x=>x.id===id);
  const pay=()=>{
    if(it.id==='auto'){ S.autoUntil=now()+7*864e5; toast('Eternal Flame lit · 7 days auto-collect','good','⚡'); }
    else if(it.id==='totem'){ S.ashCap++; toast('Ash capacity +1','good','✓'); }
    else { if(!S.owned.includes(it.id))S.owned.push(it.id); toast(`${it.name} acquired`,'good','✓'); }
    save(); renderStore();
  };
  if(it.cur==='star') buyStars(it.id,it.cost,pay);
  else { if(S.ember<it.cost) return toast('Not enough Ember','warn','!'); addEmber(-it.cost); pay(); }
}
function buyRelic(id){
  const r=RELICS.find(x=>x.id===id);
  buyStars(id,r.cost,()=>{ if(!S.owned.includes(id))S.owned.push(id); save();
    openModal(`<h3>Relic Minted 🔗</h3><p class="sub">${r.name} — ${r.rar}</p>
      <div class="sharecard"><div class="sc-crest" style="width:90px;height:90px">${ART[r.art]}</div>
        <h4>${r.name}</h4><div class="sc-tribe">${r.eff}</div>
        <div class="tiny mt2">Minted as a TON NFT to ${S.walletName||'your wallet on launch'}.</div></div>
      <button class="btn btn-gold btn-block mt3" onclick="EF.close();EF.render()">Marvelous</button>`);
    renderStore(); });
}
function buyPass(){ buyStars('pass',250,()=>{S.bpPremium=true;save();toast('Path of Fire · Premium unlocked','good','🔥');renderStore();}); }
function claimAirdrop(){
  openModal(`<h3>Airdrop Claim</h3><p class="sub">Snapshot pending · TGE</p>
    <div class="sharecard"><div class="sc-crest">${crestSVG()}</div>
      <h4>${fmt(airdropEst())} $EMBER</h4><div class="sc-tribe">ESTIMATED ALLOCATION</div>
      <div class="sc-stats"><div><b>${S.loyalty}</b><span>loyalty</span></div><div><b>${S.streak}</b><span>streak</span></div><div><b>${S.tribe.avgLoyalty}</b><span>tribe</span></div></div></div>
    <p class="tiny center mt3">Vesting & final numbers set at TGE. Keep your streak alive and your tribe loyal to grow this.</p>
    <button class="btn btn-ghost btn-block mt3" onclick="EF.close()">Got it</button>`);
}
/* =====================================================================
   MODAL SYSTEM
===================================================================== */
function openModal(html){
  const root=$('#modalRoot');
  root.innerHTML=`<div class="scrim" onclick="EF.close()"></div><div class="sheet"><div class="grip"></div>${html}</div>`;
  requestAnimationFrame(()=>root.classList.add('open')); aliveEmojis(root); haptic('light');
}
function closeModal(){const root=$('#modalRoot');root.classList.remove('open');setTimeout(()=>root.innerHTML='',400);}
function openConfirm(title,body,onOk){
  openModal(`<h3>${title}</h3><p class="sub">${body}</p>
    <button class="btn btn-primary btn-block btn-shine mt3" id="cfmOk">Confirm</button>
    <button class="btn btn-ghost btn-block mt2" onclick="EF.close()">Cancel</button>`);
  $('#cfmOk').onclick=()=>{closeModal();onOk&&onOk();};
}

/* ---------- found a band ---------- */
let foundPick='';
function founderFlow(){
  foundPick='';
  openModal(`<h3>Found a New Band</h3><p class="sub">Gather ${FOUND_COST.members} kin & ${fmt(FOUND_COST.ember)} Ember to light a new fire.</p>
    <div class="field"><label>Choose an ancient name</label>
      <div class="name-chips" id="nameChips">${TRIBE_NAMES.map(n=>`<button data-nm="${n}">${n}</button>`).join('')}</div></div>
    <div class="field"><label>Or carve your own</label><input id="customNm" maxlength="18" placeholder="e.g. Emberkin"/></div>
    <div class="card" style="margin:6px 0"><div class="row spread"><span class="muted">Founding cost</span>
      <b class="ember-txt">${fmt(FOUND_COST.ember)} 🔥</b></div>
      <div class="row spread mt2"><span class="muted">Kin needed</span><b>${FOUND_COST.members}</b></div>
      <div class="row spread mt2"><span class="muted">Founder's Torch (skip kin wait)</span><b class="gold-txt">200 ⭐</b></div></div>
    <button class="btn btn-gold btn-block btn-shine mt2" onclick="EF.found()">Light the Fire</button>`);
  $$('#nameChips [data-nm]').forEach(b=>b.onclick=()=>{foundPick=b.dataset.nm;
    $$('#nameChips button').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');$('#customNm').value='';});
}
function found(){
  const nm=($('#customNm').value||'').trim()||foundPick;
  if(!nm) return toast('Pick or carve a tribe name','warn','!');
  if(S.ember<FOUND_COST.ember) return toast(`Need ${fmt(FOUND_COST.ember)} Ember to found`,'warn','🔥');
  addEmber(-FOUND_COST.ember);
  S.tribe={name:escapeHtml(nm),level:1,members:FOUND_COST.members,avgLoyalty:S.loyalty,
    pyre:0,pyreGoal:250000,slogan:SLOGANS[0],up:{hearth:1,well:1,tower:1,forge:1}};
  S.role='chief'; S.settlement=0; MEMBERS=seedMembers(FOUND_COST.members); save();
  applyTheme(nm); closeModal(); notifH('success');
  toast(`${nm} is born — you are Chief!`,'good','🔥'); render();
}
/* ---------- join / vote / mentor / invite ---------- */
function joinFlow(){
  openModal(`<h3>Join Another Tribe</h3><p class="sub">Wandering kin may pledge to a stronger fire.</p>
    ${WORLD_TRIBES.slice(0,6).map(t=>`<div class="mrow"><div class="avatar" style="background:${roleColor('kin')}">${t.name[0]}</div>
      <div class="m-body"><b>${t.name}</b><div class="m-loyal">Lv ${t.lvl} · ${t.members} kin · loyalty ${t.avg}</div></div>
      <button class="btn btn-primary" style="padding:8px 12px;font-size:.74rem" onclick="EF.join('${t.name}')">Pledge</button></div>`).join('')}`);
}
function joinTribe(nm){const t=WORLD_TRIBES.find(x=>x.name===nm);S.tribe.name=nm;S.tribe.level=t.lvl;S.tribe.members=t.members;S.tribe.avgLoyalty=t.avg;S.tribe.slogan=tribeTheme(nm).motto;S.role='toddler';MEMBERS=seedMembers(t.members);save();applyTheme(nm);closeModal();toast(`You pledged to ${nm} as Toddler`,'good','🤝');render();}
function voteFlow(){
  const cands=MEMBERS.filter(m=>roleObj(m.role).power>=3).slice(0,4);
  openModal(`<h3>Chief Vote</h3><p class="sub">The Chief is elected by kin — and recalled if loyalty criteria slip. Elders carry 2× weight.</p>
    ${cands.map(m=>`<div class="mrow"><div class="avatar" style="background:${roleColor(m.role)}">${m.name[0]}</div>
      <div class="m-body"><b>${m.name}</b><div class="m-loyal">${roleObj(m.role).name} · loyalty ${m.loyalty}</div></div>
      <button class="btn btn-ghost" style="padding:8px 12px;font-size:.74rem" onclick="EF.vote('${m.name}')">Vote</button></div>`).join('')}
    <div class="tiny center mt3">A Chief below 60 avg loyalty for 7 days can be recalled by majority.</div>`);
}
function castVote(nm){closeModal();notifH('success');toast(`Vote cast for ${nm}`,'good','🗳');}
function mentorFlow(){
  const tod=MEMBERS.filter(m=>m.role==='kin'||m.role==='toddler').slice(0,4);
  openModal(`<h3>Mentorship</h3><p class="sub">Elders sponsor newcomers. Both earn bonus Ember as the Toddler ranks up.</p>
    ${tod.map(m=>`<div class="mrow"><div class="avatar" style="background:${roleColor(m.role)}">${m.name[0]}</div>
      <div class="m-body"><b>${m.name}</b><div class="m-loyal">${roleObj(m.role).name}</div></div>
      <button class="btn btn-primary" style="padding:8px 12px;font-size:.74rem" onclick="EF.mentor('${m.name}')">Sponsor</button></div>`).join('')}`);
}
function doMentor(nm){addEmber(300);closeModal();notifH('success');toast(`You now mentor ${nm} · +300 Ember`,'good','🤝');}
function inviteFlow(){
  const code=(S.name.slice(0,3).toUpperCase()+Math.abs(hash(S.name)).toString(36).slice(0,5)).toUpperCase();
  const link=`https://t.me/TribesBot?start=${code}`;
  const share=`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my tribe in TRIBES 🔥 Rise from Village to Kingdom. Code: '+code)}`;
  openModal(`<h3>Call a Wanderer</h3><p class="sub">Earn Ember for every kin you bring — and a cut of their invites.</p>
    <div class="card center"><div class="tiny">Your code</div><b class="gold-txt" style="font-size:1.4rem;letter-spacing:.2em">${code}</b>
      <div class="grid3 mt3"><div class="stat"><b>${S.refInvited}</b><span>invited</span></div>
      <div class="stat"><b>${S.refInvited*500}</b><span>Ember earned</span></div>
      <div class="stat"><b>${S.refInvited>=5?'x2':(5-S.refInvited)+' left'}</b><span>tribe bonus</span></div></div></div>
    <a class="btn btn-primary btn-block btn-shine mt3" href="${share}" target="_blank" onclick="EF.close()">Share invite link</a>`);
}
function hash(s){let h=0;for(let i=0;i<s.length;i++)h=(h<<5)-h+s.charCodeAt(i)|0;return h;}
/* =====================================================================
   WALLET — TON Connect flow (stubbed; wire @tonconnect/ui on launch)
===================================================================== */
const WALLETS=[{k:'tonkeeper',n:'Tonkeeper'},{k:'tonspace',n:'TON Space'},
  {k:'mytonwallet',n:'MyTonWallet'},{k:'tgwallet',n:'Wallet in Telegram'}];
function walletFlow(){
  openModal(`<h3>Connect TON Wallet</h3><p class="sub">Required to qualify for the $EMBER airdrop.</p>
    ${WALLETS.map(w=>`<div class="mrow"><div class="avatar" style="background:linear-gradient(140deg,#2a7bff,#2ad4ff)">${w.n[0]}</div>
      <div class="m-body"><b>${w.n}</b><div class="m-loyal">TON · tap to connect</div></div>
      <button class="btn btn-primary" style="padding:8px 12px;font-size:.74rem" onclick="EF.connect('${w.k}','${w.n}')">Connect</button></div>`).join('')}
    <div class="tiny center mt3">On launch this uses TON Connect — no seed phrase ever leaves your wallet.</div>`);
}
function connectWallet(k,n){
  // Real: tonConnectUI.openModal() -> onStatusChange returns address
  const addr='UQ'+Math.abs(hash(k+S.name)).toString(36).padStart(6,'0')+'…'+(Math.random().toString(36).slice(2,6));
  S.wallet=addr; S.walletName=n; save(); closeModal(); notifH('success');
  const b=$('#btnWallet'); b.textContent='TON ✓'; b.classList.add('connected');
  toast(`${n} connected · airdrop unlocked`,'good','✓');
  addStars(0); if(currentScreen==='store') renderStore();
}

/* =====================================================================
   SHARE CARDS (Telegram story / share)
===================================================================== */
function share(kind,val){
  let title,sub,stats;
  if(kind==='streak'){title=val+' Day Streak';sub='UNBROKEN FLAME';}
  else if(kind==='rank'){title='Rank #'+val;sub='RISING KIN';}
  else {title=roleObj(S.role).name;sub='OF '+S.tribe.name.toUpperCase();}
  const link='https://t.me/TribesBot';
  const txt=`${S.name} — ${title} in TRIBES 🔥 ${sub}`;
  const url=`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(txt)}`;
  openModal(`<h3>Your Story Card</h3><p class="sub">Share your glory to your feed</p>
    <div class="sharecard"><div class="sc-crest">${crestSVG()}</div>
      <h4>${title}</h4><div class="sc-tribe">${S.name} · ${sub}</div>
      <div class="sc-stats"><div><b>${S.streak}</b><span>streak</span></div>
        <div><b>${roleObj(S.role).name}</b><span>rank</span></div>
        <div><b>${S.loyalty}</b><span>loyalty</span></div></div>
      <div class="sc-wm">TRIBES</div></div>
    <a class="btn btn-gold btn-block btn-shine mt3" href="${url}" target="_blank" onclick="EF.close()">Share to Telegram</a>
    <button class="btn btn-ghost btn-block mt2" onclick="EF.close()">Close</button>`);
}

/* =====================================================================
   NAVIGATION
===================================================================== */
let currentScreen='fire';
const RENDERERS={fire:renderFire,tribe:renderTribe,ranks:renderRanks,lands:renderLands,store:renderStore};
function go(name){
  if(!RENDERERS[name]) return;
  currentScreen=name;
  RENDERERS[name]();
  aliveEmojis($('#screen-'+name));
  $$('.screen').forEach(s=>s.classList.toggle('active',s.dataset.screen===name));
  $$('.tab').forEach((t,i)=>{const on=t.dataset.tab===name;t.classList.toggle('active',on);});
  const idx=['fire','tribe','ranks','lands','store'].indexOf(name);
  const g=$('#tabGlider'); g.style.transform=`translateX(${idx*100}%)`;
  $('#screens').scrollTop=0; haptic('light');
}
function render(){ RENDERERS[currentScreen] && RENDERERS[currentScreen](); aliveEmojis($('#screen-'+currentScreen)); paintBalances(); }

/* =====================================================================
   IDLE LOOP + BOOT
===================================================================== */
function tickIdle(){
  if(S.autoUntil>now()){ // auto-collect
    const p=ashPending(); if(p>=1){ addEmber(p*ashValue()); S.ashReadyAt=now(); save(); }
  }
  if(currentScreen==='fire' && $('#collectBtn')) renderFire();
}
function injectNavIcons(){
  const map=['fire','tribe','ranks','lands','sky'];
  $$('.tab').forEach((t,i)=>{const ico=t.querySelector('.tab-ico');const k=t.dataset.tab==='store'?'sky':t.dataset.tab;ico.innerHTML=ICON[k]||ICON.fire;});
}
function boot(){
  loadEcon(); applyTheme(S.tribe.name); makeSparks();
  injectNavIcons(); paintBalances();
  if(!S.ashReadyAt) S.ashReadyAt=now()-S.ashRate*60*1000; // start with 1 ash
  const b=$('#btnWallet'); if(S.wallet){b.textContent='TON ✓';b.classList.add('connected');}
  b.onclick=()=> S.wallet?walletInfo():walletFlow();
  $('#btnEmber').onclick=()=>go('store'); $('#btnStars').onclick=()=>go('store');
  $$('.tab').forEach(t=>t.onclick=()=>go(t.dataset.tab));
  go('fire'); render();
  setInterval(tickIdle,15000);
  setTimeout(()=>{$('#splash').classList.add('hidden');$('#app').classList.add('ready');},1700);
}

/* live economy overrides written by the Admin panel (localStorage) */
function loadEcon(){
  try{
    const e=JSON.parse(localStorage.getItem('tribes.econ')||'null'); if(!e)return;
    if(e.ashRate) S.ashRate=e.ashRate;
    if(e.foundEmber) FOUND_COST.ember=e.foundEmber;
    if(e.foundMembers) FOUND_COST.members=e.foundMembers;
    if(e.quests) QUESTS.forEach(q=>{ if(e.quests[q.id]!=null) q.r=e.quests[q.id]; });
    if(e.store) STORE.forEach(s=>{ if(e.store[s.id]!=null) s.cost=e.store[s.id]; });
    if(e.relics) RELICS.forEach(r=>{ if(e.relics[r.id]!=null) r.cost=e.relics[r.id]; });
    if(e.packs) STARPACKS.forEach(p=>{ if(e.packs[p.id]!=null) p.stars=e.packs[p.id]; });
    if(e.upgrades) UPGRADES.forEach(u=>{ if(e.upgrades[u.id]!=null) u.base=e.upgrades[u.id]; });
    if(Array.isArray(e.slogans)&&e.slogans.length){ SLOGANS.length=0; e.slogans.forEach(s=>SLOGANS.push(s)); }
  }catch(err){}
}

function makeSparks(){
  const box=$('#sparks'); if(!box) return; let h='';
  for(let i=0;i<28;i++){
    const l=Math.random()*100, dur=(3.5+Math.random()*4).toFixed(2), del=(Math.random()*6).toFixed(2),
      dx=((Math.random()*80-40)|0), sz=(2+Math.random()*3).toFixed(1);
    h+=`<span class="spark" style="left:${l}%;width:${sz}px;height:${sz}px;--dx:${dx}px;animation-duration:${dur}s;animation-delay:${del}s"></span>`;
  }
  box.innerHTML=h;
}
const EMO_RE=/(\p{Extended_Pictographic}(\uFE0F)?)/u;
function aliveEmojis(root){
  if(!root) return;
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
    if(!n.nodeValue||!EMO_RE.test(n.nodeValue))return NodeFilter.FILTER_REJECT;
    const p=n.parentNode; if(!p||p.classList&&p.classList.contains('emo'))return NodeFilter.FILTER_REJECT;
    const tag=p.nodeName; if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SCRIPT'||tag==='STYLE')return NodeFilter.FILTER_REJECT;
    return NodeFilter.FILTER_ACCEPT;
  }});
  const targets=[]; let n; while((n=walk.nextNode())) targets.push(n);
  const RE=/(\p{Extended_Pictographic}\uFE0F?)/gu;
  targets.forEach(node=>{
    const parts=node.nodeValue.split(RE); if(parts.length<2) return;
    const frag=document.createDocumentFragment(); let k=0;
    parts.forEach(p=>{ if(!p)return;
      if(RE.test(p)){RE.lastIndex=0; const s=document.createElement('span'); s.className='emo';
        s.style.animationDelay=((k++%5)*0.14)+'s'; s.textContent=p; frag.appendChild(s);}
      else frag.appendChild(document.createTextNode(p));
    });
    node.parentNode.replaceChild(frag,node);
  });
}
function walletInfo(){openModal(`<h3>TON Wallet</h3><p class="sub">${S.walletName}</p>
  <div class="card center"><div class="tiny">Address</div><b class="gold-txt">${S.wallet}</b>
  <div class="tiny mt3">Airdrop qualified ✓</div></div>
  <button class="btn btn-ghost btn-block mt3" onclick="EF.close()">Close</button>`);}

/* public namespace for inline handlers */
window.EF={close:closeModal,render,go,doStoke,saveWall,found,join:joinTribe,vote:castVote,
  mentor:doMentor,connect:connectWallet,share,buyPass};
let _booted=false;
function bootOnce(){ if(_booted)return; _booted=true; boot(); }
document.addEventListener('DOMContentLoaded',bootOnce);
if(document.readyState!=='loading') bootOnce();

