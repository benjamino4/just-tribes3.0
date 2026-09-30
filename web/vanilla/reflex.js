// TRIBES-FILE: web/vanilla/reflex.js
// PHASE: 4 — Rise of the Eternal Flame
//
// Standalone vanilla driver. Proves the "hybrid": it imports the EXACT same
// engine module the React component uses (../src/games/reflexEngine.js) and
// mounts it with plain DOM — no React, no build step required to run it,
// just serve the folder statically (e.g. `python3 -m http.server` from /web).

import { ReflexEngine, reflexScoreLocal } from '../src/games/reflexEngine.js';

const canvas = document.getElementById('arena');
const out = document.getElementById('out');
const again = document.getElementById('again');

let engine = null;

function run() {
  again.hidden = true;
  out.textContent = 'Tap the disc to begin.';
  if (engine) engine.destroy();
  engine = new ReflexEngine(canvas, {
    rounds: 5,
    onProgress: (r, total, rt) => {
      out.textContent = `Round ${r}/${total} \u00b7 ${Math.round(rt)} ms`;
    },
    onScore: (score, times) => {
      const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      out.innerHTML = `Score <b>${score}</b> &middot; avg ${avg} ms`;
      again.hidden = false;
      // (In the app this raw <code>times</code> array is POSTed to the server,
      //  which re-scores it with reflexScoreLocal()'s Python twin.)
      console.log('reflex times', times, 'local score', reflexScoreLocal(times));
    },
  });
  engine.start();
}

again.addEventListener('click', run);
run();
