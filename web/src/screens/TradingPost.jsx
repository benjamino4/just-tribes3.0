// TRIBES-FILE: web/src/screens/TradingPost.jsx
// PHASE: 8 — Payments + Polish
// The Trading Post — Stars and TON purchases.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Emoji from '../components/Emoji.jsx';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { apiGet, apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Hint from '../components/Hint.jsx';
import { toast } from '../components/Toast.jsx';

const TABS = [
  { id: 'ember',   label: 'Ember' },
  { id: 'relics',  label: 'Relics' },
  { id: 'cosmetic',label: 'Cosmetics' },
  { id: 'bundles', label: 'Bundles' },
];

export default function TradingPost() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};

  const [catalog, setCatalog] = useState(null);
  const [tab, setTab] = useState('ember');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try { setCatalog(await apiGet('/api/store/catalog')); }
      catch (e) { toast(e.message || 'Could not load the store', 'bad'); }
    })();
  }, []);

  async function buy(item) {
    if (busy) return;
    haptic('medium');
    setBusy(true);
    try {
      const r = await apiPost('/api/stars/invoice', { itemId: item.id });
      if (r.link) {
        const tg = window.Telegram?.WebApp;
        if (tg?.openInvoice) tg.openInvoice(r.link, (status) => {
          if (status === 'paid') { toast('Purchase complete', 'good'); reload(); }
        });
        else window.open(r.link, '_blank');
      }
    } catch (e) {
      if (e.message?.includes('Already')) toast('Already purchased', 'info');
      else toast(e.message || 'Could not open invoice', 'bad');
    } finally {
      setBusy(false);
    }
  }

  const items = (catalog?.stars || []).filter((it) => {
    if (tab === 'ember') return it.id.match(/^(spark|flame|blaze|inferno)$/);
    if (tab === 'relics') return it.id.match(/^(firestone|boneidol|sundisc|moonshard|shard_pack)$/);
    if (tab === 'cosmetic') return it.id.startsWith('name_color_') || it.id.startsWith('glow_');
    if (tab === 'bundles') return it.id.match(/^(starter_bundle)$/);
    return false;
  });

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" exit="exit" transition={M.buoyant}
      className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }}
                  onClick={() => { haptic('light'); nav(-1); }}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Trading Post</h2>
          <Hint text="Buy Ember, relics, cosmetics, and bundles with Telegram Stars. Some items are also available with TON." />
        </div>
      </div>

      <div className="glass card">
        <div className="row between">
          <b style={{ fontSize: 14 }}>Your Stars</b>
          <span className="chip" style={{ color: 'var(--gold)' }}>
            <Icon name="spark" size={14} style={{ color: 'var(--gold)' }} />
            <b className="tabular">{fmt(user.stars || 0)}</b>
          </span>
        </div>
        {user.blessed && (
          <p className="tiny" style={{ marginTop: 6, color: 'var(--gold)' }}>
            <Emoji name="halo_glow" size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />
Admin blessing active — all Stars purchases are free.
          </p>
        )}
      </div>

      <div className="row" style={{ gap: 8, overflowX: 'auto', padding: '4px 0 8px' }}>
        {TABS.map((t) => (
          <button key={t.id}
            onClick={() => { haptic('select'); setTab(t.id); }}
            className="chip"
            style={{
              flex: '0 0 auto',
              borderColor: tab === t.id ? 'var(--ember-400)' : 'var(--glass-brd)',
              color: tab === t.id ? 'var(--ember-200)' : 'var(--ink-dim)',
              background: tab === t.id ? 'rgba(255,122,24,.14)' : 'var(--glass-bg)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {!catalog && <p className="muted">Loading…</p>}

      {items.map((it, i) => (
        <motion.div key={it.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, ...M.buoyant }}>
          <div className="glass card">
            <div className="row between">
              <div className="col" style={{ gap: 2, flex: 1 }}>
                <b style={{ fontSize: 14 }}>{it.title}</b>
                <span className="tiny">{it.desc}</span>
              </div>
              <Button variant="primary" onClick={() => buy(it)} disabled={busy}>
               <Icon name="star" size={13} style={{ color: '#1a0b02' }} />
{it.stars}
<Emoji name="star" size={12} style={{ marginLeft: 3 }} />
              </Button>
            </div>
          </div>
        </motion.div>
      ))}

      {items.length === 0 && catalog && (
        <p className="muted" style={{ padding: 12, textAlign: 'center' }}>No items in this section.</p>
      )}
    </motion.div>
  );
}