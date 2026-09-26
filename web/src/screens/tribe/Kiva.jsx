import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import Icon from '../../components/Icon.jsx';
import { Button } from '../../components/UI.jsx';
import Sheet from '../../components/Sheet.jsx';
import { toast } from '../../components/Toast.jsx';
import { useConfig } from '../../lib/config.js';
import { useGame } from '../../store.js';
import { haptic } from '../../lib/telegram.js';
import EmojiPicker from './EmojiPicker.jsx';
import PollComposer from './PollComposer.jsx';

const SEED = [
  { id: 1, who: 'Kael', role: 'Chief', text: 'The Pyre burns bright tonight. Feed it, Kin.', chief: true, sealed: true, mine: false, ts: '19:02' },
  { id: 2, who: 'Mira', role: 'Elder', text: 'Stormfang masses at the ridge. Ready the ash.', mine: false, ts: '19:04' },
  { id: 3, who: 'You', role: 'Hunter', text: 'On it — gathering now 🔥', mine: true, ts: '19:05' },
  { id: 4, who: 'Vex', role: 'Hunter', text: '', poll: { q: 'Attack at dawn?', opts: [{ t: 'Aye', v: 12 }, { t: 'Hold', v: 3 }] }, mine: false, ts: '19:07' },
];

export default function Kiva() {
  const cfg = useConfig((s) => s.cfg);
  const update = useConfig((s) => s.update);
  const stars = useGame((s) => s.data?.user?.stars) || 0;
  const [msgs, setMsgs] = useState(SEED);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [poll, setPoll] = useState(false);
  const [owned, setOwned] = useState([]); // unlocked emoji set ids
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  function send(extra = {}) {
    const t = text.trim();
    if (!t && !extra.poll) return;
    haptic('light');
    setMsgs((m) => [...m, { id: Date.now(), who: 'You', role: 'Hunter', text: t, mine: true, ts: 'now', ...extra }]);
    setText('');
  }

  function seal(id) {
    haptic('success');
    setMsgs((m) => m.map((x) => x.id === id ? { ...x, sealed: !x.sealed } : x));
    toast(`Message ${cfg.seal.term}ed · ${cfg.seal.price} ⭐`, 'good');
  }

  function unlockSet(set) {
    if (owned.includes(set.id)) return;
    setOwned((o) => [...o, set.id]); haptic('success');
    toast(`${set.name} unlocked!`, 'good');
  }

  return (
    <SubPage title="The Kiva" hint="Your tribe's fireside chat. Five emojis are free — unlock spirit & beast sets with Stars. Seal a message to pin it. Chiefs speak in gold.">
      <div className="col" style={{ gap: 8, paddingBottom: 96 }}>
        {msgs.map((m) => <Bubble key={m.id} m={m} onSeal={() => seal(m.id)} sealTerm={cfg.seal.term} />)}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="kiva-composer glass strong">
        <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => { haptic('light'); setPoll(true); }} aria-label="Poll"><Icon name="poll" size={18} /></button>
        <input className="kiva-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Speak to the tribe…" onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => { haptic('light'); setPicker(true); }} aria-label="Emoji">😀</button>
        <motion.button whileTap={{ scale: 0.9 }} className="btn primary" style={{ padding: '9px 14px', borderRadius: 999 }} onClick={() => send()}><Icon name="chevron" size={18} /></motion.button>
      </div>

      <Sheet open={picker} onClose={() => setPicker(false)} title="Emoji">
        <EmojiPicker cfg={cfg} owned={owned} stars={stars} onPick={(e) => { setText((t) => t + e); setPicker(false); }} onUnlock={unlockSet}
          onEditPrice={(id, price) => update((c) => { const s = c.emojiSets.find((x) => x.id === id); if (s) s.price = price; })} />
      </Sheet>

      <Sheet open={poll} onClose={() => setPoll(false)} title="Create a poll">
        <PollComposer onCreate={(p) => { send({ poll: p, text: '' }); setPoll(false); toast('Poll posted', 'good'); }} />
      </Sheet>
    </SubPage>
  );
}

function Bubble({ m, onSeal, sealTerm }) {
  const gold = m.chief;
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }}
      className={`kiva-bubble ${m.mine ? 'mine' : ''} ${gold ? 'chief' : ''}`}>
      {!m.mine && <div className="row between" style={{ marginBottom: 3 }}><b style={{ fontSize: 12.5, color: gold ? 'var(--gold)' : 'var(--ember-200)' }}>{m.who}</b><span className="tiny">{m.role}</span></div>}
      {m.sealed && <div className="row" style={{ gap: 4, marginBottom: 4 }}><Icon name="lock" size={12} style={{ color: 'var(--gold)' }} /><span className="tiny" style={{ color: 'var(--gold)' }}>{sealTerm}</span></div>}
      {m.text && <span style={{ fontSize: 14.5, lineHeight: 1.45 }}>{m.text}</span>}
      {m.poll && <PollView poll={m.poll} />}
      <div className="row between" style={{ marginTop: 5 }}>
        <span className="tiny">{m.ts}</span>
        <button onClick={onSeal} className="tiny" style={{ color: m.sealed ? 'var(--gold)' : 'var(--ink-faint)', background: 'none', display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="lock" size={11} /> {m.sealed ? 'Unseal' : 'Seal'}</button>
      </div>
    </motion.div>
  );
}

function PollView({ poll }) {
  const [votes, setVotes] = useState(poll.opts);
  const [picked, setPicked] = useState(-1);
  const total = votes.reduce((a, b) => a + b.v, 0) || 1;
  return (
    <div className="col" style={{ gap: 6, marginTop: 4 }}>
      <b style={{ fontSize: 14 }}>{poll.q}</b>
      {votes.map((o, i) => {
        const pct = Math.round((o.v / total) * 100);
        return (
          <button key={i} onClick={() => { if (picked >= 0) return; haptic('select'); setPicked(i); setVotes((v) => v.map((x, j) => j === i ? { ...x, v: x.v + 1 } : x)); }}
            style={{ position: 'relative', textAlign: 'left', padding: '8px 10px', borderRadius: 10, overflow: 'hidden', border: picked === i ? '1px solid var(--ember-400)' : '1px solid var(--glass-brd)', background: 'rgba(255,255,255,.04)' }}>
            <motion.span initial={{ width: 0 }} animate={{ width: (picked >= 0 ? pct : 0) + '%' }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} style={{ position: 'absolute', inset: 0, background: 'rgba(255,122,24,.18)' }} />
            <span style={{ position: 'relative', fontSize: 13.5, display: 'flex', justifyContent: 'space-between' }}><span>{o.t}</span>{picked >= 0 && <b>{pct}%</b>}</span>
          </button>
        );
      })}
    </div>
  );
}
