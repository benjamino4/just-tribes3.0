// TRIBES-FILE: web/src/screens/Kiva.jsx
// PHASE: 5 — Council & Kiva
// Parchment scroll UI, live SSE messages, polls, seals, curfew, boons.
// Obsidian Glass v3 with custom SVG emojis.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { openKivaStream } from '../lib/kivaStream.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Sheet from '../components/Sheet.jsx';
import EmojiPicker from '../components/EmojiPicker.jsx';
import Emoji, { EmojiText } from '../components/Emoji.jsx';
import { toast } from '../components/Toast.jsx';

export default function Kiva() {
  const nav = useNavigate();
  const { data } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const tribe = data?.tribe;

  const [messages, setMessages] = useState([]);
  const [curfew, setCurfew] = useState(null);
  const [draft, setDraft] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [boonsOpen, setBoonsOpen] = useState(false);
  const streamRef = useRef(null);
  const bottomRef = useRef(null);

  const isChief = user.role === 'Chief';

  useEffect(() => {
    if (!tribe) return;
    (async () => {
      try {
        const r = await apiGet('/api/kiva');
        setMessages(r.messages || []);
        setCurfew(r.curfew || null);
      } catch (e) {
        toast(e.message || 'Could not open the Kiva', 'bad');
      }
    })();

    streamRef.current = openKivaStream(tribe.id, {
      onEvent: (evt) => {
        if (evt.type === 'message' && evt.message) {
          setMessages((m) => [...m, evt.message]);
        }
        if (evt.type === 'seal' && evt.id) {
          setMessages((m) => m.map((x) => x.id === evt.id ? { ...x, pinned: evt.pinned } : x));
        }
        if (evt.type === 'poll' && evt.id) {
          setMessages((m) => m.map((x) => x.id === evt.id ? { ...x, poll_data: evt.poll } : x));
        }
        if (evt.type === 'curfew') {
          if (evt.ended) setCurfew(null);
          else setCurfew({ started_by: evt.started_by, ends_at: evt.ends_at });
        }
      },
    });

    return () => { streamRef.current?.close?.(); };
  }, [tribe?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function post() {
    const body = draft.trim();
    if (!body) return;
    if (curfew && curfew.started_by !== user.id && !isChief) {
      toast('Curfew in effect — only the Chief may speak', 'info');
      return;
    }
    haptic('light');
    try {
      const r = await apiPost('/api/kiva', { body });
      setMessages((m) => [...m, r.message]);
      setDraft('');
    } catch (e) {
      toast(e.message || 'Could not send', 'bad');
    }
  }

  async function seal(msg) {
    try {
      const r = await apiPost('/api/kiva/seal', { id: msg.id, sealed: !msg.pinned });
      setMessages((m) => m.map((x) => x.id === msg.id ? { ...x, pinned: r.pinned } : x));
      if (r.cost) toast(`Sealed · ${r.cost} ⭐`, 'good');
      else toast(r.pinned ? 'Sealed' : 'Unsealed', 'good');
    } catch (e) {
      if (e.data?.need) toast(`Not enough Stars · need ${e.data.need}`, 'bad');
      else toast(e.message || 'Could not seal', 'bad');
    }
  }

  async function vote(msg, idx) {
    try {
      const r = await apiPost('/api/kiva/vote', { id: msg.id, option: idx });
      setMessages((m) => m.map((x) => x.id === msg.id ? { ...x, poll_data: r.poll } : x));
      haptic('success');
    } catch (e) {
      toast(e.message || 'Could not vote', 'bad');
    }
  }

  async function liftCurfew() {
    try {
      await apiPost('/api/kiva/curfew', { end: true });
      toast('Curfew lifted', 'good');
    } catch (e) {
      toast(e.message || 'Could not lift', 'bad');
    }
  }

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 32 }}>
          <Emoji name="lock" size={48} />
          <h2 className="display" style={{ fontSize: 22, marginTop: 12 }}>The Kiva is silent</h2>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            Join a tribe to enter the fireside.
          </p>
          <Button variant="primary" block onClick={() => nav('/longhouse')}>
            Find a Tribe
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Kiva</h2>
          <Hint text="Your tribe's fireside. Five emojis are free. Unlock spirit sets with Stars. Chiefs may seal messages and call a Curfew to lock the board." />
        </div>
        <Button variant="ghost" onClick={() => setBoonsOpen(true)}>
          <Icon name="crown" size={14} />
          Boons
        </Button>
      </div>

      {curfew && (
        <div className="kiva-curfew" style={{ marginBottom: 10 }}>
          <Icon name="lock" size={14} style={{ color: '#e0c6ff' }} />
          <span className="grow">
            Curfew in effect. {isChief ? 'You called it — only you may speak.' : 'Only the Chief may speak.'}
          </span>
          {isChief && <Button variant="ghost" onClick={liftCurfew}>Lift</Button>}
        </div>
      )}

      <div className="kiva-scroll">
        {messages.map((m) => (
          <KivaBubble
            key={m.id}
            m={m}
            mine={Number(m.user_id) === Number(user.id)}
            chief={m.role === 'Chief'}
            onSeal={() => seal(m)}
            onVote={(idx) => vote(m, idx)}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* composer */}
      <div className="kiva-composer glass strong">
        <button
          className="chip"
          style={{ padding: 9, borderRadius: 999 }}
          onClick={() => { haptic('light'); setEmojiOpen(true); }}
          aria-label="Open emoji"
        >
          <Emoji name="smile" size={18} />
        </button>

        {isChief && (
          <button
            className="chip"
            style={{ padding: 9, borderRadius: 999 }}
            onClick={() => { haptic('light'); setPollOpen(true); }}
            aria-label="Open poll composer"
          >
            <Icon name="ranks" size={16} />
          </button>
        )}

        <input
          className="kiva-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={curfew && !isChief ? 'Curfew in effect…' : 'Speak to the tribe…'}
          onKeyDown={(e) => e.key === 'Enter' && post()}
          disabled={!!curfew && !isChief}
        />

        <Button
          variant="primary"
          onClick={post}
          disabled={!draft.trim() || (!!curfew && !isChief)}
        >
          Send
        </Button>
      </div>

      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onPick={(key) => setDraft((d) => d + ' :' + key + ': ')}
      />

      <PollSheet
        open={pollOpen}
        onClose={() => setPollOpen(false)}
        onPost={async (payload) => {
          try {
            const r = await apiPost('/api/kiva/poll', payload);
            setMessages((m) => [...m, r.message]);
            if (payload.curfew) {
              setCurfew({
                started_by: user.id,
                ends_at: new Date(Date.now() + (payload.hours || 3) * 3600 * 1000).toISOString(),
              });
            }
            setPollOpen(false);
            toast('Poll posted', 'good');
          } catch (e) {
            toast(e.message || 'Could not post poll', 'bad');
          }
        }}
      />

      <BoonsSheet open={boonsOpen} onClose={() => setBoonsOpen(false)} />
    </motion.div>
  );
}

/* ---------- bubble ---------- */
function KivaBubble({ m, mine, chief, onSeal, onVote }) {
  const cls = [
    'kiva-bubble',
    mine ? 'mine' : '',
    chief ? 'chief' : '',
    m.kind === 'system' ? 'system' : '',
    m.kind === 'war' ? 'war' : '',
    m.kind === 'relic' ? 'relic' : '',
    m.kind === 'poll' ? 'poll' : '',
  ].filter(Boolean).join(' ');

  if (m.kind === 'system') {
    return <div className={cls}><EmojiText size={14}>{m.body}</EmojiText></div>;
  }

  return (
    <motion.div
      className={cls}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ position: 'relative' }}
    >
      {chief && (
        <motion.div
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', top: 0, left: 0,
            height: 2, width: '40%',
            background: 'linear-gradient(90deg, transparent, var(--gold-300), transparent)',
            pointerEvents: 'none',
            borderRadius: 2,
          }}
        />
      )}

      {!mine && (
        <div className="row between" style={{ marginBottom: 3 }}>
          <b style={{
            fontSize: 12.5,
            color: chief ? 'var(--gold-300)' : 'var(--ember-200)',
          }}>
            {m.first_name || m.username || 'Kin'}
          </b>
          <span className="tiny">{m.role}</span>
        </div>
      )}

      {m.pinned && (
        <div style={{ marginBottom: 6 }}>
          <span className="kiva-seal">
            <Icon name="lock" size={11} />
            Sealed
          </span>
        </div>
      )}

      {m.body && (
        <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>
          <EmojiText size={18}>{m.body}</EmojiText>
        </span>
      )}

      {m.poll_data && (
        <KivaPoll poll={m.poll_data} onVote={onVote} />
      )}

      <div className="row between" style={{ marginTop: 6 }}>
        <span className="tiny">
          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <button onClick={onSeal} className="tiny" style={{
          color: m.pinned ? 'var(--gold-300)' : 'var(--ink-faint)',
          background: 'none',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          <Icon name="lock" size={11} />
          {m.pinned ? 'Unseal' : 'Seal'}
        </button>
      </div>
    </motion.div>
  );
}

