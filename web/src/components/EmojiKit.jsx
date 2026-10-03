import { useState, useEffect, useRef, useMemo } from 'react';
import { Endpoints } from '../lib/api.js';

// ---------------------------------------------------------------------------
// Shared emoji store
// ---------------------------------------------------------------------------
// One network fetch per app session gives us every active set. We keep two
// derived views:
//   - `glyphs`: key -> { svg, name } for EVERY known emoji (owned or not), so a
//     received message always renders, even if the viewer doesn't own that pack.
//   - `ownedSets`: only the sets this user owns, for the picker (you can only
//     *insert* glyphs you've unlocked).
// The result is cached in module scope so re-opening Kiva is instant and never
// re-flashes.
let _cache = null;
let _inflight = null;

async function fetchEmoji() {
  if (_cache) return _cache;
  if (_inflight) return _inflight;
  _inflight = (async () => {
    const r = await Endpoints.emojiSets();
    const body = r?.data || r || {};
    const sets = body.sets || [];
    const glyphs = {};
    for (const s of sets) {
      for (const e of (s.emojis || [])) {
        if (e && e.key && e.svg) glyphs[e.key] = { svg: e.svg, name: e.name || e.key };
      }
    }
    _cache = { sets, glyphs, ownedSets: sets.filter((s) => s.owned) };
    _inflight = null;
    return _cache;
  })();
  return _inflight;
}

export function useEmoji() {
  const [state, setState] = useState(_cache);
  useEffect(() => {
    if (_cache) { setState(_cache); return; }
    let alive = true;
    fetchEmoji().then((c) => { if (alive) setState(c); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return state || { sets: [], glyphs: {}, ownedSets: [] };
}

// ---------------------------------------------------------------------------
// EmojiText — renders a message body, swapping :key: tokens for inline SVG
// ---------------------------------------------------------------------------
// Plain text is rendered as React text nodes (always HTML-escaped by React, so
// user content can never inject markup). Only the SVG for a KNOWN emoji key is
// inlined, and that art comes from our own trusted store, never from the message
// body. An unknown :token: is left as literal text.
const TOKEN_RE = /:([a-z0-9_]{2,40}):/gi;

// Parses a body into text/emoji parts against a glyph map.
export function parseEmoji(text, map) {
  const out = [];
  const str = String(text || '');
  let last = 0; let m; TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(str)) !== null) {
    const key = m[1];
    const glyph = map[key];
    if (!glyph) continue; // leave unknown tokens as plain text
    if (m.index > last) out.push({ t: str.slice(last, m.index) });
    out.push({ key, svg: glyph.svg, name: glyph.name });
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push({ t: str.slice(last) });
  return out;
}

// True when the body is nothing but 1-3 known emoji (so we can render them big,
// WhatsApp-style). Returns the matched keys, else null.
export function emojiOnly(text, map) {
  const parts = parseEmoji(text, map);
  if (!parts.length) return null;
  const keys = [];
  for (const p of parts) {
    if (p.svg) { keys.push(p.key); continue; }
    if (String(p.t).trim() !== '') return null; // has real text
  }
  return keys.length >= 1 && keys.length <= 3 ? keys : null;
}

export function EmojiText({ text, glyphs, size = 20 }) {
  const store = useEmoji();
  const map = (glyphs && Object.keys(glyphs).length) ? glyphs : store.glyphs;
  const parts = useMemo(() => parseEmoji(text, map), [text, map]);

  return (
    <>
      {parts.map((p, i) => p.svg ? (
        <span
          key={i}
          className="emoji-glyph"
          title={p.name}
          aria-label={p.name}
          style={{ width: size, height: size, display: 'inline-block', verticalAlign: '-0.28em', margin: '0 1px' }}
          dangerouslySetInnerHTML={{ __html: p.svg }}
        />
      ) : (
        <span key={i}>{p.t}</span>
      ))}
    </>
  );
}

// Renders a single emoji by key at an arbitrary size (used for big bubbles and
// reaction chips). Falls back to the raw :key: token if the glyph is unknown.
export function EmojiGlyph({ emojiKey, glyphs, size = 20 }) {
  const store = useEmoji();
  const map = (glyphs && Object.keys(glyphs).length) ? glyphs : store.glyphs;
  const g = map[emojiKey];
  if (!g) return <span>{`:${emojiKey}:`}</span>;
  return (
    <span
      className="emoji-glyph"
      title={g.name}
      aria-label={g.name}
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: '-0.28em' }}
      dangerouslySetInnerHTML={{ __html: g.svg }}
    />
  );
}

// ---------------------------------------------------------------------------
// EmojiPicker — a popover of the user's owned sets; tapping inserts :key:
// ---------------------------------------------------------------------------
export function EmojiPicker({ onPick, anchorRef }) {
  const { ownedSets } = useEmoji();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (popRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, [open, anchorRef]);

  const hasAny = ownedSets.some((s) => (s.emojis || []).length);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        className="emoji-trigger"
        aria-label="Insert emoji"
        onClick={() => setOpen((v) => !v)}
      >☺</button>
      {open && (
        <div ref={popRef} className="emoji-pop glass strong">
          {!hasAny && (
            <p className="tiny" style={{ padding: 8, textAlign: 'center' }}>
              No emoji packs yet — unlock one in the Vault.
            </p>
          )}
          {ownedSets.map((s) => (
            (s.emojis || []).length ? (
              <div key={s.slug} className="emoji-pop-set">
                <div className="emoji-pop-title">{s.name}</div>
                <div className="emoji-pop-grid">
                  {s.emojis.map((e) => (
                    <button
                      key={e.key}
                      type="button"
                      title={e.name}
                      className="emoji-pop-item"
                      onClick={() => { onPick(`:${e.key}:`); }}
                      dangerouslySetInnerHTML={{ __html: e.svg }}
                    />
                  ))}
                </div>
              </div>
            ) : null
          ))}
        </div>
      )}
    </>
  );
}
