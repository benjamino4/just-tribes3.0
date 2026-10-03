import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { apiGet, Endpoints } from '../lib/api.js';
import { initData } from '../lib/telegram.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';
import {
  EmojiText, EmojiGlyph, EmojiPicker, useEmoji, emojiOnly,
} from '../components/EmojiKit.jsx';

export default function TribeKiva() {
  const nav = useNavigate();
  const { data } = useApp();
  const tribe = data?.tribe;
  const user = data?.user || {};
  const [messages, setMessages] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState(null);
  const [reactFor, setReactFor] = useState(null); // message id whose react bar is open
  const bottomRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const emojiAnchor = useRef(null);
  const { glyphs, ownedSets } = useEmoji();

  // Flatten the user's owned glyph keys — these are the available quick-reactions.
  const reactKeys = [];
  for (const s of ownedSets) for (const e of (s.emojis || [])) reactKeys.push(e.key);

  // De-duplicate by id, and apply updates (reactions/pin) to existing rows.
  function mergeMessages(prev, incoming) {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    const byId = new Map(prev.map((m) => [Number(m.id), m]));
    for (const m of list) {
      if (!m) continue;
      const id = Number(m.id);
      if (byId.has(id)) byId.set(id, { ...byId.get(id), ...m });
      else byId.set(id, m);
    }
    return Array.from(byId.values()).sort((a, b) => Number(a.id) - Number(b.id));
  }

  useEffect(() => {
    if (!tribe) return;
    let alive = true;
    (async () => {
      try {
        const r = await apiGet('/api/kiva');
        const body = r.data || r;
        if (!alive) return;
        setMessages(body.messages || []);
        setPinned(body.pinned || []);
        setLoadError(null);
      } catch (e) {
        if (!alive) return;
        setLoadError(e.message || 'Could not open the Kiva');
      }
    })();
    const id = initData();
    if (id) {
      const params = new URLSearchParams({ tribeId: String(tribe.id), initData: id });
      const es = new EventSource(`/api/kiva/stream?${params}`);
      es.onmessage = (ev) => {
        try {
          const evt = JSON.parse(ev.data);
          if (evt.type === 'message' && evt.message) {
            setMessages((m) => mergeMessages(m, evt.message));
          } else if (evt.type === 'reaction') {
            setMessages((m) => mergeMessages(m, { id: evt.message_id, reactions: evt.reactions }));
            setPinned((p) => p.map((x) => Number(x.id) === Number(evt.message_id)
              ? { ...x, reactions: evt.reactions } : x));
          } else if (evt.type === 'pin') {
            // Pin set changed — refresh the pinned banner.
            Endpoints.kiva().then((r) => setPinned((r.data || r).pinned || [])).catch(() => {});
          }
        } catch {}
      };
      streamRef.current = es;
    }
    return () => { alive = false; streamRef.current?.close?.(); };
  }, [tribe?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (tribe && messages.length) {
      Endpoints.kivaRead(messages[messages.length - 1].id).catch(() => {});
    }
  }, [messages.length]);

  async function post() {
    const body = draft.trim();
    if (!body) return;
    try {
      const r = await Endpoints.kivaPost(body);
      const msg = (r.data || r).message;
      if (msg) setMessages((m) => mergeMessages(m, msg));
      setDraft('');
    } catch (e) { toast(e.message || 'Could not send', 'bad'); }
  }

  function insertEmoji(token) {
    setDraft((d) => {
      const base = d || '';
      const needsSpace = base && !base.endsWith(' ');
      return base + (needsSpace ? ' ' : '') + token + ' ';
    });
    inputRef.current?.focus();
  }

  async function react(messageId, key) {
    haptic('light');
    setReactFor(null);
    // Optimistic toggle so it feels instant; SSE confirms the true aggregate.
    setMessages((m) => m.map((x) => {
      if (Number(x.id) !== Number(messageId)) return x;
      const list = (x.reactions || []).map((r) => ({ ...r, users: [...(r.users || [])] }));
      const mine = Number(user.id);
      const found = list.find((r) => r.key === key);
      if (found) {
        const had = (found.users || []).includes(mine);
        found.users = had ? found.users.filter((u) => u !== mine) : [...found.users, mine];
        found.count = found.users.length;
      } else {
        list.push({ key, count: 1, users: [mine] });
      }
      return { ...x, reactions: list.filter((r) => r.count > 0) };
    }));
    try { await Endpoints.kivaReact(messageId, key); }
    catch (e) { toast(e.message || 'Could not react', 'bad'); }
  }

  async function pin(messageId) {
    haptic('medium');
    setReactFor(null);
    try {
      await Endpoints.kivaPin(messageId);
      toast('Pinned to the Kiva ⭐', 'good');
    } catch (e) {
      toast(e.need ? `Need ${e.need} ⭐ to pin` : (e.message || 'Could not pin'), 'bad');
    }
  }

  async function unpin(messageId) {
    try { await Endpoints.kivaUnpin(messageId); } catch {}
  }

  if (!tribe) {
    return <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>Join a tribe first</div>;
  }

  const canReact = reactKeys.length > 0;

  function renderBody(m, mine) {
    const big = emojiOnly(m.body, glyphs);
    if (big) {
      return (
        <div style={{ display: 'flex', gap: 4, padding: '2px 0' }}>
          {big.map((k, i) => <EmojiGlyph key={i} emojiKey={k} glyphs={glyphs} size={46} />)}
        </div>
      );
    }
    return (
      <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>
        <EmojiText text={m.body} glyphs={glyphs} />
      </span>
    );
  }

  function Bubble({ m }) {
    const mine = Number(m.user_id) === Number(user.id);
    const reactions = (m.reactions || []).filter((r) => r.count > 0);
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 14, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        className={`kiva-row${mine ? ' mine' : ''}`}
      >
        <motion.div
          className={`kiva-bubble${mine ? ' mine' : ''}${m.pinned ? ' pinned' : ''}`}
          whileTap={{ scale: 0.97 }}
          onContextMenu={(e) => { e.preventDefault(); setReactFor(m.id); }}
          onClick={() => setReactFor((cur) => (cur === m.id ? null : m.id))}
        >
          {m.pinned && <span className="kiva-pin-badge">⭐ pinned</span>}
          {!mine && (
            <b style={{ fontSize: 12.5, color: 'var(--ember-200)' }}>{m.first_name || m.username || 'Kin'}</b>
          )}
          {renderBody(m, mine)}
          <span className="tiny" style={{ marginTop: 4 }}>
            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>

          {reactions.length > 0 && (
            <div className="kiva-reactions">
              {reactions.map((r) => {
                const mineR = (r.users || []).includes(Number(user.id));
                return (
                  <motion.button
                    key={r.key}
                    layout
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                    className={`kiva-react-chip${mineR ? ' mine' : ''}`}
                    onClick={(e) => { e.stopPropagation(); react(m.id, r.key); }}
                  >
                    <EmojiGlyph emojiKey={r.key} glyphs={glyphs} size={16} />
                    <span className="tabular">{r.count}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>

        <AnimatePresence>
          {reactFor === m.id && (
            <motion.div
              className="kiva-react-bar glass strong"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            >
              {canReact ? reactKeys.slice(0, 8).map((k) => (
                <button key={k} className="kiva-react-opt" onClick={(e) => { e.stopPropagation(); react(m.id, k); }}>
                  <EmojiGlyph emojiKey={k} glyphs={glyphs} size={26} />
                </button>
              )) : (
                <span className="tiny" style={{ padding: '4px 8px' }}>Unlock an emoji pack to react</span>
              )}
              <span className="kiva-react-sep" />
              {m.pinned
                ? <button className="kiva-react-opt pin" title="Unpin" onClick={(e) => { e.stopPropagation(); unpin(m.id); }}>📌×</button>
                : <button className="kiva-react-opt pin" title="Pin (premium)" onClick={(e) => { e.stopPropagation(); pin(m.id); }}>⭐</button>}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
          <h2 className="display" style={{ fontSize: 22 }}>The Kiva</h2>
        </div>
        <span className="kiva-live"><span className="kiva-live-dot" /> live</span>
      </div>

      {loadError && (
        <div className="glass card" style={{ borderColor: 'var(--rose-300)', textAlign: 'center', padding: 20 }}>
          <b>Could not open the Kiva</b>
          <p className="tiny" style={{ marginTop: 6 }}>{loadError}</p>
        </div>
      )}

      {pinned.length > 0 && (
        <div className="kiva-pinned-bar glass">
          <div className="tiny" style={{ color: 'var(--gold-300)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 6 }}>⭐ Pinned</div>
          {pinned.map((m) => (
            <div key={m.id} className="kiva-pinned-item">
              <b style={{ fontSize: 12 }}>{m.first_name || m.username || 'Kin'}: </b>
              <EmojiText text={m.body} glyphs={glyphs} size={16} />
            </div>
          ))}
        </div>
      )}

      <div className="kiva-scroll" onClick={() => setReactFor(null)}>
        <AnimatePresence initial={false}>
          {messages.map((m) => <Bubble key={m.id} m={m} />)}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="kiva-composer glass strong">
        <EmojiPicker onPick={insertEmoji} anchorRef={emojiAnchor} />
        <input
          ref={inputRef}
          className="kiva-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Speak to the tribe…"
          onKeyDown={(e) => e.key === 'Enter' && post()}
        />
        <button
          onClick={post}
          disabled={!draft.trim()}
          className="btn primary"
          style={{ opacity: !draft.trim() ? 0.5 : 1 }}
        >Send</button>
      </div>
    </motion.div>
  );
}
