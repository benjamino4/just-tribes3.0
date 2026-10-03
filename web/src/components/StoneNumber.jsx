// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/StoneNumber.jsx
// PURPOSE: A number that ticks mechanically when it changes.
// DEPENDS ON: spring.js
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react';
import { Spring, SPRING_PRESETS } from '../lib/spring.js';
import { fmt } from '../lib/format.js';

export default function StoneNumber({ value = 0, className = '', style = {} }) {
  const springRef = useRef(null);
  const [display, setDisplay] = useState(Number(value) || 0);

  useEffect(() => {
    if (!springRef.current) {
      springRef.current = new Spring(Number(value) || 0, {
        ...SPRING_PRESETS.numberTick,
        onUpdate: (v) => setDisplay(Math.round(v))
      });
      return;
    }
    springRef.current.setTarget(Number(value) || 0);
  }, [value]);

  return (
    <span className={`tabular ${className}`} style={style}>{fmt(display)}</span>
  );
}