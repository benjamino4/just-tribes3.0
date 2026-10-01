import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { useMotionConfig, V } from '../lib/motion.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import Emoji from '../components/Emoji.jsx';
import { celebrate } from '../lib/celebrate.jsx';
import { toast } from '../components/Toast.jsx';

export default function VaultForge() {
  const nav = useNavigate();
  const { reload } = useApp();
  const M = useMotionConfig();
  const [packs, setPacks] = useState([]);

  useEffect(() => {
    Endpoints.relicsPacks().then((r) => setPacks((r.data || r).packs || [])).catch(() => {});
  }, []);

  async function open(slug) {
    haptic('heavy');
    try {
      const r = await Endpoints.relicsOpen(slug);
      const body = r.data || r;
      celebrate({
        title: body.relic.name,
        subtitle: body.relic.description,
        emoji: 'relic-vase',
        tone: body.tier === 'legendary' ? 'gold' : body.tier === 'epic' ? 'rune' : 'ember',
        reward: `${body.tier} relic`
      });
      reload();
    } catch (e) {
      if (e.data?.need) toast(`Not enough Stars · need ${e.data.need}`, 'bad');
      else toast(e.message || 'Could not open', 'bad');
    }
  }

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Forge</h2>
        </div>
      </div>

      {packs.map((p) => (
        <div key={p.slug} className="glass card">
          <div className="row" style={{ gap: 14 }}>
            <div style={{
              width: 64, height: 64, flex: '0 0 auto',
              borderRadius: 16, display: 'grid', placeItems: 'center',
              background: 'radial-gradient(circle at 30% 25%, #ff8324, #2a1200)'
            }}>
              <Emoji name="relic-vase" size={34} />
            </div>
            <div className="grow">
              <b style={{ fontSize: 15 }}>{p.name}</b>
              <p className="tiny" style={{ marginTop: 4 }}>{p.description}</p>
            </div>
          </div>
          <Button variant="primary" block style={{ marginTop: 14 }} onClick={() => open(p.slug)}>
            <Icon name="star" size={14} /> Open · {p.price_stars}
          </Button>
        </div>
      ))}
    </motion.div>
  );
}