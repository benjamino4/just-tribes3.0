import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { fmt } from '../lib/format.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../components/Toast.jsx';

export default function VaultStore() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const M = useMotionConfig();
  const user = data?.user || {};
  const [catalog, setCatalog] = useState(null);

  useEffect(() => {
    Endpoints.storeCatalog().then((r) => setCatalog(r.data || r)).catch(() => {});
  }, []);

  async function buy(itemId) {
    haptic('medium');
    try {
      const r = await Endpoints.starsInvoice(itemId);
      const link = (r.data || r).link;
      if (!link) return;
      const tg = window.Telegram?.WebApp;
      if (tg?.openInvoice) {
        tg.openInvoice(link, (status) => {
          if (status === 'paid') { toast('Purchase complete', 'good'); reload(); }
        });
      } else {
        window.open(link, '_blank');
      }
    } catch (e) { toast(e.message || 'Could not open invoice', 'bad'); }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>Trading Post</h2>
        </div>
        <span className="chip gold"><Icon name="star" size={14} /> {fmt(user.stars || 0)}</span>
      </div>

      {!catalog && <p className="muted">Loading…</p>}
      {catalog && (catalog.stars || []).map((it) => (
        <div key={it.id} className="glass card">
          <div className="row between">
            <div className="col" style={{ gap: 2, flex: 1 }}>
              <b style={{ fontSize: 14 }}>{it.title}</b>
              <span className="tiny">{it.desc}</span>
            </div>
            <Button variant="primary" onClick={() => buy(it.id)}>
              <Icon name="star" size={13} style={{ color: '#1a0b02' }} />
              {it.stars}
            </Button>
          </div>
        </div>
      ))}
    </motion.div>
  );
}