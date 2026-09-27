// TRIBES-FILE: web/src/screens/Longhouse.jsx
// PHASE: 2 — Identity & shell
// The tribe hall. Shows tribe summary + roster. Full breakdown in
// Phase 5 (Kiva, Pyre, Moot). This screen proves the shell works.

import { useState } from 'react';
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

export default function Longhouse() {
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
              } catch (e) {
                toast(e.message || 'Could not load tribes', 'bad');
              }
            }}
          >
            Find a Tribe
          </Button>
        </div>

        {browse && (
          <div className="glass card">
            <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
              Tribes
            </b>
            <div className="col" style={{ gap: 8, marginTop: 10 }}>
              {(tribes || []).map((t) => (
                <div key={t.id} className="row between" style={{ padding: '8px 0' }}>
                  <div className="col">
                    <b>{t.name}</b>
                    <span className="tiny">
                      {t.members} members · {fmt(t.renown_total)} renown
                    </span>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        await act(() => Endpoints.tribeJoin(t.id));
                        toast('Welcome to ' + t.name, 'good');
                        reload();
                      } catch (e) {
                        toast(e.message || 'Could not join', 'bad');
                      }
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
            style={{ width: 54, height: 54 }}
            animate={{ rotate: [0, -4, 4, 0] }}
            transition={{ duration: 6, repeat: M.drift.repeat || 0 }}
          >
            <Icon name="tribe" size={28} style={{ color: '#2a1200' }} />
          </motion.span>
          <div className="grow">
            <h2 className="display" style={{ fontSize: 22 }}>{tribe.name}</h2>
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
              } catch (e) {
                toast(e.message || 'Could not donate', 'bad');
              }
            }}
          >
            Stoke +500
          </Button>
        </div>
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