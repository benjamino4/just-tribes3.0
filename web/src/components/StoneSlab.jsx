// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/StoneSlab.jsx
// PURPOSE: The carved stone primitive. Button, panel, or tile.
// DEPENDS ON: stone.js
// ═══════════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { makeStoneCanvas } from '../lib/stone.js';

export default function StoneSlab({
  children, seed = 1, hue = 'slate', width = 300, height = 100,
  className = '', style = {}, onClick, ...rest
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const canvas = makeStoneCanvas(width, height, { seed, hue });
    el.style.backgroundImage = `url(${canvas.toDataURL('image/png')})`;
    el.style.backgroundSize = 'cover';
  }, [seed, hue, width, height]);

  return (
    <div
      ref={ref}
      className={`stone-slab ${className}`}
      onClick={onClick}
      style={{
        position: 'relative',
        padding: 16,
        borderRadius: '14px 16px 15px 17px',
        border: '1px solid rgba(216,201,166,0.10)',
        boxShadow:
          'inset 1px 1px 2px rgba(255,255,255,0.05),' +
          'inset -1px -1px 3px rgba(0,0,0,0.5),' +
          '0 2px 8px rgba(0,0,0,0.6),' +
          '0 8px 24px rgba(0,0,0,0.4)',
        ...style
      }}
      {...rest}
    >{children}</div>
  );
}