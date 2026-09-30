// =====================================================================
// Longhouse — the tribe hall. Summary + sections rail.
// =====================================================================
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { toast } from '../components/Toast.jsx';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';

// tribe-name branding maps (perk-driven, see The Forge Market)
const TRIBE_FONT = {
  default: 'var(--font-display)',
  runic: '"Cinzel", Georgia, serif',
  blade: '"Oswald", Impact, sans-serif',
  ash: '"Caveat", cursive',
  monol: '"Bebas Neue", Arial Narrow, sans-serif',
};
const TRIBE_STYLE = { ember: '#ff7a18', gold: '#ffcf7a', frost: '#8ddcff', blood: '#e05545', void: '#b58cff' };

const SECTIONS = [
  { to: '/warband',    name: 'The Warband',  icon: 'swords', sub: '20 seats · duels',   tone: '#ff7a2e' },
  { to: '/kiva',       name: 'The Kiva',    icon: 'fire',  sub: 'Tribe chat',        tone: '#ff9745' },
  { to: '/moot',       name: 'Council',     icon: 'crown', sub: 'Elections & roles', tone: '#e8b866' },
  { to: '/pyre',       name: 'The Pyre',    icon: 'fire',  sub: 'Shared treasury',   tone: '#e0562e' },
  { to: '/war',        name: 'War Room',    icon: 'bolt',  sub: 'Raids & rivals',    tone: '#ff5a3c' },
  { to: '/watchtower', name: 'Watchtower',  icon: 'spark', sub: 'Spies & pacts',     tone: '#7aa8c4' },
  { to: '/chronicle',  name: 'Chronicle',   icon: 'ranks', sub: 'War history',       tone: '#a878c9' },
  { to: '/store',      name: 'Forge Market', icon: 'store', sub: 'Brand your tribe',   tone: '#ff9d3c' },
];

export default function Longhouse() {
  const nav = useNavigate();
  const { data, reload, act } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [browse, setBrowse] = useState(false);
  const [tribes, setTribes] = useState(null);

  if (!tribe) {
    return (
      <motion.div
        className="col"
        style={{ gap: 4 }}
        variants={V.page}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={M.buoyant}
      >
        <div className="glass strong card" style={{ textAlign: 'center', padding: 28 }}>
          <span className="crest-art" style={{ width: 56, height: 56, margin: '0 auto 12px' }}>
            <Icon name="tribe" size={30} style={{ color: '#2a1200' }} />
          </span>
          <h2 className="display" style={{ fontSize: 22 }}>March under a banner</h2>
          <p className="muted" style={{ fontSize: 14, margin: '8px 0 18px' }}>
            Found your own band or join an existing tribe to feed the Great Pyre together.
          </p>
          <Button
            variant="primary"
            block
            onClick={async () => {
              try {
                const r = await Endpoints.tribes();
                setTribes(r.tribes || []);
                setBrowse(true);
                haptic('light');
              } catch (e) { toast(e.message || 'Could not load tribes', 'bad'); }
            }}
          >
            Find a Tribe
          </Button>
        </div>

        {browse && (
          <div className="glass card">
            <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>Tribes</b>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {(tribes || []).map((t) => (
                <div key={t.id} className="row between" style={{ padding: '8px 0' }}>
                  <div className="col">
                    <b>{t.name}</b>
                    <span className="tiny">{t.members} members · {fmt(t.renown_total)} renown</span>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        await act(() => Endpoints.tribeJoin(t.id));
                        toast('Welcome to ' + t.name, 'good');
                        reload();
                      } catch (e) { toast(e.message || 'Could not join', 'bad'); }
                    }}
                  >
                    Join
                  </Button>
                </div>
              ))}
              {!tribes?.length && (
                <p className="muted" style={{ padding: '12px 0' }}>No tribes yet — be the first.</p>
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="col"
      style={{ gap: 4 }}
      variants={V.page}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={M.buoyant}
    >
      <div className="glass hero card" style={{ overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 12, right: 12 }}>
          <Hint text="Your tribe rises together. Feed the Great Pyre, win wars, and elect a Chief to climb the standings." />
        </div>

        <div className="row" style={{ gap: 14 }}>
          <motion.span
            className="crest-art"
            style={{ width: 54, height: 54, borderRadius: tribe.icon_url ? '50%' : undefined, overflow: 'hidden' }}
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 6, repeat: M.drift.repeat || 0 }}
          >
            {tribe.icon_url
              ? <img src={tribe.icon_url} alt="tribe crest" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Icon name="tribe" size={28} style={{ color: '#2a1200' }} />}
          </motion.span>
          <div className="grow">
            <h2 className="display" style={{ fontSize: 22, fontFamily: TRIBE_FONT[tribe.name_font] || undefined, color: TRIBE_STYLE[tribe.name_style] || undefined }}>{tribe.name}</h2>
            <p className="tiny">"{tribe.motto || 'No motto set.'}"</p>
          </div>
        </div>

        <div className="row between" style={{ marginTop: 14 }}>
          <Stat label="Level" value={tribe.level} />
          <Stat label="Members" value={tribe.members} />
          <Stat label="Renown" value={fmt(tribe.renown_total)} />
        </div>
      </div>

      <div className="glass card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <b className="row" style={{ gap: 6 }}>
            <Icon name="fire" size={18} style={{ color: 'var(--ember-400)' }} />
            The Great Pyre
          </b>
          <span className="chip tabular">{fmt(tribe.treasury)}</span>
        </div>
        <div className="bar">
          <i style={{ width: Math.min(100, (tribe.treasury % 200000) / 2000) + '%' }} />
        </div>
        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Button
            variant="primary"
            block
            onClick={async () => {
              try {
                await act(() => Endpoints.tribeDonate(500), {
                  tribe: { ...tribe, treasury: tribe.treasury + 500 },
                });
                toast('+500 stoked into the Pyre', 'good');
              } catch (e) { toast(e.message || 'Could not donate', 'bad'); }
            }}
          >
            Stoke +500
          </Button>
        </div>
      </div>

      {/* ---------- Sections rail ---------- */}
      <div className="sec-h">
        <h3>The Longhouse</h3>
        <span className="line" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 4,
        }}
      >
        {SECTIONS.map((s, i) => (
          <motion.button
            key={s.to}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...M.buoyant, delay: i * 0.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { haptic('medium'); nav(s.to); }}
            className="glass"
            style={{
              padding: 16,
              textAlign: 'left',
              borderRadius: 'var(--r-lg)',
              minHeight: 110,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              overflow: 'hidden',
            }}
          >
            <Icon name={s.icon} size={30} style={{ color: s.tone }} />
            <div className="row between" style={{ width: '100%' }}>
              <div className="col" style={{ gap: 0, textAlign: 'left' }}>
                <b style={{ fontSize: 14 }}>{s.name}</b>
                <span className="tiny">{s.sub}</span>
              </div>
              <Icon name="chevron" size={16} style={{ color: 'var(--ink-dim)' }} />
            </div>
          </motion.button>
        ))}
      </div>
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