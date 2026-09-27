// =====================================================================
// Hearth — the home screen.
//   • Living Fire (streak-driven, tap-to-extend, dims on loss)
//   • Home War tile (live, vibrates, resolves)
//   • 6 primary tiles + More sheet
//   • Daily tasks
//   • Bonfire + First Pack banners
// =====================================================================
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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

const PRIMARY_TILES = [
  { to: '/war',    name: 'War Room',     icon: 'bolt',  shape: 'shield', tone: '#e0562e' },
  { to: '/trials', name: 'Trials',       icon: 'ranks', shape: 'blob',   tone: '#ff9745' },
  { to: '/forge',  name: 'The Forge',    icon: 'store', shape: 'curved', tone: '#e8b866' },
  { to: '/spin',   name: 'Wheel of Ash', icon: 'spark', shape: 'circle', tone: '#7aa8c4' },
  { to: '/vault',  name: 'The Vault',    icon: 'crown', shape: 'soft',   tone: '#a878c9' },
  { to: '/ash',    name: 'Gather the Ash', icon: 'ash', shape: 'blob',   tone: '#8a7f6e' },
];

const MORE_GROUPS = [
  {
    label: 'Tribe',
    items: [
      { to: '/kiva',       name: 'The Kiva',     icon: 'fire',  sub: 'Tribe chat' },
      { to: '/moot',       name: 'Council',      icon: 'crown', sub: 'Elections & roles' },
      { to: '/pyre',       name: 'The Pyre',     icon: 'fire',  sub: 'Treasury' },
      { to: '/watchtower', name: 'Watchtower',   icon: 'spark', sub: 'Spies & alliances' },
      { to: '/chronicle',  name: 'Chronicle',    icon: 'ranks', sub: 'War history' },
    ],
  },
  {
    label: 'Personal',
    items: [
      { to: '/profile',    name: 'Profile',      icon: 'user',  sub: 'Identity' },
      { to: '/inbox',      name: 'Inbox',        icon: 'spark', sub: 'Notifications' },
      { to: '/',           name: 'Streak Trail', icon: 'fire',  sub: 'Daily ritual' },
    ],
  },
  {
    label: 'Meta',
    items: [
      { to: '/standings',  name: 'Standings',    icon: 'ranks', sub: 'Global ranks' },
      { to: '/settlement', name: 'Settlement',   icon: 'lands', sub: 'Buildings' },
      { to: '/post',       name: 'Trading Post', icon: 'store', sub: 'Stars & TON' },
    ],
  },
];

// ---------- Living Fire derivation ----------
function fireStateFor(streak) {
  const s = Number(streak) || 0;
  if (s <= 0)  return { size: 120, flames: 0, embers: 0,  tone: 'cold',    lit: false };
  if (s < 3)   return { size: 160, flames: 2, embers: 3,  tone: 'flicker', lit: true };
  if (s < 7)   return { size: 180, flames: 3, embers: 5,  tone: 'warm',    lit: true };
  if (s < 14)  return { size: 200, flames: 4, embers: 8,  tone: 'bright',  lit: true };
  if (s < 30)  return { size: 220, flames: 5, embers: 12, tone: 'hot',     lit: true };
  if (s < 60)  return { size: 240, flames: 6, embers: 16, tone: 'white',   lit: true };
  if (s < 100) return { size: 260, flames: 8, embers: 22, tone: 'gold',    lit: true };
  return             { size: 300, flames: 10, embers: 30, tone: 'eternal', lit: true };
}

