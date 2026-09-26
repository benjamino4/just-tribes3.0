import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Campfire from '../components/Campfire.jsx';
import Icon from '../components/Icon.jsx';
import { Card, SectionHeader, Button, ProgressBar } from '../components/UI.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';
import { useGame } from '../store.js';
import { api } from '../lib/api.js';
import { fmt, timeLeft } from '../lib/format.js';

const STREAK_GOAL = 7;

export default function Fire() {
  const { data, act } = useGame();
  const [ashSheet, setAshSheet] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const user = data?.user || {};
  const ash = data?.ash || {};
  const daily = data?.daily || [];
  const bonfire = data?.bonfire;
  const war = data?.war;

  const ashReadyAt = user.ash_ready_at ? new Date(user.ash_ready_at).getTime() : 0;
  const ashLeft = ashReadyAt ? ashReadyAt - now : 0;
  const ashReady = ash.pools_stored > 0 || ashLeft <= 0;

  const checkedInToday = daily.find((d) => d.id === 'checkin')?.done;

  async function feedFire() {
    if (checkedInToday) { toast('Already fed today — come back tomorrow', 'info'); return; }
    try {
      await act(() => api.checkin());
      toast('The fire roars. Streak +1', 'good');
    } catch (e) {
      // demo mode: simulate locally
      const d = useGame.getState().data;
      const nd = { ...d, user: { ...d.user, streak: (d.user.streak || 0) + 1, ember: (d.user.ember || 0) + 120 },
        daily: d.daily.map((x) => (x.id === 'checkin' ? { ...x, done: true } : x)) };
      useGame.getState().patch(nd);
      toast('The fire roars. Streak +1', 'good');
    }
  }

  async function gatherAsh() {
    try {
      await act(() => api.collectAsh());
      toast(`Gathered ${fmt(ash.per_pool || 0)} Ember from the ash`, 'good');
    } catch (e) {
      const d = useGame.getState().data;
      const gain = (d.ash.pools_stored || 1) * (d.ash.per_pool || 400);
      useGame.getState().patch({
        user: { ...d.user, ember: (d.user.ember || 0) + gain },
        ash: { ...d.ash, pools_stored: 0, next_ready_in_ms: (d.ash.interval_min || 30) * 60000 },
      });
      const nd = useGame.getState().data;
      nd.user.ash_ready_at = new Date(now + (d.ash.interval_min || 30) * 60000).toISOString();
      toast(`Gathered ${fmt(gain)} Ember from the ash`, 'good');
    }
    setAshSheet(false);
  }

  const streak = user.streak || 0;
  const streakPct = Math.min(100, (streak % STREAK_GOAL || (streak ? STREAK_GOAL : 0)) / STREAK_GOAL * 100);

  return (
    <div className="col" style={{ gap: 4 }}>
      {bonfire?.active && (
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ padding: '10px 14px', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(255,180,100,.4)' }}
        >
          <Icon name="bolt" size={18} style={{ color: 'var(--gold)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>{bonfire.title}</b>
            <div className="tiny">x{bonfire.multiplier} · ends in {timeLeft(bonfire.ends_in_ms)}</div>
          </div>
        </motion.div>
      )}

      {/* Campfire hero */}
      <Card style={{ paddingTop: 8, textAlign: 'center', overflow: 'hidden' }}>
        <Campfire streak={streak} lit />
        <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>The Home Fire</h2>
        <p className="tiny" style={{ margin: '4px 0 14px' }}>
          Feed it daily to keep your streak · <b style={{ color: 'var(--ember-200)' }}>{streak} days</b>
        </p>

        <div style={{ margin: '0 8px 12px' }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="tiny">Streak to next reward</span>
            <span className="tiny tabular">{streak % STREAK_GOAL}/{STREAK_GOAL}</span>
          </div>
          <ProgressBar value={streak % STREAK_GOAL} max={STREAK_GOAL} />
        </div>

        <Button variant="primary" size="lg" block onClick={feedFire} disabled={checkedInToday} haptic="heavy">
          <Icon name="fire" size={20} />
          {checkedInToday ? 'Fire fed today' : 'Feed the Fire  ·  +120'}
        </Button>
      </Card>

      {/* Gather the Ash */}
      <Card>
        <div className="row between">
          <div className="row">
            <span className="crest-art" style={{ background: 'linear-gradient(180deg,#3a3630,#1c1a17)' }}>
              <Icon name="ash" size={18} style={{ color: 'var(--ash)' }} />
            </span>
            <div className="col" style={{ gap: 1 }}>
              <b>Gather the Ash</b>
              <span className="tiny">{ashReady ? 'A pool is ready to collect' : `Next pool in ${timeLeft(ashLeft)}`}</span>
            </div>
          </div>
          <Button variant={ashReady ? 'primary' : 'ghost'} onClick={() => (ashReady ? gatherAsh() : setAshSheet(true))}>
            {ashReady ? 'Collect' : 'Details'}
          </Button>
        </div>
      </Card>

      {/* War strip */}
      {war?.active && (
        <Card className="war-strip">
          <div className="row between" style={{ marginBottom: 8 }}>
            <b className="row" style={{ gap: 6 }}><Icon name="bolt" size={16} style={{ color: 'var(--ember-400)' }} /> Tribe War</b>
            <span className="tiny">ends in {timeLeft(war.ends_in_ms)}</span>
          </div>
          <div className="row between tiny" style={{ marginBottom: 4 }}>
            <span>You · {fmt(war.attacker_score)}</span>
            <span>{war.opponent} · {fmt(war.defender_score)}</span>
          </div>
          <ProgressBar value={war.attacker_score} max={war.attacker_score + war.defender_score} tone={war.attacker_score >= war.defender_score ? 'good' : 'ember'} />
        </Card>
      )}

      {/* Daily quests */}
      <SectionHeader>Daily Quests</SectionHeader>
      {daily.map((q) => (
        <Card key={q.id} className="quest">
          <div className="row between">
            <div className="row">
              <span className="crest-art" style={{ background: q.done ? 'linear-gradient(180deg,#2a6b45,#164028)' : 'linear-gradient(180deg,#3a3630,#1c1a17)' }}>
                <Icon name={q.done ? 'check' : 'spark'} size={18} style={{ color: q.done ? 'var(--good)' : 'var(--gold)' }} />
              </span>
              <div className="col" style={{ gap: 1 }}>
                <b style={{ fontSize: 14 }}>{q.title}</b>
                <span className="tiny">Reward +{fmt(q.reward)} Ember</span>
              </div>
            </div>
            {q.done
              ? <span className="chip" style={{ color: 'var(--good)' }}>Done</span>
              : <Button variant="ghost" onClick={() => toast('Complete the task to claim', 'info')}>Claim</Button>}
          </div>
        </Card>
      ))}

      <Sheet open={ashSheet} onClose={() => setAshSheet(false)} title="Gather the Ash">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          The fire leaves behind glowing ash. It pools every {ash.interval_min || 30} minutes into
          Ember you can collect. Upgrade your hearth to pool faster and hold more.
        </p>
        <div className="row between" style={{ margin: '16px 0' }}>
          <div className="col"><span className="tiny">Per pool</span><b className="tabular">{fmt(ash.per_pool || 0)}</b></div>
          <div className="col"><span className="tiny">Pools stored</span><b className="tabular">{ash.pools_stored || 0}</b></div>
          <div className="col"><span className="tiny">Next in</span><b className="tabular">{timeLeft(ashLeft)}</b></div>
        </div>
        <Button variant="primary" block onClick={gatherAsh} disabled={!ashReady}>
          {ashReady ? 'Collect now' : 'Not ready yet'}
        </Button>
      </Sheet>
    </div>
  );
}
