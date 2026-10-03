// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/World.jsx
// PURPOSE: Ambient background. Responds to war state with a red tint.
// DEPENDS ON: store.jsx
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useApp } from '../lib/store.jsx';

export default function World() {
  const ref = useRef(null);
  const { data } = useApp();
  const warActive = !!data?.war?.war;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.setAttribute('data-war', warActive ? '1' : '0');
  }, [warActive]);

  return (
    <div className="world" ref={ref} aria-hidden="true">
      <div className="aurora" />
      <div className="heat" />
      <div className="ash" />
      <div className="vig" />
    </div>
  );
}