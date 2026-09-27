// TRIBES-FILE: web/src/screens/Forge.jsx
// PHASE: 4 — Relics
// The Forge — pack list + open flow + reveal.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V, SECTION_MOTION, staggerParent } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import PackReveal from '../components/PackReveal.jsx';
import { toast } from '../components/Toast.jsx';

export default function Forge() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};

  const [packs, setPacks] = useState([]);
  const [revealing, setRevealing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet('/api/relics/packs');
        setPacks(r.packs || []);
      } catch (e) {
        toast(e.message || 'Could not load packs', 'bad');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openPack(slug) {
    haptic('heavy');
    try {
      const r = await apiPost('/api/relics/pack/open', { slug });
      setRevealing(r);
      reload();
    } catch (e) {
      if (e.data?.need != null) {
        toast(`Not enough Stars · need ${e.data.need}`, 'bad');
      } else {
        toast(e.message || 'Could not open the pack', 'bad');
      }
    }
  }

  return (
    <motion.div
      variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}
    >
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Forge</h2>
          <Hint text="Open a cache for a chance at a relic. Rarer relics have bigger effects. Drop rates are shown on each cache." />
        </div>
      </div>

      {user.stars != null && (
        <div className="glass card" style={{ marginBottom: 6 }}>
          <div className="row between">
            <b style={{ fontSize: 14 }}>Your Stars</b>
            <span className="chip" style={{ color: 'var(--gold)' }}>
              <Icon name="spark" size={14} style={{ color: 'var(--gold)' }} />
              <b className="tabular">{fmt(user.stars)}</b>
            </span>
          </div>
          {user.blessed && (
            <p className="tiny" style={{ marginTop: 6, color: 'var(--gold)' }}>
              Admin blessing active — caches cost no Stars.
            </p>
          )}
        </div>
      )}

      {loading && <p className="muted" style={{ padding: 12 }}>Loading caches…</p>}

      <motion.div variants={staggerParent(0.06)} initial="initial" animate="animate" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {packs.map((p) => {
          const preset = p.anim_preset || 'ember';
          return (
            <motion.div key={p.slug} variants={V.item}>
              <div className="glass card" style={{ overflow: 'hidden' }}>
                <div className="row" style={{ gap: 14 }}>
                  <motion.div
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 3, repeat: M.drift.repeat || 0 }}
                    style={{
                      width: 64, height: 64, flex: '0 0 auto',
                      borderRadius: 16,
                      display: 'grid', placeItems: 'center',
                      background: preset === 'cursed'
                        ? 'radial-gradient(circle at 30% 25%, #8b5cf6, #2a1020)'
                        : preset === 'goldburst'
                        ? 'radial-gradient(circle at 30% 25%, #ffd27a, #2a1200)'
                        : preset === 'shards'
                        ? 'radial-gradient(circle at 30% 25%, #7cc4ff, #102030)'
                        : 'radial-gradient(circle at 30% 25%, #ff9f45, #2a1200)',
                      boxShadow: '0 8px 24px rgba(0,0,0,.45)',
                      fontSize: 30,
                    }}
                  >
                    {preset === 'cursed' ? '🗝️' : '🏺'}
                  </motion.div>

                  <div className="grow">
                    <b style={{ fontSize: 15 }}>{p.name}</b>
                    {p.description && (
                      <p className="tiny" style={{ marginTop: 2 }}>{p.description}</p>
                    )}
                    <div className="row" style={{ gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {Object.entries(p.odds_json || {}).map(([tier, prob]) => (
                        <span key={tier} className="relic-tag" style={{ textTransform: 'capitalize' }}>
                          {tier} {Math.round(prob * 100)}%
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <Button
                    variant="primary" block haptic="heavy"
                    onClick={() => openPack(p.slug)}
                  >
                    <Icon name="spark" size={14} style={{ color: '#2a1200' }} />
                    Open · {p.price_stars} ⭐
                  </Button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <PackReveal
        open={!!revealing}
        relic={revealing?.relic}
        rarity={revealing?.rarity}
        preset={revealing?.anim_preset}
        onClose={() => setRevealing(null)}
        onClaim={() => { setRevealing(null); haptic('success'); toast('Relic claimed', 'good'); }}
        onShare={() => { setRevealing(null); haptic('light'); toast('Shared to the Kiva', 'info'); }}
      />
    </motion.div>
  );
}