/* ---------- poll ---------- */
function KivaPoll({ poll, onVote }) {
  const total = (poll.opts || []).reduce((s, o) => s + (o.v || 0), 0) || 1;
  return (
    <div className="kiva-poll">
      <b style={{ fontSize: 14 }}>{poll.q}</b>
      {(poll.opts || []).map((o, i) => {
        const pct = Math.round((o.v || 0) / total * 100);
        return (
          <button key={i} className="kiva-poll-opt" onClick={() => onVote(i)}>
            <motion.span
              className="kiva-poll-fill"
              initial={{ width: 0 }}
              animate={{ width: pct + '%' }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
            <span style={{
              position: 'relative',
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 13.5,
            }}>
              <span>{o.t}</span>
              <b>{pct}%</b>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- poll sheet ---------- */
function PollSheet({ open, onClose, onPost }) {
  const [q_, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);
  const [hours, setHours] = useState(3);
  const [curfew, setCurfew] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title="Post a poll">
      <input
        style={{ width: '100%', padding: '11px 12px', borderRadius: 12, background: 'rgba(255,243,208,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14 }}
        placeholder="Ask the tribe…"
        value={q_}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="col" style={{ gap: 8, marginTop: 10 }}>
        {opts.map((o, i) => (
          <input key={i}
            style={{ width: '100%', padding: '11px 12px', borderRadius: 12, background: 'rgba(255,243,208,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14 }}
            placeholder={`Option ${i + 1}`}
            value={o}
            onChange={(e) => setOpts((arr) => arr.map((x, j) => j === i ? e.target.value : x))}
          />
        ))}
        {opts.length < 4 && (
          <Button variant="ghost" block onClick={() => setOpts((arr) => [...arr, ''])}>
            <Icon name="plus" size={14} /> Add option
          </Button>
        )}
      </div>

      <div className="row" style={{ gap: 8, marginTop: 14 }}>
        <label className="tiny" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={curfew} onChange={(e) => setCurfew(e.target.checked)} />
          Call a Curfew for {hours}h
        </label>
        <input
          type="number" min="1" max="24" value={hours}
          onChange={(e) => setHours(Number(e.target.value) || 3)}
          style={{ width: 60, padding: '6px 8px', borderRadius: 8, background: 'rgba(255,243,208,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)' }}
        />
      </div>

      <Button
        variant="primary" block haptic="heavy"
        disabled={q_.trim().length < 2 || opts.filter((o) => o.trim()).length < 2}
        style={{ marginTop: 14 }}
        onClick={() => onPost({
          q: q_.trim(),
          opts: opts.filter((o) => o.trim()),
          hours,
          curfew,
        })}
      >
        Post poll
      </Button>
    </Sheet>
  );
}

/* ---------- boons sheet ---------- */
function BoonsSheet({ open, onClose }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try { setData(await apiGet('/api/kiva/boons')); } catch {}
    })();
  }, [open]);

  async function buy(slug) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await apiPost('/api/kiva/boons/buy', { slug });
      toast(r.free ? "Chief's gift — free" : 'Boon purchased', 'good');
      const fresh = await apiGet('/api/kiva/boons');
      setData(fresh);
    } catch (e) {
      if (e.data?.need) toast(`Not enough Stars · need ${e.data.need}`, 'bad');
      else toast(e.message || 'Could not buy', 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Chief's Boons">
      {!data && <p className="muted">Loading…</p>}
      {data && (data.catalog || []).map((b) => {
        const owned = data.active?.[b.id];
        return (
          <div key={b.id} className="glass card" style={{ marginBottom: 10 }}>
            <div className="row between">
              <div className="col" style={{ gap: 1 }}>
                <b className="row" style={{ gap: 6 }}>
                  {b.name}
                  {b.chiefFree && <Icon name="crown" size={12} style={{ color: 'var(--gold-300)' }} />}
                </b>
                <span className="tiny">{b.desc}</span>
              </div>
              {owned ? (
                <span className="chip" style={{ color: 'var(--good)' }}>Active</span>
              ) : (
                <Button variant="primary" disabled={busy} onClick={() => buy(b.id)}>
                  {b.chiefFree ? 'Free' : `${b.price} ⭐`}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}
