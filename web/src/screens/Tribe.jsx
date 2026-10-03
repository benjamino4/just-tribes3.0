// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Tribe.jsx
// PURPOSE: The seven-seat circle, Pyre, roster, Kiva entry.
//          No-tribe state offers Found-a-Tribe and Join-a-Tribe flows.
// DEPENDS ON: SeatCircle, api, store
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import SeatCircle from '../components/SeatCircle.jsx';
import { toast } from '../components/Toast.jsx';

const PALETTES = ['ember', 'jade', 'frost', 'blood', 'gold', 'void'];
const BANNERS = ['sun', 'moon', 'wolf', 'bear', 'spear', 'shield', 'tree', 'flame'];

function unwrap(r) { return (r && r.data) || r || {}; }

// ── No-tribe state: found or join ──────────────────────────────────
function NoTribe({ nav, reload, sparks }) {
  const [mode, setMode] = useState(null); // null | 'found' | 'join'
  const [names, setNames] = useState([]);
  const [nameId, setNameId] = useState(null);
  const [palette, setPalette] = useState('ember');
  const [banner, setBanner] = useState('sun');
  const [motto, setMotto] = useState('');
  const [tribes, setTribes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (mode === 'found' && names.length === 0) {
      setLoading(true);
      Endpoints.tribeNames()
        .then((r) => {
          if (cancelled) return;
          const list = unwrap(r).names || [];
          setNames(list);
          if (list[0]) setNameId(list[0].id);
        })
        .catch((e) => toast(e.message || 'Could not load names', 'bad'))
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    if (mode === 'join' && tribes.length === 0) {
      setLoading(true);
      Endpoints.tribes()
        .then((r) => { if (!cancelled) setTribes(unwrap(r).tribes || []); })
        .catch((e) => toast(e.message || 'Could not load tribes', 'bad'))
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const doCreate = useCallback(async () => {
    if (!nameId) { toast('Choose a name first', 'bad'); return; }
    setBusy(true);
    try {
      await Endpoints.tribeCreate({ nameId, palette, banner, motto: motto.trim() });
      toast('Tribe founded \u2014 you are Chief', 'good');
      reload();
    } catch (e) {
      const need = e && e.data && e.data.need;
      if (need) toast(`Need ${fmt(need)} Sparks to found a tribe (you have ${fmt(sparks)})`, 'bad');
      else toast(e.message || 'Could not found tribe', 'bad');
    } finally { setBusy(false); }
  }, [nameId, palette, banner, motto, reload, sparks]);

  const doJoin = useCallback(async (id) => {
    setBusy(true);
    try {
      await Endpoints.tribeJoin(id);
      toast('Welcome to the tribe', 'good');
      reload();
    } catch (e) {
      toast(e.message || 'Could not join', 'bad');
    } finally { setBusy(false); }
  }, [reload]);

  // Landing — pick a path
  if (!mode) {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
        <div className="glass card" style={{ textAlign: 'center', padding: 28 }}>
          <Icon name="tribe" size={48} style={{ color: 'var(--gold-300)' }} />
          <h2 className="display" style={{ fontSize: 22, marginTop: 12 }}>No tribe yet</h2>
          <p className="tiny" style={{ marginTop: 8, marginBottom: 16 }}>
            Found your own tribe and lead it as Chief, or join an existing one to unlock
            the Kiva, the Pyre, and the Warband.
          </p>
          <div className="col" style={{ gap: 10 }}>
            <Button variant="primary" block onClick={() => setMode('found')}>
              <Icon name="tribe" size={18} /> Found a Tribe
            </Button>
            <Button variant="ghost" block onClick={() => setMode('join')}>
              <Icon name="hearth" size={18} /> Join a Tribe
            </Button>
            <Button variant="ghost" block onClick={() => nav('/')}>Back to Hearth</Button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Found a tribe
  if (mode === 'found') {
    return (
      <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
        <div className="row between" style={{ margin: '2px 2px 0' }}>
          <h2 className="display" style={{ fontSize: 22 }}>Found a Tribe</h2>
          <Hint slug="tribe" text="Founding a tribe costs Sparks and makes you its Chief. Pick a name, a palette and a banner." />
        </div>

        <div className="glass card col" style={{ gap: 14, padding: 18 }}>
          <div className="col" style={{ gap: 6 }}>
            <span className="tiny">Tribe name</span>
            {loading && names.length === 0 ? (
              <span className="tiny">Loading names…</span>
            ) : names.length === 0 ? (
              <span className="tiny">No names are available right now.</span>
            ) : (
              <select
                value={nameId || ''}
                onChange={(e) => setNameId(Number(e.target.value))}
                className="input"
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12,
                  background: 'rgba(232,238,245,0.04)',
                  border: '1px solid rgba(142,154,170,0.16)',
                  color: 'var(--ink, #e8eef5)', fontSize: 15
                }}
              >
                {names.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span className="tiny">Palette</span>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {PALETTES.map((p) => (
                <Button
                  key={p} size="" variant={palette === p ? 'primary' : 'ghost'}
                  onClick={() => setPalette(p)}
                >{p}</Button>
              ))}
            </div>
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span className="tiny">Banner</span>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {BANNERS.map((b) => (
                <Button
                  key={b} size="" variant={banner === b ? 'primary' : 'ghost'}
                  onClick={() => setBanner(b)}
                >{b}</Button>
              ))}
            </div>
          </div>

          <div className="col" style={{ gap: 6 }}>
            <span className="tiny">Motto (optional)</span>
            <input
              type="text" value={motto} maxLength={80}
              onChange={(e) => setMotto(e.target.value)}
              placeholder="A short rallying cry"
              className="input"
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                background: 'rgba(232,238,245,0.04)',
                border: '1px solid rgba(142,154,170,0.16)',
                color: 'var(--ink, #e8eef5)', fontSize: 15
              }}
            />
          </div>
        </div>

        <Button variant="primary" block disabled={busy || !nameId} onClick={doCreate}>
          {busy ? 'Founding\u2026' : 'Found Tribe'}
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={() => setMode(null)}>Back</Button>
      </motion.div>
    );
  }

  // Join a tribe
  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <h2 className="display" style={{ fontSize: 22 }}>Join a Tribe</h2>
        <Hint slug="tribe" text="Join an open tribe to unlock the Kiva, the Pyre, and the Warband." />
      </div>

      {loading && tribes.length === 0 ? (
        <div className="glass card" style={{ textAlign: 'center', padding: 20 }}>
          <span className="tiny">Loading tribes…</span>
        </div>
      ) : tribes.length === 0 ? (
        <div className="glass card" style={{ textAlign: 'center', padding: 20 }}>
          <span className="tiny">No tribes to join yet \u2014 be the first to found one.</span>
        </div>
      ) : (
        <div className="col" style={{ gap: 10 }}>
          {tribes.map((t) => (
            <div key={t.id} className="glass card row between" style={{ alignItems: 'center' }}>
              <div className="col" style={{ gap: 2 }}>
                <b>{t.name}</b>
                <span className="tiny">
                  Lv {t.level} · {t.members} members · {fmt(t.kinship_total)} kinship
                </span>
              </div>
              <Button variant="primary" disabled={busy} onClick={() => doJoin(t.id)}>Join</Button>
            </div>
          ))}
        </div>
      )}

      <Button variant="ghost" block disabled={busy} onClick={() => setMode(null)}>Back</Button>
    </motion.div>
  );
}

export default function Tribe() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const tribe = data?.tribe;
  const seats = data?.seats || [];
  const sparks = Number(data?.user?.sparks || 0);

  if (!tribe) {
    return <NoTribe nav={nav} reload={reload} sparks={sparks} />;
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>{tribe.name}</h2>
          <Hint slug="tribe" text="Your tribe has 7 seats. Rank determines them weekly. The Kiva is chat. The Pyre is the treasury." />
        </div>
      </div>

      <div className="glass card" style={{ padding: 20 }}>
        <SeatCircle seats={seats} />
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
        <Button
          variant="primary" block style={{ marginTop: 12 }}
          onClick={async () => {
            try {
              await Endpoints.tribeDonate(500);
              toast('+500 stoked', 'good');
              reload();
            } catch (e) { toast(e.message || 'Failed', 'bad'); }
          }}
        >Stoke +500</Button>
      </div>

      <Button variant="primary" block onClick={() => nav('/tribe/kiva')}>
        <Icon name="hearth" size={18} /> The Kiva
      </Button>
    </motion.div>
  );
}
