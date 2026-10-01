import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { initData } from '../lib/telegram.js';
import Icon from '../components/Icon.jsx';
import Emoji, { EmojiText } from '../components/Emoji.jsx';
import EmojiPicker from '../components/EmojiPicker.jsx';
import { toast } from '../components/Toast.jsx';

export default function TribeKiva() {
  const nav = useNavigate();
  const { data } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;
  const user = data?.user || {};

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const bottomRef = useRef(null);
  const streamRef = useRef(null);

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
          if (evt.type === 'message' && evt.message) setMessages((m) => [...m, evt.message]);
        } catch {}
      };
      streamRef.current = es;
    }

    return () => { alive = false; streamRef.current?.close?.(); };
  }, [tribe?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function post() {
    const body = draft.trim();
    if (!body) return;
    haptic('light');
    try {
      const r = await apiPost('/api/kiva', { body });
      const msg = (r.data || r).message || r.message;
      if (msg) setMessages((m) => [...m, msg]);
      setDraft('');
    } catch (e) { toast(e.message || 'Could not send', 'bad'); }
  }

  function insertEmoji(key) {
    setDraft((d) => d + ' :' + key + ': ');
  }

  if (!tribe) {
    return (
      <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
        <h2 className="display" style={{ fontSize: 20 }}>Join a tribe first</h2>
        <Button variant="primary" style={{ marginTop: 12 }} onClick={() => nav('/tribe')}>Back</Button>
      </div>
    );
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Kiva</h2>
        </div>
      </div>

      {loadError && (
        <div className="glass card" style={{ borderColor: 'var(--blood-400)', textAlign: 'center', padding: 20 }}>
          <b>Could not open the Kiva</b>
          <p className="tiny" style={{ marginTop: 6 }}>{loadError}</p>
        </div>
      )}

      <div className="kiva-scroll">
        {messages.map((m) => (
          <div key={m.id} className={`kiva-bubble${Number(m.user_id) === Number(user.id) ? ' mine' : ''}${m.role === 'Chief' ? ' chief' : ''}`}>
            {Number(m.user_id) !== Number(user.id) && (
              <b style={{ fontSize: 12.5, color: 'var(--ember-200)' }}>{m.first_name || m.username || 'Kin'}</b>
            )}
            {m.body && (
              <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>
                <EmojiText size={18}>{m.body}</EmojiText>
              </span>
            )}
            <span className="tiny" style={{ marginTop: 4 }}>
              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="kiva-composer glass strong">
        <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => setPickerOpen(true)}>
          <Emoji name="smile" size={18} />
        </button>
        <input
          className="kiva-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Speak to the tribe…"
          onKeyDown={(e) => e.key === 'Enter' && post()}
        />
        <button
          onClick={post}
          disabled={!draft.trim()}
          style={{
            padding: '10px 16px', borderRadius: 999,
            background: 'linear-gradient(180deg, var(--ember-400), var(--ember-600))',
            color: '#1a0b02', fontWeight: 700,
            opacity: !draft.trim() ? 0.5 : 1
          }}
        >Send</button>
      </div>

      <EmojiPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={insertEmoji} />
    </motion.div>
  );
}