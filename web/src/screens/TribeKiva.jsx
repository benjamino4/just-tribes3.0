import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { apiGet, apiPost, Endpoints } from '../lib/api.js';
import { initData } from '../lib/telegram.js';
import { toast } from '../components/Toast.jsx';
import { EmojiText, EmojiPicker, useEmoji } from '../components/EmojiKit.jsx';

export default function TribeKiva() {
  const nav = useNavigate();
  const { data } = useApp();
  const tribe = data?.tribe;
  const user = data?.user || {};
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState(null);
  const bottomRef = useRef(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const emojiAnchor = useRef(null);
  const { glyphs } = useEmoji();

  // De-duplicate by message id. Protects against the sender seeing their own
  // message twice (once from the optimistic append, once echoed back over SSE).
  function mergeMessages(prev, incoming) {
    const list = Array.isArray(incoming) ? incoming : [incoming];
    const seen = new Set(prev.map((m) => Number(m.id)));
    const add = [];
    for (const m of list) {
      if (!m) continue;
      const id = Number(m.id);
      if (seen.has(id)) continue;
      seen.add(id);
      add.push(m);
    }
    if (!add.length) return prev;
    return [...prev, ...add];
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
          if (evt.type === 'message' && evt.message) setMessages((m) => mergeMessages(m, evt.message));
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
      const r = await apiPost('/api/kiva', { body });
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

  if (!tribe) {
    return <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>Join a tribe first</div>;
  }

  return (
    <motion.div className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
          <h2 className="display" style={{ fontSize: 22 }}>The Kiva</h2>
        </div>
      </div>
      {loadError && (
        <div className="glass card" style={{ borderColor: 'var(--rose-300)', textAlign: 'center', padding: 20 }}>
          <b>Could not open the Kiva</b>
          <p className="tiny" style={{ marginTop: 6 }}>{loadError}</p>
        </div>
      )}
      <div className="kiva-scroll">
        {messages.map((m) => (
          <div key={m.id} className={`kiva-bubble${Number(m.user_id) === Number(user.id) ? ' mine' : ''}`}>
            {Number(m.user_id) !== Number(user.id) && (
              <b style={{ fontSize: 12.5, color: 'var(--ember-200)' }}>{m.first_name || m.username || 'Kin'}</b>
            )}
            <span style={{ fontSize: 14.5, lineHeight: 1.45 }}><EmojiText text={m.body} glyphs={glyphs} /></span>
            <span className="tiny" style={{ marginTop: 4 }}>
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
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