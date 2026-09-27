// TRIBES-FILE: web/src/screens/Hearth.jsx
// PHASE: 3 — Economy
// Fully wired: check-in, ash, tasks, first-pack, referral, bonfire.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, staggerParent, SECTION_MOTION } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Campfire from '../components/Campfire.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';

export default function Hearth() {
  const nav = useNavigate();
  const { data, reload, act } = useApp();
  const M = useMotionConfig();
  const [tick, setTick] = useState(0);
  const [ashSheet, setAshSheet] = useState(false);
  const [firstPackSheet, setFirstPackSheet] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const user = data?.user || {};
  const tribe = data?.tribe;
  const ash = data?.ash || {};
  const daily = data?.daily || [];
  const bonfire = data?.bonfire;
  const firstPack = data?.firstPack;
  const streak = user.streak || 0;

  const checkinDone = daily.find((d) => d.slug === 'dq_checkin')?.claimed;
  const ashReady = ash.pools_stored > 0;

  async function doCheckin() {
    try {
      const r = await apiPost('/api/checkin');
      if (!r.ok && r.reason === 'already') {
        toast('Already fed today', 'info');
        return;
      }
      toast(`The fire roars. +${fmt(r.reward)} Ember`, 'good');
      reload();
    } catch (e) {
      toast(e.message || 'Check-in failed', 'bad');
    }
  }

  async function doCollectAsh() {
    try {
      const r = await apiPost('/api/ash/collect');
      if (!r.ok) { toast('Not ready yet', 'info'); return; }
      toast(`+${fmt(r.gain)} Ember from the ash`, 'good');
      setAshSheet(false);
      reload();
    } catch (e) {
      toast(e.message || 'Collect failed', 'bad');
    }
  }

  async function claimTask(id) {
    try {
      const r = await apiPost(`/api/daily/${id}/claim`);
      toast(`+${fmt(r.reward_ember)} Ember`, 'good');
      reload();
    } catch (e) {
      toast(e.message || 'Not ready', 'bad');
    }
  }

  async function claimFirstPack() {
    try {
      const r = await apiPost('/api/first-pack/claim');
      toast(`First Pack: +${fmt(r.ember)} Ember`, 'good');
      setFirstPackSheet(false);
      reload();
    } catch (e) {
      toast(e.message || 'Could not claim', 'bad');
    }
  }

  return (
    <motion.div
      className="col"
      style={{ gap: 4 }}
      initial={SECTION_MOTION.hearth.initial}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={M.ember}
    >
      {bonfire?.active && (
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={M.buoyant}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            display: 'flex', alignItems: 'center', gap: 10,
            borderColor: 'rgba(255,180,100,.4)',
          }}
        >
          <Icon name="bolt" size={18} style={{ color: 'var(--gold)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>{bonfire.title}</b>
            <div className="tiny">x{bonfire.multiplier} · ends in {shortTime(bonfire.ends_in_ms)}</div>
          </div>
        </motion.div>
      )}

      {firstPack?.available && (
        <motion.div
          className="glass hero"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={M.ember}
          style={{
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
          }}
          onClick={() => { haptic('light'); setFirstPackSheet(true); }}
        >
          <Icon name="spark" size={26} style={{ color: 'var(--gold)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>First Pack available</b>
            <div className="tiny">+{fmt(firstPack.ember)} Ember waiting</div>
          </div>
          <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
        </motion.div>
      )}

      <div className="glass hero card" style={{ paddingTop: 8, textAlign: 'center', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Hint text="Your Hearth tracks your daily streak. Feed it every day to earn Ember and climb milestone rewards." />
        </div>
        <Campfire streak={streak} lit />
        <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>The Hearth</h2>
        <p className="tiny" style={{ margin: '4px 0 14px' }}>
          Feed it daily · <b style={{ color: 'var(--ember-200)' }}>{streak} days</b>
        </p>
        <div style={{ margin: '0 8px 12px' }}>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="tiny">Streak to next reward</span>
            <span className="tiny tabular">{streak % 7}/7</span>
          </div>
          <div className="bar"><i style={{ width: (streak % 7) / 7 * 100 + '%' }} /></div>
        </div>
        <Button variant="primary" size="lg" block haptic="heavy" onClick={doCheckin} disabled={!!checkinDone}>
          <Icon name="fire" size={20} />
          {checkinDone ? 'Fire fed today' : 'Feed the Fire · +120'}
        </Button>
      </div>

      <div className="glass card">
        <div className="row between">
          <div className="row">
            <span className="crest-art" style={{ background: 'linear-gradient(180deg,#3a3630,#1c1a17)' }}>
              <Icon name="ash" size={18} style={{ color: 'var(--ash)' }} />
            </span>
            <div className="col" style={{ gap: 1 }}>
              <b>Gather the Ash</b>
              <span className="tiny">
                {ashReady ? `A pool is ready · ${ash.pools_stored}` : `Next in ${shortTime(ash.next_ready_in_ms || 0)}`}
              </span>
            </div>
          </div>
          <Button variant={ashReady ? 'primary' : 'ghost'} onClick={() => ashReady ? doCollectAsh() : setAshSheet(true)}>
            {ashReady ? 'Collect' : 'Details'}
          </Button>
        </div>
      </div>

      <div className="sec-h">
        <h3>Daily Tasks</h3>
        <span className="line" />
      </div>

      <motion.div variants={staggerParent(0.05)} initial="initial" animate="animate">
        {daily.map((t) => {
          const done = t.progress >= t.goal_amount;
          return (
            <motion.div key={t.id} variants={V.item}>
              <div className="glass card">
                <div className="row between">
                  <div className="row">
                    <span className="crest-art" style={{
                      background: t.claimed
                        ? 'linear-gradient(180deg,#2a6b45,#164028)'
                        : 'linear-gradient(180deg,#3a3630,#1c1a17)',
                    }}>
                      <Icon name={t.claimed ? 'check' : 'spark'} size={18}
                            style={{ color: t.claimed ? 'var(--good)' : 'var(--gold)' }} />
                    </span>
                    <div className="col" style={{ gap: 1 }}>
                      <b style={{ fontSize: 14 }}>{t.title}</b>
                      <span className="tiny">
                        {t.claimed ? 'Claimed' : `${t.progress}/${t.goal_amount} · +${fmt(t.reward_ember)} Ember`}
                      </span>
                    </div>
                  </div>
                  {t.claimed ? (
                    <span className="chip" style={{ color: 'var(--good)' }}>Done</span>
                  ) : (
                    <Button
                      variant={done ? 'primary' : 'ghost'}
                      onClick={() => done ? claimTask(t.id) : toast('Finish the task first', 'info')}
                    >
                      {done ? 'Claim' : 'View'}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <Sheet open={ashSheet} onClose={() => setAshSheet(false)} title="Gather the Ash">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          The fire leaves glowing ash. It pools every {ash.interval_min || 30} minutes into Ember you can collect.
        </p>
        <div className="row between" style={{ margin: '16px 0' }}>
          <Stat label="Per pool" value={fmt(ash.per_pool || 0)} />
          <Stat label="Stored" value={ash.pools_stored || 0} />
          <Stat label="Next in" value={shortTime(ash.next_ready_in_ms || 0)} />
        </div>
        <Button variant="primary" block disabled={!ashReady} onClick={doCollectAsh}>
          {ashReady ? 'Collect now' : 'Not ready yet'}
        </Button>
      </Sheet>

      <Sheet open={firstPackSheet} onClose={() => setFirstPackSheet(false)} title="First Pack">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          A welcome gift for new tribespeople. Claim it once within your first {firstPack?.duration_hours || 24} hours.
        </p>
        <div className="row between" style={{ margin: '16px 0' }}>
          <Stat label="Ember" value={fmt(firstPack?.ember || 0)} />
          <Stat label="Renown" value={fmt(firstPack?.renown || 0)} />
        </div>
        <Button variant="primary" block onClick={claimFirstPack}>Claim the pack</Button>
      </Sheet>
    </motion.div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="col">
      <span className="tiny">{label}</span>
      <b className="tabular">{value}</b>
    </div>
  );
}