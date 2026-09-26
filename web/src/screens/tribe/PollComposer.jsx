import React, { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Button } from '../../components/UI.jsx';

export default function PollComposer({ onCreate }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState(['', '']);

  const inp = { width: '100%', padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,.06)', border: '1px solid var(--glass-brd)', color: 'var(--ink)', fontSize: 14 };

  return (
    <div className="col" style={{ gap: 10 }}>
      <input style={inp} placeholder="Ask the tribe…" value={q} onChange={(e) => setQ(e.target.value)} />
      {opts.map((o, i) => (
        <div key={i} className="row" style={{ gap: 8 }}>
          <input style={inp} placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpts((a) => a.map((x, j) => j === i ? e.target.value : x))} />
          {opts.length > 2 && <button className="chip" style={{ padding: 9 }} onClick={() => setOpts((a) => a.filter((_, j) => j !== i))}><Icon name="trash" size={16} /></button>}
        </div>
      ))}
      {opts.length < 4 && <Button variant="ghost" block onClick={() => setOpts((a) => [...a, ''])}><Icon name="plus" size={16} /> Add option</Button>}
      <Button variant="primary" block disabled={!q.trim() || opts.filter((o) => o.trim()).length < 2}
        onClick={() => onCreate({ q: q.trim(), opts: opts.filter((o) => o.trim()).map((t) => ({ t, v: 0 })) })}>Post poll</Button>
    </div>
  );
}
