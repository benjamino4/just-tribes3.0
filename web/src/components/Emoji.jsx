// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/Emoji.jsx
// PURPOSE: Render emoji by name. SVG or image. EmojiText parses :key:.
// DEPENDS ON: emojiRegistry.jsx, data/emojis.js
// ═══════════════════════════════════════════════════════════════════
import { useMemo } from 'react';
import { useEmojiRegistry } from '../lib/emojiRegistry.jsx';
import { BUILTIN_EMOJIS } from '../data/emojis.js';

const FALLBACK = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#efc168" stroke-width="1.5"/><circle cx="12" cy="12" r="3" fill="#efc168"/></svg>`;

export default function Emoji({ name, size = 24, className, style, alt }) {
  const { resolve } = useEmojiRegistry();
  const html = useMemo(
    () => resolve(name) || BUILTIN_EMOJIS[name] || FALLBACK,
    [name, resolve]
  );
  const isImg = /^data:image\//i.test(html) || /^https?:\/\//i.test(html);

  return (
    <span
      className={className}
      role="img"
      aria-label={alt || name}
      style={{ display: 'inline-block', width: size, height: size, lineHeight: 0, ...style }}
    >
      {isImg ? (
        <img src={html} alt={alt || name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <span style={{ display: 'inline-block', width: '100%', height: '100%' }} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </span>
  );
}

const EMOJI_RE = /:([a-z0-9_\-]{2,40}):/gi;

export function EmojiText({ children, size = 18, className }) {
  const segments = useMemo(() => {
    const text = String(children ?? '');
    const out = [];
    let last = 0, m;
    EMOJI_RE.lastIndex = 0;
    while ((m = EMOJI_RE.exec(text)) !== null) {
      if (m.index > last) out.push({ kind: 'text', value: text.slice(last, m.index) });
      out.push({ kind: 'emoji', key: m[1].toLowerCase() });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ kind: 'text', value: text.slice(last) });
    return out;
  }, [children]);

  return (
    <span className={className}>
      {segments.map((s, i) => s.kind === 'emoji' ? (
        <Emoji key={i} name={s.key} size={size} style={{ verticalAlign: 'text-bottom', margin: '0 2px' }} />
      ) : (
        <span key={i}>{s.value}</span>
      ))}
    </span>
  );
}