export default function Hearth() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();

  const [tick, setTick] = useState(0);
  const [ashSheet, setAshSheet] = useState(false);
  const [firstPackSheet, setFirstPackSheet] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [fireExtended, setFireExtended] = useState(false);

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
  const war = data?.war;
  const streak = user.streak || 0;

  const fire = fireStateFor(streak);
  const checkinDone = daily.find((d) => d.slug === 'dq_checkin')?.claimed;
  const ashReady = (ash.pools_stored || 0) > 0;

  async function doCheckin() {
    try {
      const r = await apiPost('/api/checkin');
      if (!r.ok && r.reason === 'already') { toast('Already fed today', 'info'); return; }
      toast(`The fire roars. +${fmt(r.reward)} Ember`, 'good');
      reload();
    } catch (e) { toast(e.message || 'Check-in failed', 'bad'); }
  }

  async function doCollectAsh() {
    try {
      const r = await apiPost('/api/ash/collect');
      if (!r.ok) { toast('Not ready yet', 'info'); return; }
      toast(`+${fmt(r.gain)} Ember from the ash`, 'good');
      setAshSheet(false);
      reload();
    } catch (e) { toast(e.message || 'Collect failed', 'bad'); }
  }

  async function claimTask(id) {
    try {
      const r = await apiPost(`/api/daily/${id}/claim`);
      toast(`+${fmt(r.reward_ember)} Ember`, 'good');
      reload();
    } catch (e) { toast(e.message || 'Not ready', 'bad'); }
  }

  async function claimFirstPack() {
    try {
      const r = await apiPost('/api/first-pack/claim');
      toast(`First Pack: +${fmt(r.ember)} Ember`, 'good');
      setFirstPackSheet(false);
      reload();
    } catch (e) { toast(e.message || 'Could not claim', 'bad'); }
  }

  const myScore  = war ? Number(war.attacker_score) : 0;
  const foeScore = war ? Number(war.defender_score) : 0;
  const endsMs = war ? new Date(war.end_at).getTime() - Date.now() : 0;
  const canDeclare = ['Chief','Head','Elder'].includes(user.role);

  return (
    <motion.div
      className="col"
      style={{ gap: 4 }}
      initial={SECTION_MOTION.hearth.initial}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={M.ember}
    >
      {/* ============ Bonfire banner ============ */}
      {bonfire?.active && (
        <motion.div
          className="glass"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={M.buoyant}
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r-md)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'rgba(255,180,100,.4)',
          }}
        >
          <Icon name="bolt" size={18} style={{ color: 'var(--gold)' }} />
          <div className="grow">
            <b style={{ fontSize: 14 }}>{bonfire.title}</b>
            <div className="tiny">×{bonfire.multiplier} · ends in {shortTime(bonfire.ends_in_ms)}</div>
          </div>
        </motion.div>
      )}

      {/* ============ First pack banner ============ */}
      {firstPack?.available && (
        <motion.div
          className="glass hero"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={M.ember}
          style={{
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
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

      {/* ============ HOME WAR TILE ============ */}
      <WarTile
        war={war}
        myScore={myScore}
        foeScore={foeScore}
        endsMs={endsMs}
        canDeclare={canDeclare}
        onTap={() => { haptic('medium'); nav('/war'); }}
        M={M}
      />

      {/* ============ HERO — The Living Fire ============ */}
      <div
        className="glass hero card"
        style={{
          paddingTop: 8,
          textAlign: 'center',
          overflow: 'hidden',
          position: 'relative',
          minHeight: fireExtended ? 520 : 340,
          transition: 'min-height .4s cubic-bezier(.34,1.3,.5,1)',
        }}
        onClick={() => { haptic('light'); setFireExtended((v) => !v); }}
      >
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Hint text="Your Hearth tracks your daily streak. Feed it every day to earn Ember and climb milestone rewards." />
        </div>

        <div
          style={{
            transform: fireExtended ? 'scale(1.55)' : 'scale(1)',
            transformOrigin: 'center top',
            transition: 'transform .4s cubic-bezier(.34,1.3,.5,1)',
            filter: fireExtended ? 'none' : 'none',
            marginTop: fireExtended ? 20 : 4,
          }}
        >
          <Campfire streak={streak} lit={fire.lit} />
        </div>

        {!fireExtended && (
          <h2 className="display" style={{ fontSize: 22, marginTop: 4 }}>
            The Hearth
          </h2>
        )}

        {fireExtended && (
          <p
            className="tiny"
            style={{ marginTop: 90, textAlign: 'center', letterSpacing: '.02em' }}
          >
            The flame remembers <b style={{ color: 'var(--ember-200)' }}>{streak} days</b>.
          </p>
        )}

        {!fireExtended && (
          <p className="tiny" style={{ margin: '4px 0 14px' }}>
            Feed it daily · <b style={{ color: 'var(--ember-200)' }}>{streak} days</b>
          </p>
        )}

        {!fireExtended && (
          <div style={{ margin: '0 8px 12px' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="tiny">Streak to next reward</span>
              <span className="tiny tabular">{streak % 7}/7</span>
            </div>
            <div className="bar">
              <i style={{ width: ((streak % 7) / 7) * 100 + '%' }} />
            </div>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          block
          haptic="heavy"
          onClick={(e) => { e.stopPropagation(); doCheckin(); }}
          disabled={!!checkinDone}
          style={{ marginTop: fireExtended ? 6 : 0, position: 'relative', zIndex: 2 }}
        >
          <Icon name="fire" size={20} />
          {checkinDone ? 'Fire fed today' : `Feed the Fire · +120`}
        </Button>

        {fireExtended && (
          <div
            className="tiny"
            style={{
              marginTop: 10,
              opacity: 0.6,
              transition: 'opacity .4s ease .6s',
            }}
          >
            Streak {streak} · buffs +{Math.floor(streak / 7) * 10}% ember
          </div>
        )}
      </div>

      {/* ============ PRIMARY TILES ============ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 8,
        }}
      >
        {PRIMARY_TILES.map((t, i) => (
          <motion.button
            key={t.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...M.buoyant, delay: i * 0.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('medium'); nav(t.to); }}
            className="glass"
            style={{
              padding: 16,
              textAlign: 'left',
              borderRadius: 'var(--r-lg)',
              minHeight: 118,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <Icon name={t.icon} size={34} style={{ color: t.tone }} />
            <div className="row between" style={{ width: '100%' }}>
              <b style={{ fontSize: 15 }}>{t.name}</b>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* ============ MORE TILE ============ */}
      <motion.button
        className="glass"
        whileTap={{ scale: 0.98 }}
        onClick={() => { haptic('medium'); setMoreOpen(true); }}
        style={{
          marginTop: 12,
          padding: '14px 18px',
          textAlign: 'left',
          borderRadius: 'var(--r-lg)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon name="gear" size={22} style={{ color: 'var(--gold)' }} />
        <div className="grow" style={{ textAlign: 'left' }}>
          <b style={{ fontSize: 14 }}>More</b>
          <div className="tiny">Everything else</div>
        </div>
        <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
      </motion.button>

      {/* ============ DAILY TASKS ============ */}
      {daily.length > 0 && (
        <>
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
                        <span
                          className="crest-art"
                          style={{
                            background: t.claimed
                              ? 'linear-gradient(180deg,#2a6b45,#164028)'
                              : 'linear-gradient(180deg,#3a2c1c,#1c1208)',
                          }}
                        >
                          <Icon
                            name={t.claimed ? 'check' : 'spark'}
                            size={18}
                            style={{ color: t.claimed ? 'var(--good)' : 'var(--gold)' }}
                          />
                        </span>
                        <div className="col" style={{ gap: 1 }}>
                          <b style={{ fontSize: 14 }}>{t.title}</b>
                          <span className="tiny">
                            {t.claimed
                              ? 'Claimed'
                              : `${t.progress}/${t.goal_amount} · +${fmt(t.reward_ember)} Ember`}
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
        </>
      )}

      {/* ============ ASH SHEET ============ */}
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

      {/* ============ FIRST PACK SHEET ============ */}
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

      {/* ============ MORE SHEET ============ */}
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="col" style={{ gap: 20 }}>
          {MORE_GROUPS.map((g) => (
            <div key={g.label}>
              <span
                className="tiny"
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '.08em',
                  marginBottom: 8,
                  display: 'block',
                }}
              >
                {g.label}
              </span>
              <div className="col" style={{ gap: 8 }}>
                {g.items.map((it) => (
                  <motion.button
                    key={it.to + it.name}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { haptic('light'); setMoreOpen(false); nav(it.to); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 'var(--r-md)',
                      background: 'rgba(255,255,255,.04)',
                      border: '1px solid var(--glass-brd)',
                      textAlign: 'left',
                    }}
                  >
                    <Icon name={it.icon} size={22} style={{ color: 'var(--gold)' }} />
                    <div className="grow" style={{ textAlign: 'left' }}>
                      <b style={{ fontSize: 14 }}>{it.name}</b>
                      <div className="tiny">{it.sub}</div>
                    </div>
                    <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
                  </motion.button>
                ))}
              </div>
            </div>
          ))}
        </div>
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

/* ====================================================================
   HOME WAR TILE
   States:
     - active   : live score + timer, subtle vibrate
     - leader   : "declare one" prompt (Chief/Head/Elder)
     - peaceful : quiet strip
   ==================================================================== */
function WarTile({ war, myScore, foeScore, endsMs, canDeclare, onTap, M }) {
  if (war?.active) {
    const total = myScore + foeScore || 1;
    const myPct = myScore / total * 100;
    const winning = myScore >= foeScore;
    return (
      <motion.div
        onClick={onTap}
        animate={{
          x: [0, -1.2, 1.2, -0.8, 0.8, 0],
          y: [0, 0, 0, 0, 0, 0],
        }}
        transition={{
          duration: 1.4,
          repeat: Infinity,
          repeatDelay: 0.4,
          ease: 'easeInOut',
        }}
        className="glass"
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          borderColor: 'rgba(224,86,46,.55)',
          boxShadow: '0 0 24px rgba(224,86,46,.25), var(--sh-inset-hi)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Two clashing swords at the left */}
        <div style={{ position: 'relative', width: 26, height: 26, flex: '0 0 auto' }}>
          <motion.span
            animate={{ rotate: [-18, -8, -18] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ position: 'absolute', left: 0, top: 0 }}
          >
            <Icon name="bolt" size={18} style={{ color: '#ff9745' }} />
          </motion.span>
          <motion.span
            animate={{ rotate: [18, 8, 18] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ position: 'absolute', right: 0, top: 0 }}
          >
            <Icon name="bolt" size={18} style={{ color: '#ff9745' }} />
          </motion.span>
        </div>

        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row between" style={{ marginBottom: 4 }}>
            <b style={{ fontSize: 13, color: '#ffb876' }}>War vs {war.opponent}</b>
            <span className="tiny" style={{ color: 'rgba(255,180,118,.9)' }}>
              {shortTime(endsMs)} left
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              height: 6,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'rgba(255,255,255,.06)',
            }}
          >
            <motion.div
              animate={{ width: myPct + '%' }}
              transition={M.ember}
              style={{
                background: 'linear-gradient(90deg,#a83b02,#ff9745)',
              }}
            />
            <div style={{ flex: 1, background: 'linear-gradient(90deg,#5a3a7a,#8b5cf6)' }} />
          </div>
          <div className="row between" style={{ marginTop: 4 }}>
            <span className="tiny tabular" style={{ color: 'var(--gold)' }}>
              {fmt(myScore)} – {fmt(foeScore)}
            </span>
            <span
              className="tiny"
              style={{ color: winning ? 'var(--good)' : '#ff8a8a' }}
            >
              {winning ? 'Winning' : 'Behind'}
            </span>
          </div>
        </div>

        <Icon name="chevron" size={18} style={{ color: 'rgba(255,180,118,.8)' }} />
      </motion.div>
    );
  }

  if (canDeclare) {
    return (
      <motion.div
        onClick={onTap}
        className="glass"
        whileTap={{ scale: 0.98 }}
        style={{
          padding: '12px 16px',
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          borderColor: 'rgba(232,184,102,.35)',
        }}
      >
        <Icon name="bolt" size={22} style={{ color: 'var(--gold)' }} />
        <div className="grow">
          <b style={{ fontSize: 14 }}>No war rages</b>
          <div className="tiny">Declare one from the War Room</div>
        </div>
        <Icon name="chevron" size={18} style={{ color: 'var(--ink-dim)' }} />
      </motion.div>
    );
  }

  return (
    <div
      className="glass"
      style={{
        padding: '12px 16px',
        borderRadius: 'var(--r-md)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        opacity: 0.7,
      }}
    >
      <Icon name="shield" size={20} style={{ color: 'var(--ink-dim)' }} />
      <div className="grow">
        <b style={{ fontSize: 13, color: 'var(--ink-dim)' }}>The tribe is at peace</b>
      </div>
    </div>
  );
}