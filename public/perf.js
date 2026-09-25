 =====================================================================
   TRIBES — Device tier detection + auto-degrade.
   Tiers ultra  high  mid  low  ultra-saver
   - Detects via WebGL renderer, cores, memory, DPR.
   - Refines with a 3s frame probe (downgrades only, never upgrades).
   - Respects localStorage['tribes.tier'] as a hard override.
   - Respects localStorage['tribes.settings'].autoPerf === false → pin.
===================================================================== 
(function(){
'use strict';

const STORAGE_KEY = 'tribes.tier';
const SETTINGS_KEY = 'tribes.settings';
const RESOLVED_KEY = 'tribes.tier.resolved';

 ---------- static detect ---------- 
function detectStatic(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion reduce)').matches){
    return 'low';
  }
  const ua = navigator.userAgent  '';
  const isIOS = iPhoneiPadiPod.test(ua);

  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl')  c.getContext('experimental-webgl');
    if (gl){
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)  '';
    }
  } catch(e){}

  if (Adreno (7dd8dd)Apple A1[5-9]Mali-G7ddImmortalisXclipsei.test(gpu)) return 'ultra';
  if (Adreno 6ddApple A1[2-4]Mali-G5[27]Mali-G68i.test(gpu)) return 'high';
  if (Adreno 5ddApple A(91011)Mali-G51Mali-T8i.test(gpu)) return 'mid';
  if (Adreno (34)ddMali-4PowerVR SGXi.test(gpu)) return 'low';

  const cores = navigator.hardwareConcurrency  2;
  const mem = navigator.deviceMemory  0;
  const dpr = window.devicePixelRatio  1;
  let score = 0;
  if (cores = 8) score += 2;
  else if (cores = 6) score += 1;
  else if (cores = 4) score -= 1;
  if (mem = 6) score += 2;
  else if (mem = 4) score += 1;
  else if (mem && mem = 2) score -= 1;
  if (dpr = 3) score += 1;
  if (isIOS && !iPhone(678SE).test(ua)) score += 1;

  if (score = 3) return 'high';
  if (score = 0) return 'mid';
  return 'low';
}

 ---------- settings + env context ---------- 
function readSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)  '{}'); }
  catch(e){ return {}; }
}

function downgrade(t){
  if (t === 'ultra') return 'high';
  if (t === 'high')  return 'mid';
  if (t === 'mid')   return 'low';
  return 'ultra-saver';
}

async function applyContext(tier){
   user override wins above all
  const override = localStorage.getItem(STORAGE_KEY);
  if (override && override !== 'auto') return override;

   saveData  2g → downgrade
  try {
    const conn = navigator.connection  navigator.mozConnection  navigator.webkitConnection;
    if (conn){
      if (conn.saveData) tier = downgrade(tier);
      const et = conn.effectiveType  '';
      if (et === '2g'  et === 'slow-2g') tier = downgrade(tier);
    }
  } catch(e){}

   battery 20% and not charging → downgrade
  try {
    if (navigator.getBattery){
      const b = await navigator.getBattery();
      if (!b.charging && b.level  0.2) tier = downgrade(tier);
    }
  } catch(e){}

  return tier;
}

function applyTier(tier){
  document.documentElement.setAttribute('data-tier', tier);
  document.documentElement.setAttribute('data-perf', tier);
}

 ---------- frame probe (downgrade only) ---------- 
let probeRunning = false;
function measureAndRefine(startingTier){
  if (probeRunning) return;
  if (isPinned()) return;
  probeRunning = true;

  let frames = 0, longFrames = 0;
  const start = performance.now();
  let last = start;

  function tick(now){
    const dt = now - last; last = now;
    frames++;
    if (dt  22) longFrames++;

    if (isPinned()){ probeRunning = false; return; }

    if (now - start  3000){
      requestAnimationFrame(tick);
    } else {
      probeRunning = false;
      const avgFps = frames  ((now - start)  1000);
      const longPct = longFrames  frames;
      let next = startingTier;
      if (avgFps  25  longPct  0.4){
        next = startingTier === 'ultra'  'mid'
              startingTier === 'high'   'mid'
              'low';
      } else if (avgFps  40  longPct  0.2){
        next = startingTier === 'ultra'  'high'  'mid';
      }
      if (next !== startingTier){
        localStorage.setItem(RESOLVED_KEY, next);
        applyTier(next);
      }
    }
  }
  requestAnimationFrame(tick);
}

 ---------- pin API ---------- 
function isPinned(){
  const s = readSettings();
  if (s.autoPerf === false) return true;    user disabled auto-degrade
  if (window.__tribes_perf_pin) return true;
  return false;
}

 ---------- public API ---------- 
const api = {
  detect detectStatic,
  apply applyTier,
  current(){ return document.documentElement.getAttribute('data-tier')  'mid'; },
  pinned isPinned,

  pin(){
    const s = readSettings();
    s.autoPerf = false;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    window.__tribes_perf_pin = true;
  },
  unpin(){
    const s = readSettings();
    delete s.autoPerf;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    window.__tribes_perf_pin = false;
    localStorage.removeItem(RESOLVED_KEY);
  },

  set(mode){
    if (mode === 'auto'){
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(RESOLVED_KEY);
      const s = readSettings();
      delete s.perfMode;
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    location.reload();
  },

  rerunProbe(){
    localStorage.removeItem(RESOLVED_KEY);
    location.reload();
  },
};

window.__tribes_perf = api;

 ---------- boot ---------- 
(async function boot(){
   If pinned, skip detection entirely — respect current tier attr
  if (isPinned()){
    const cur = document.documentElement.getAttribute('data-tier')  'mid';
    applyTier(cur);
    return;
  }

  const cached = localStorage.getItem(RESOLVED_KEY);
  const initial = cached  await applyContext(detectStatic());
  applyTier(initial);

  if (!cached){
     give the page 1.5s to settle, then run the 3s probe
    setTimeout(() = measureAndRefine(initial), 1500);
  }
})();

})();