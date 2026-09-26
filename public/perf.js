/* =====================================================================
   TRIBES — Device tier detection + auto-degrade.
   Tiers: ultra > high > mid > low > ultra-saver
   - Desktop is ALWAYS treated as 'ultra' (no probe, no downgrade).
   - Mobile detects via WebGL renderer, cores, memory, DPR.
   - Refines with a 3s frame probe on mobile only (downgrades, never up).
   - Never defaults to 'low' without strong evidence.
   - Respects localStorage['tribes.tier'] as a hard override.
   - Respects localStorage['tribes.settings'].autoPerf === false -> pin.
===================================================================== */
(function(){
'use strict';

const STORAGE_KEY  = 'tribes.tier';
const SETTINGS_KEY = 'tribes.settings';
const RESOLVED_KEY = 'tribes.tier.resolved';

/* ---------- desktop detection ---------- */
/* A real desktop/laptop: fine pointer + hover, not a mobile UA, roomy screen.
   Desktops (even integrated-GPU laptops) comfortably run the full visual
   stack, so we never downgrade them. */
function isDesktop(){
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua);
  if (mobileUA) return false;

  let finePointer = false, canHover = false;
  try {
    if (window.matchMedia){
      finePointer = window.matchMedia('(pointer: fine)').matches;
      canHover    = window.matchMedia('(hover: hover)').matches;
    }
  } catch(e){}

  const bigScreen = Math.min(window.innerWidth || 0, window.innerHeight || 0) >= 700
                 || (window.screen && Math.max(window.screen.width || 0, window.screen.height || 0) >= 1024);

  // Confident desktop: fine pointer + hover, OR non-mobile UA on a big screen.
  if (finePointer && canHover) return true;
  if (!mobileUA && bigScreen) return true;
  return false;
}

/* ---------- static detect ---------- */
function detectStatic(){
  // Desktop wins outright — full fidelity, always.
  if (isDesktop()) return 'ultra';

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);

  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl){
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
    }
  } catch(e){}

  // Known GPU families first (strong signal).
  if (/Adreno (7\d\d|8\d\d)|Apple A1[5-9]|Mali-G7\d\d|Immortalis|Xclipse/i.test(gpu)) return 'ultra';
  if (/Adreno 6\d\d|Apple A1[2-4]|Mali-G5[27]|Mali-G68/i.test(gpu)) return 'high';
  if (/Adreno 5\d\d|Apple A(9|10|11)|Mali-G51|Mali-T8/i.test(gpu)) return 'mid';
  // Only known-weak GPUs are strong enough evidence for 'low'.
  if (/Adreno (3|4)\d\d|Mali-4|PowerVR SGX/i.test(gpu)) return 'low';

  // No GPU string (common on locked-down mobiles) -> lean on specs.
  const cores = navigator.hardwareConcurrency || 2;
  const mem   = navigator.deviceMemory || 0;   // may be undefined
  const dpr   = window.devicePixelRatio || 1;

  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  else if (cores <= 3) score -= 1;
  if (mem >= 6) score += 2;
  else if (mem >= 4) score += 1;
  else if (mem && mem <= 2) score -= 1;
  if (dpr >= 3) score += 1;
  if (isIOS && !/iPhone (6|7|8|SE)/.test(ua)) score += 1;

  if (score >= 3) return 'high';
  if (score >= 0) return 'mid';

  // Strong evidence of a weak device: very low cores AND low memory.
  if (cores <= 2 && mem && mem <= 2) return 'low';
  // Otherwise, when unsure, default to 'mid' — never wash out on a guess.
  return 'mid';
}

/* ---------- settings + env context ---------- */
function readSettings(){
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch(e){ return {}; }
}

function downgrade(t){
  if (t === 'ultra') return 'high';
  if (t === 'high')  return 'mid';
  if (t === 'mid')   return 'low';
  return 'ultra-saver';
}

async function applyContext(tier){
  // User override wins above all.
  const override = localStorage.getItem(STORAGE_KEY);
  if (override && override !== 'auto') return override;

  // Desktop is never downgraded by network / battery context.
  if (isDesktop()) return tier;

  // saveData / 2g -> downgrade
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn){
      if (conn.saveData) tier = downgrade(tier);
      const et = conn.effectiveType || '';
      if (et === '2g' || et === 'slow-2g') tier = downgrade(tier);
    }
  } catch(e){}

  // battery < 20% and not charging -> downgrade
  try {
    if (navigator.getBattery){
      const b = await navigator.getBattery();
      if (!b.charging && b.level < 0.2) tier = downgrade(tier);
    }
  } catch(e){}

  return tier;
}

function applyTier(tier){
  document.documentElement.setAttribute('data-tier', tier);
  document.documentElement.setAttribute('data-perf', tier);
}

/* ---------- frame probe (mobile only, downgrade only) ---------- */
let probeRunning = false;
function measureAndRefine(startingTier){
  if (probeRunning) return;
  if (isPinned()) return;
  if (isDesktop()) return;            // never probe/downgrade desktop
  probeRunning = true;

  let frames = 0, longFrames = 0;
  const start = performance.now();
  let last = start;

  function tick(now){
    const dt = now - last; last = now;
    frames++;
    if (dt > 22) longFrames++;

    if (isPinned()){ probeRunning = false; return; }

    if (now - start < 3000){
      requestAnimationFrame(tick);
    } else {
      probeRunning = false;
      const avgFps = frames / ((now - start) / 1000);
      const longPct = longFrames / frames;
      let next = startingTier;
      // Only downgrade on clearly bad performance.
      if (avgFps < 25 && longPct > 0.4){
        next = startingTier === 'ultra' ? 'mid'
             : startingTier === 'high'  ? 'mid'
             : 'low';
      } else if (avgFps < 40 && longPct > 0.2){
        next = startingTier === 'ultra' ? 'high' : 'mid';
      }
      if (next !== startingTier){
        localStorage.setItem(RESOLVED_KEY, next);
        applyTier(next);
      }
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- pin API ---------- */
function isPinned(){
  const s = readSettings();
  if (s.autoPerf === false) return true;   // user disabled auto-degrade
  if (window.__tribes_perf_pin) return true;
  return false;
}

/* ---------- public API ---------- */
const api = {
  detect: detectStatic,
  apply: applyTier,
  current(){ return document.documentElement.getAttribute('data-tier') || 'mid'; },
  pinned: isPinned,
  isDesktop: isDesktop,

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

/* ---------- boot ---------- */
(async function boot(){
  // If pinned, skip detection entirely — respect current tier attr.
  if (isPinned()){
    const cur = document.documentElement.getAttribute('data-tier') || 'mid';
    applyTier(cur);
    return;
  }

  const cached = localStorage.getItem(RESOLVED_KEY);
  const initial = cached || await applyContext(detectStatic());
  applyTier(initial);

  // Only mobile runs the refine probe; desktop stays ultra.
  if (!cached && !isDesktop()){
    setTimeout(function(){ measureAndRefine(initial); }, 1500);
  }
})();

})();
