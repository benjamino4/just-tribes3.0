import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';

export default function Tribe() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const tribe = data?.tribe;
  const [tribes, setTribes] = useState(null);
  const [names, setNames] = useState(null);
  const [creating, setCreating] = useState(false);

  async function loadTribes() {
    const r = await Endpoints.tribes();
    setTribes((r.data || r).tribes || []);
  }
  async function loadNames() {
    const r = await Endpoints.tribeNames();
    setNames((r.data || r).names || []);
  }

  if (!tribe) {
    return (
      <motion.div className="col" style={{ gap: 12 }}>
        <h2 className="display" style={{ fontSize: 22 }}>Find your tribe</h2>
        {!creating ? (
          <>
            <button className="btn primary block" onClick={() => { loadTribes(); setCreating(false); }}>
              🏛 Join a Tribe
            </button>
            <button className="btn ghost block" onClick={() => { loadNames(); setCreating(true); }}>
              🔥 Found a Tribe
            </button>
            {tribes !== null && (
              <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                {tribes.slice(0, 10).map((t) => (
                  <button key={t.id} className="glass card" onClick={async () => {
                    try {
                      await Endpoints.tribeJoin(t.id);
                      toast(`Joined ${t.name}`, 'good');
                      reload();
                    } catch (e) { toast(e.message, 'bad'); }
                  }}>
                    <b>{t.name}</b>
                    <p className="tiny">{t.members} members · level {t.level}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="tiny">Choose a name (costs 25,000 🔥)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(names || []).map((n) => (
                <button key={n.id} className="glass card" style={{ padding: 12 }} onClick={async () => {
                  try {
                    await Endpoints.tribeCreate({ nameId: n.id, palette: 'ember', banner: 'sun' });
                    toast('Tribe founded!', 'good');
                    reload();
                  } catch (e) { toast(e.message, 'bad'); }
                }}>
                  <b style={{ fontSize: 14 }}>{n.name}</b>
                </button>
              ))}
            </div>
          </>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 className="display" style={{ fontSize: 22 }}>{tribe.name}</h2>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Level</span>
          <b style={{ fontSize: 22 }}>{tribe.level}</b>
        </div>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Members</span>
          <b style={{ fontSize: 22 }}>{tribe.members}</b>
        </div>
        <div className="glass card grow" style={{ textAlign: 'center' }}>
          <span className="tiny">Kinship</span>
          <b style={{ fontSize: 22 }}>{fmt(tribe.kinship_total)}</b>
        </div>
      </div>
      <div className="glass card">
        <div className="row between">
          <b>Pyre</b>
          <span className="chip tabular">{fmt(tribe.treasury)}</span>
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={async () => {
          try {
            await Endpoints.tribeDonate(500);
            toast('+500 stoked', 'good');
            reload();
          } catch (e) { toast(e.message, 'bad'); }
        }}>Stoke +500</button>
      </div>
      <button className="btn primary block" onClick={() => nav('/tribe/kiva')}>
        🔥 The Kiva
      </button>
    </motion.div>
  );
}