// TRIBES-FILE: web/src/screens/Watchtower.jsx
// PHASE: 6 — War
// Spies, rivals (vengeance), alliances.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt, shortTime } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';

export default function Watchtower() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const tribe = data?.tribe;

  const [spies, setSpies] = useState(null);
  const [vengeance, setVengeance] = useState([]);
  const [alliances, setAlliances] = useState([]);
  const [tribesList, setTribesList] = useState([]);
  const [target, setTarget] = useState(null);

  async function loadAll() {
    try {
      const [s, v, a, t] = await Promise.all([
        apiGet('/api/spies').catch(() => null),
        apiGet('/api/war/vengeance').catch(() => ({ grudges: [] })),
        apiGet('/api/war/alliances').catch(() => ({ alliances: [] })),
        apiGet('/api/tribes').catch(() => ({ tribes: [] })),
      ]);
      setSpies(s);
      setVengeance(v.grudges || []);
      setAlliances(a.alliances || []);
      setTribesList((t.tribes || []).filter((x) => x.id !== tribe?.id));
    } catch (e) {
      toast(e.message || 'Could not open the Watchtower', 'bad');
    }
  }

  useEffect(() => { if (tribe) loadAll(); }, [tribe?.id]);

  if (!tribe) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <h2 className="display" style={{ fontSize: 22 }}>The Watchtower is dark</h2>
          <Button variant="primary" block style={{ marginTop: 14 }} onClick={() => nav('/longhouse')}>Join a Tribe</Button>
        </div>
      </motion.div>
    );
  }

  async function launch(kind) {
    if (!target) return;
    try {
      const r = await apiPost('/api/spies/launch', { target: target.id, kind });
      toast(`Spy sent to ${r.target}`, 'good');
      setTarget(null);
      loadAll();
      reload();
    } catch (e) {
      if (e.data?.need) toast(`Need ${e.data.need} Ember`, 'bad');
      else toast(e.message || 'Could not launch', 'bad');
    }
  }

  async function counter() {
    try {
      const r = await apiPost('/api/spies/counter');
      toast(`Counter-spy level ${r.level}`, 'good');
      loadAll();
      reload();
    } catch (e) { toast(e.message || 'Failed', 'bad'); }
  }

  async function ally(tribeId) {
    try {
      await apiPost('/api/war/alliance', { tribe: tribeId });
      toast('Blood Alliance sworn', 'good');
      loadAll();
    } catch (e) { toast(e.message || 'Failed', 'bad'); }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Watchtower</h2>
          <Hint text="Send spies to gather intel or sabotage rivals. Grudges give you a bonus against the victor. Blood Allies cannot be matched against each other." />
        </div>
      </div>

      {/* spies */}
      <div className="glass card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <b className="row" style={{ gap: 6 }}>
            <Icon name="spark" size={16} style={{ color: '#7cc4ff' }} />
            Spies
          </b>
          <span className="chip">
            Counter Lv {spies?.counter || 0}
          </span>
        </div>

        {spies?.missions?.length ? (
          <div className="col" style={{ gap: 8 }}>
            {spies.missions.map((m) => (
              <div key={m.id} className="row between">
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{m.target_name}</b>
                  <span className="tiny">
                    {m.kind} · {m.status}
                    {m.status === 'active' && ` · in ${shortTime(new Date(m.resolves_at).getTime() - Date.now())}`}
                  </span>
                </div>
                {m.status === 'success' && m.intel && (
                  <span className="chip" style={{ color: 'var(--good)', fontSize: 11 }}>
                    {fmt(m.intel.treasury)}E · {m.intel.members}
                  </span>
                )}
                {m.status === 'caught' && (
                  <span className="chip" style={{ color: '#ff8a8a' }}>caught</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="tiny">No missions yet.</p>
        )}

        <div className="row" style={{ gap: 8, marginTop: 12 }}>
          <Button variant="ghost" block onClick={counter}>
            Raise Counter-Spy · {fmt(spies?.tuning?.counterCost || 1500)}E
          </Button>
        </div>
      </div>

      {/* vengeance */}
      {vengeance.length > 0 && (
        <div className="glass card">
          <b className="row" style={{ gap: 6, marginBottom: 10 }}>
            <Icon name="bolt" size={16} style={{ color: '#ff5a3c' }} />
            Grudges
          </b>
          <div className="col" style={{ gap: 8 }}>
            {vengeance.map((g) => (
              <div key={g.target_id} className="row between">
                <div className="col" style={{ gap: 1 }}>
                  <b style={{ fontSize: 13.5 }}>{g.target_name}</b>
                  <span className="tiny">
                    +{g.tokens} tokens · expires {new Date(g.expires_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* alliances */}
      <div className="glass card">
        <b className="row" style={{ gap: 6, marginBottom: 10 }}>
          <Icon name="tribe" size={16} style={{ color: 'var(--good)' }} />
          Blood Alliances
        </b>
        {alliances.length ? (
          <div className="col" style={{ gap: 8 }}>
            {alliances.map((a) => (
              <div key={a.ally_id} className="row between">
                <b style={{ fontSize: 13.5 }}>{a.ally_name}</b>
                <span className="tiny">{new Date(a.formed_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="tiny">No pacts yet.</p>
        )}

        {tribesList.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <b style={{ fontSize: 12, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
              Swear a pact with
            </b>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {tribesList.slice(0, 8).map((t) => (
                <Button key={t.id} variant="ghost" onClick={() => ally(t.id)}>
                  {t.name}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* new mission */}
      <div className="glass card">
        <b style={{ fontSize: 13, color: 'var(--ink-dim)', textTransform: 'uppercase' }}>
          Send a spy
        </b>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
          {tribesList.slice(0, 6).map((t) => (
            <Button key={t.id} variant="ghost" onClick={() => setTarget(t)}>
              {t.name}
            </Button>
          ))}
        </div>
      </div>

      <Sheet open={!!target} onClose={() => setTarget(null)} title={`Send spy · ${target?.name || ''}`}>
        <Button variant="primary" block style={{ marginBottom: 8 }} onClick={() => launch('recon')}>
          Recon · {fmt(spies?.tuning?.cost || 2000)}E
        </Button>
        <Button variant="ghost" block onClick={() => launch('sabotage')}>
          Sabotage · {fmt((spies?.tuning?.cost || 2000) * 2)}E
        </Button>
      </Sheet>
    </motion.div>
  );
}