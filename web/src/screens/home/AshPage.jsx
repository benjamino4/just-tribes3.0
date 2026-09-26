import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import SubPage from '../../components/SubPage.jsx';
import { Card, Button, ProgressBar } from '../../components/UI.jsx';
import AnimatedIcon from '../../components/AnimatedIcon.jsx';
import { useGame } from '../../store.js';
import { api } from '../../lib/api.js';
import { toast } from '../../components/Toast.jsx';
import { fmt, timeLeft } from '../../lib/format.js';

export default function AshPage() {
  const { data } = useGame();
  const ash = data?.ash || {};
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const readyAt = data?.user?.ash_ready_at ? new Date(data.user.ash_ready_at).getTime() : 0;
  const left = readyAt ? readyAt - now : 0;
  const ready = (ash.pools_stored || 0) > 0 || left <= 0;

  async function gather() {
    try { await useGame.getState().act(() => api.collectAsh()); }
    catch (e) {
      const d = useGame.getState().data; const gain = (d.ash.pools_stored || 1) * (d.ash.per_pool || 400);
      useGame.getState().patch({ user: { ...d.user, ember: (d.user.ember || 0) + gain, ash_ready_at: new Date(now + (d.ash.interval_min || 30) * 60000).toISOString() }, ash: { ...d.ash, pools_stored: 0 } });
    }
    toast('Ash gathered into Ember', 'good');
  }

  return (
    <SubPage title="Gather the Ash" hint="The fire leaves glowing ash that pools into Ember over time — even while you're away. Collect it, then upgrade your Hearth to pool faster and hold more.">
      <Card strong style={{ textAlign: 'center', overflow: 'hidden' }}>
        <motion.div animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 6, repeat: Infinity }}><AnimatedIcon name="ash" size={60} tone="var(--ash)" /></motion.div>
        <div className="display" style={{ fontSize: 30 }}>{fmt((ash.pools_stored || 0) * (ash.per_pool || 0))}</div>
        <span className="tiny">Ember waiting · {ash.pools_stored || 0} pools</span>
        <div style={{ margin: '14px 4px' }}>
          <div className="row between tiny" style={{ marginBottom: 6 }}><span>Next pool</span><span>{ready ? 'ready' : timeLeft(left)}</span></div>
          <ProgressBar value={ready ? 100 : 100 - (left / ((ash.interval_min || 30) * 60000)) * 100} max={100} />
        </div>
        <Button variant="primary" block onClick={gather} disabled={!ready}>{ready ? 'Collect now' : 'Not ready'}</Button>
      </Card>
      <Card>
        <div className="row between"><div><b>Upgrade Hearth</b><div className="tiny">Pool faster + bigger cap</div></div><Button variant="ghost">4,200 Ember</Button></div>
      </Card>
    </SubPage>
  );
}
