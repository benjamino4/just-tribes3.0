/* =====================================================================
   TRIBES — Device tier detection.
   Detects ultra / high / mid / low. Refines with a 3-second frame probe.
   Respects user override, battery level, and reduced-motion.
   Sets data-tier on <html>. Exposes window.__tribes_perf.
===================================================================== */
(function(){
'use strict';

const STORAGE_KEY = 'tribes.tier';

/* ---------- static detection ---------- */
function detectStatic(){
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    return 'low';
  }
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua);

  // WebGL renderer is the strongest signal
  let gpu = '';
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (gl){
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (ext) gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
    }
  } catch(e){}

  if (/Adreno (7\d\d|8\d\d)|Apple A1[5-9]|Mali-G7\d\d|Immortalis|Xclipse/i.test(gpu)) return 'ultra';
  if (/Adreno 6\d\d|Apple A1[2-4]|Mali-G5[27]|Mali-G68/i.test(gpu)) return 'high';
  if (/Adreno 5\d\d|Apple A(9|10|11)|Mali-G51|Mali-T8/i.test(gpu)) return 'mid';
  if (/Adreno (3|4)\d\d|Mali-4|PowerVR SGX/i.test(gpu)) return 'low';

  // Fallback heuristics
  const cores = navigator.hardwareConcurrency || 2;
  const mem = navigator.deviceMemory || 0;
  const dpr = window.devicePixelRatio || 1;
  let score = 0;
  if (cores >= 8) score += 2;
  else if (cores >= 6) score += 1;
  else if (cores <= 4) score -= 1;
  if (mem >= 6) score += 2;
  else if (mem >= 4) score += 1;
  else if (mem && mem <= 2) score -= 1;
  if (dpr >= 3) score += 1;
  if (isIOS && !/iPhone(6|7|8|SE)/.test(ua)) score += 1;

  if (score >= 3) return 'high';
  if (score >= 0) return 'mid';
  return 'low';
}

/* ---------- user override + battery + network adjustments ---------- */
async function applyOverridesAndContext(tier){
  // User override wins above all
  const override = localStorage.getItem(STORAGE_KEY);
  if (override && override !== 'auto'){
    return override;
  }

  // Network: saveData or 2g → downgrade one tier
  try {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn){
      if (conn.saveData) tier = downgrade(tier);
      const et = conn.effectiveType || '';
      if (et === '2g' || et === 'slow-2g') tier = downgrade(tier);
    }
  } catch(e){}

  // Battery: <20% and not charging → downgrade one tier
  try {
    if (navigator.getBattery){
      const b = await navigator.getBattery();
      if (!b.charging && b.level < 0.2) tier = downgrade(tier);
    }
  } catch(e){}

  return tier;
}

function downgrade(t){
  if (t === 'ultra') return 'high';
  if (t === 'high')  return 'mid';
  if (t === 'mid')   return 'low';
  return 'ultra-saver';
}

/* ---------- apply ---------- */
function applyTier(tier){
  document.documentElement.setAttribute('data-tier', tier);
  document.documentElement.setAttribute('data-perf', tier); // legacy compat
}

/* ---------- frame-time refinement (never upgrades, only downgrades) ---------- */
function measureAndRefine(startingTier){
  let frames = 0, longFrames = 0;
  const start = performance.now();
  let last = start;
  function tick(now){
    const dt = now - last; last = now;
    frames++;
    if (dt > 22) longFrames++;
    if (now - start < 3000){
      requestAnimationFrame(tick);
    } else {
      const avgFps = frames / ((now - start) / 1000);
      const longPct = longFrames / frames;
      let next = startingTier;
      if (avgFps < 25 || longPct > 0.4){
        next = startingTier === 'ultra' ? 'mid'
             : startingTier === 'high'  ? 'mid'
             : 'low';
      } else if (avgFps < 40 || longPct > 0.2){
        next = startingTier === 'ultra' ? 'high' : 'mid';
      }
      if (next !== startingTier){
        localStorage.setItem('tribes.tier.resolved', next);
        applyTier(next);
      }
    }
  }
  requestAnimationFrame(tick);
}

/* ---------- public API ---------- */
const api = {
  detect: detectStatic,
  apply: applyTier,
  set(mode){
    // mode: 'auto' | 'ultra' | 'high' | 'mid' | 'low' | 'ultra-saver'
    if (mode === 'auto'){
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('tribes.tier.resolved');
    } else {
      localStorage.setItem(STORAGE_KEY, mode);
    }
    location.reload();
  },
  current(){
    return document.documentElement.getAttribute('data-tier') || 'mid';
  },
};

window.__tribes_perf = api;

/* ---------- boot ---------- */
(async function boot(){
  // Cached resolved tier overrides static detection
  const cached = localStorage.getItem('tribes.tier.resolved');
  const initial = cached || await applyOverridesAndContext(detectStatic());
  applyTier(initial);
  if (!cached){
    setTimeout(()=> measureAndRefine(initial), 1500);
  }
})();

})();