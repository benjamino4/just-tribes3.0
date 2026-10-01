import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import LivingFire from '../components/LivingFire.jsx';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';
import { celebrate } from '../lib/celebrate.jsx';

const TILES = [
  { to: '/arena',  name: 'Arena',  icon: 'swords', tone: 'var(--ember-400)', shape: 'shield' },
  { to: '/tribe',  name: 'Tribe',  icon: 'tribe',  tone: 'var(--gold-300)',  shape: 'blob'   },
  { to: '/vault',  name: 'Vault',  icon: 'relic',  tone: 'var(--lapis-400)', shape: 'curved' }
];

const SHAPES = {
  shield: '32px 32px 46% 46% / 32px 32px 60% 60%',
  blob: '46% 54% 42% 58% / 55% 45% 55% 45%',
  curved: '40px'
};

export default function Hearth() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const ash = data?.ash || {};
  const daily = data?.daily || [];
  const firstPack = data?.firstPack;
  const streak = Number(user.streak || 0);

  const [ashSheet, setAshSheet] = useState(false);
  const [firstPackSheet, setFirstPackSheet] = useState(false);
  const [extended, setExtended] = useState(false);

  const checkinDone = daily.find((d) => d.slug === 'dq_checkin')?.claimed;

  async function doCheckin() {
    try {
      const r = await apiPost('/api/checkin');
      const body = r.data || r;
      if (!body.ok && body.reason === 'already') { toast('Already fed today', 'info'); return; }
      celebrate({
        title: 'The fire roars',
        subtitle: `Day ${body.streak}`,
        emoji: 'reaction-fire',
        tone: 'ember',
        reward: `+${fmt(body.reward)} Sparks`
      });
      reload();
    } catch (e) { toast(e.message || 'Check-in failed', 'bad'); }
  }

  async function collectAsh() {
    try {
      const r = await apiPost('/api/ash/collect');
      const body = r.data || r;
      if (!body.ok) { toast('Not ready yet', 'info'); return; }
      toast(`+${fmt(body.gain)} Sparks`, 'good');
      setAshSheet(false);
      reload();
    } catch (e) { toast(e.message || 'Collect failed', 'bad'); }
  }

  async function claimFirstPack() {
    try {
      const r = await apiPost('/api/first-pack/claim');
      const body = r.data || r;
      toast(`+${fmt(body.sparks)} Sparks`, 'good');
      setFirstPackSheet(false);
      reload();
    } catch (e) { toast(e.message || 'Could not claim', 'bad'); }
  }

  async function claimTask(id) {
    try {
      const r = await apiPost(`/api/daily/${id}/claim`);
      const body = r.data || r;
      toast(`+${fmt(body.reward_sparks)} Sparks`, 'good');
      reload();
    } catch (e) { toast(e.message || 'Not ready', 'bad'); }
  }

  return (
    <motion.div className="col" style={{ gap: 4 }} variants={V.page} initial="initial" animate="animate">
      <div className="glass hero card" style={{
        paddingTop: 8, textAlign: 'center', overflow: 'hidden',
        position: 'relative', minHeight: extended ? 520 : 380,
        transition: 'min-height .4s cubic-bezier(.34,1.3,.5,1)'
      }}
      onClick={() => { haptic('light'); setExtended((v) => !v); }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Hint slug="hearth" text="Your Hearth tracks your daily streak. Feed it every day to earn Sparks." />
        </div>
        <div style={{ marginTop: extended ? 20 : 4 }}>
          <LivingFire streak={streak} extended={extended} />
        </div>
        {!extended && <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>The Hearth</h2>}
        {extended && <p className="tiny" style={{ marginTop: 90 }}>The flame remembers <b>{streak} days</b>.</p>}
        {!extended && <p className="tiny" style={{ margin: '4px 0 14px' }}>Feed it daily · <b>{streak} days</b></p>}
        <Button
          variant="primary" size="lg" block haptic="heavy"
          onClick={(e) => { e.stopPropagation(); doCheckin(); }}
          disabled={!!checkinDone}
          style={{ marginTop: 6, position: 'relative', zIndex: 2 }}
        >
          <Icon name="hearth" size={20} />
          {checkinDone ? 'Fire fed today' : 'Feed the Fire'}
        </Button>
      </div>

      {firstPack?.available && (
        <motion.div
          className="glass card"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
          onClick={() => { haptic('light'); setFirstPackSheet(true); }}
        >
          <Icon name="star" size={26} style={{ color: 'var(--gold-300)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>First Pack available</b>
            <div className="tiny">+{fmt(firstPack.sparks)} Sparks</div>
          </div>
          <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
        </motion.div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {TILES.map((t, i) => (
          <motion.button
            key={t.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...M.buoyant, delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('medium'); nav(t.to); }}
            className="glass"
            style={{
              padding: 18, textAlign: 'left',
              borderRadius: SHAPES[t.shape],
              minHeight: 118,
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              borderColor: 'var(--glass-brd)',
              background: 'linear-gradient(160deg, rgba(31,29,40,0.55), rgba(11,10,16,0.72))'
            }}
          >
            <Icon name={t.icon} size={34} style={{ color: t.tone }} />
            <div className="row between" style={{ width: '100%' }}>
              <b style={{ fontSize: 15 }}>{t.name}</b>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        ))}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { haptic('medium'); setAshSheet(true); }}
          className="glass"
          style={{
            padding: 18, textAlign: 'left', borderRadius: 'var(--r-lg)',
            minHeight: 118, display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}
        >
          <Icon name="ash" size={34} style={{ color: 'var(--bone-200)' }} />
          <div className="row between" style={{ width: '100%' }}>
            <b style={{ fontSize: 15 }}>Ash</b>
            <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
          </div>
        </motion.button>
      </div>

      {daily.length > 0 && (
        <>
          <div className="sec-h"><h3>Daily Tasks</h3><span className="line" /></div>
          {daily.map((t) => {
            const done = t.progress >= t.goal_amount;
            return (
              <div key={t.id} className="glass card">
                <div className="row between">
                  <div className="row">
                    <span className="crest-art" style={{ background: t.claimed ? 'linear-gradient(180deg,#2a6b45,#164028)' : 'linear-gradient(180deg,#3a2c1c,#1c1208)' }}>
                      <Icon name={t.claimed ? 'check' : 'bolt'} size={18} style={{ color: t.claimed ? 'var(--good)' : 'var(--gold-300)' }} />
                    </span>
                    <div className="col" style={{ gap: 1 }}>
                      <b style={{ fontSize: 14 }}>{t.title}</b>
                      <span className="tiny">{t.claimed ? 'Claimed' : `${t.progress}/${t.goal_amount} · +${fmt(t.reward_sparks)} Sparks`}</span>
                    </div>
                  </div>
                  {t.claimed ? <span className="chip" style={{ color: 'var(--good)' }}>Done</span> :
                    <Button variant={done ? 'primary' : 'ghost'} onClick={() => done ? claimTask(t.id) : toast('Finish first', 'info')}>
                      {done ? 'Claim' : 'View'}
                    </Button>}
                </div>
              </div>
            );
          })}
        </>
      )}

      <Sheet open={ashSheet} onClose={() => setAshSheet(false)} title="Gather the Ash">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          Ash pools every {ash.interval_min || 30} minutes into Sparks you can collect.
        </p>
        <div className="row between" style={{ margin: '16px 0' }}>
          <div className="col"><span className="tiny">Per pool</span><b>{fmt(ash.per_pool || 0)}</b></div>
          <div className="col"><span className="tiny">Stored</span><b>{ash.pools_stored || 0}</b></div>
        </div>
        <Button variant="primary" block disabled={(ash.pools_stored || 0) < 1} onClick={collectAsh}>
          {(ash.pools_stored || 0) > 0 ? 'Collect' : 'Not ready'}
        </Button>
      </Sheet>

      <Sheet open={firstPackSheet} onClose={() => setFirstPackSheet(false)} title="First Pack">
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
          A welcome gift. Claim it once within your first {firstPack?.duration_hours || 24} hours.
        </p>
        <Button variant="primary" block onClick={claimFirstPack} style={{ marginTop: 16 }}>Claim</Button>
      </Sheet>
    </motion.div>
  );
}