// TRIBES-FILE: web/src/games/CanvasReflex.jsx
// PHASE: 4 — Rise of the Eternal Flame
//
// Thin React wrapper around the framework-agnostic ReflexEngine. React owns
// the DOM <canvas> node; the vanilla engine owns the drawing + game loop.
// This is the React half of the hybrid — the exact same engine also runs
// standalone in web/vanilla/reflex.html with no React at all.

import { useEffect, useRef } from 'react';
import { ReflexEngine } from './reflexEngine.js';
import { haptic } from '../lib/haptics.js';

export default function CanvasReflex({ rounds = 5, onDone }) {
  const ref = useRef(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const eng = new ReflexEngine(canvas, {
      rounds,
      haptic: (k) => haptic(k === 'bad' ? 'medium' : 'light'),
      onScore: (score, times) => doneRef.current(score, times),
    });
    eng.start();
    return () => eng.destroy();
  }, [rounds]);

  return (
    <div className="wb-arena">
      <canvas ref={ref} className="wb-canvas" aria-label="Ember Reflex" />
    </div>
  );
}
