// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Vault.jsx
// PURPOSE: The Altar. Three pedestals + shelf. Live preview.
// DEPENDS ON: api, store, Button, Hint
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { V, useMotionConfig } from '../lib/motion.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';

const CATS = ['flame', 'blade', 'voice'];
const CAT_LABELS = { flame: 'Flame', blade: 'Blade', voice: 'Voice' };
const CAT_ICONS = { flame: 'hearth', blade: 'swords', voice: 'bell' };
const TIER_COLOR = {
  common: '#8899aa',
  rare: '#7ea3c4',
  epic: '#b58cff',
  legendary: '#efc168'
};

export default function Vault() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const [state, setState] = useState(null);
  const [detail, setDetail] = useState(null);

  async function load() {
    try {
      const r = await Endpoints.relicsState();
      setState(r.data || r);
    } catch (e) { toast(e.message || 'Could not load vault', 'bad'); }
  }
  useEffect(() => { load(); }, []);

  async function equip(relicId) {
    try {
      await Endpoints.relicsEquip(relicId);
      toast('Equipped', 'good');
      setDetail(null);
      load();
      reload();
    } catch (e) { toast(e.message || 'Could not equip', 'bad'); }
  }

  async function unequip(cat) {
    try {
      await Endpoints.relicsUnequip(cat);
      toast('Unequipped', 'good');
      setDetail(null);
      load();
      reload();
    } catch (e) { toast(e.message || 'Could not unequip', 'bad'); }
  }

  if (!state) return <p className="muted" style={{ padding: 24, textAlign: 'center' }}>Loading…</p>;

  const equippedFor = (cat) => (state.catalog || []).find((r) => Number(r.id) === Number(state.slots?.[cat]));
  const ownedUnequipped = (state.catalog || []).filter((r) => r.owned && !r.equipped);

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <h2 className="display" style={{ fontSize: 22 }}>The Altar</h2>
          <Hint slug="vault" text="Equip one relic per category: Flame, Blade, Voice. Each relic does one thing." />
        </div>
      </div>

      <div className="vault-altar">
        {CATS.map((c) => {
          const r = equippedFor(c);
          return (
            <motion.button
              key={c}
              whileTap={{ scale: 0.95 }}
              onClick={() => r && setDetail(r)}
              className="vault-pedestal"
              style={{ '--pedestal-color': r ? TIER_COLOR[r.tier] : 'rgba(255,255,255,.1)' }}
            >
              <div className="vault-relic-icon">
                {r ? <Icon name={CAT_ICONS[c]} size={32} style={{ color: TIER_COLOR[r.tier] }} /> :
                  <Icon name="lock" size={24} style={{ color: 'var(--ink-faint)' }} />}
              </div>
              <span className="tiny" style={{ marginTop: 4 }}>{CAT_LABELS[c]}</span>
              <b style={{ fontSize: 11, marginTop: 2 }}>{r ? r.name : 'Empty'}</b>
            </motion.button>
          );
        })}
      </div>

      <p className="tiny" style={{ textAlign: 'center', marginTop: 4, fontStyle: 'italic' }}>
        {equippedFor('flame') ? 'The flame burns steady.' : 'Your altar is cold. Light it.'}
      </p>

      <div className="row" style={{ gap: 8, marginTop: 16 }}>
        <Button variant="primary" block onClick={() => nav('/vault/forge')}>
          <Icon name="relic" size={16} /> Open a Cache
        </Button>
        <Button variant="ghost" block onClick={() => nav('/vault/store')}>
          <Icon name="star" size={16} /> Trading Post
        </Button>
      </div>

      <div className="sec-h" style={{ marginTop: 24 }}><h3>The Shelf</h3><span className="line" /></div>

      {ownedUnequipped.length === 0 && (
        <p className="muted" style={{ textAlign: 'center', padding: 24 }}>No relics yet. Open a cache from the Forge.</p>
      )}

      <div className="vault-shelf">
        {ownedUnequipped.map((r) => (
          <motion.button
            key={r.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setDetail(r)}
            className="vault-shelf-item"
            style={{ borderColor: TIER_COLOR[r.tier] + '66' }}
          >
            <Icon name={CAT_ICONS[r.category]} size={22} style={{ color: TIER_COLOR[r.tier] }} />
            <b style={{ fontSize: 12 }}>{r.name}</b>
          </motion.button>
        ))}
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail?.name}>
        {detail && (
          <>
            <p className="tiny" style={{ color: 'var(--ink-dim)', textTransform: 'uppercase', letterSpacing: '.12em' }}>
              {detail.tier} · {detail.category}
            </p>
            <p style={{ fontSize: 16, marginTop: 12, lineHeight: 1.5 }}>{detail.description}</p>
            <Button
              variant="primary"
              block
              style={{ marginTop: 20 }}
              onClick={() => detail.equipped ? unequip(detail.category) : equip(detail.id)}
            >
              {detail.equipped ? 'Unequip' : 'Equip'}
            </Button>
          </>
        )}
      </Sheet>
    </motion.div>
  );
}