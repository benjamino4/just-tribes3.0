// TRIBES-FILE: web/src/components/Emoji.jsx
// PHASE: 4 — Relics

import { useMemo } from 'react';
import { emojiHtml } from '../data/emojis.js';
import { useMotionConfig } from '../lib/motion.js';

export default function Emoji({ name, size = 24, className, style }) {
  const M = useMotionConfig();
  const html = useMemo(() => emojiHtml(name), [name]);

  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        lineHeight: 0,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}