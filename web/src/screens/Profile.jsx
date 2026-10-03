import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { fmt } from '../lib/format.js';
import { haptic } from '../lib/haptics.js';

export default function Profile() {
  const nav = useNavigate();
  const { data } = useApp();
  const user = data?.user || {};
  const tier = user.rank_tier || {};

  return (
    <motion.div className="col" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10 }}>
        <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
        <h2 className="display" style={{ fontSize: 22 }}>Profile</h2>
      </div>
      <div className="glass strong card" style={{ textAlign: 'center', padding: 24 }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: `radial-gradient(circle at 30% 25%, ${tier.color_hex || '#f7a259'}, #0f141c 70%)`,
          border: `2px solid ${tier.color_hex || '#f7a259'}`,
          margin: '0 auto 12px',
          display: 'grid', placeItems: 'center',
          fontSize: 32
        }}>
          {tier.emoji || '🔥'}
        </div>
        <h2 style={{ fontSize: 19 }}>@{user.username || 'wanderer'}</h2>
        <p className="tiny" style={{ marginTop: 4 }}>
          <b style={{ color: tier.color_hex }}>{tier.title || 'Kin'}</b> · #{user.rank_rating || 1000}
        </p>
        <div className="row between" style={{ marginTop: 16 }}>
          <div className="col"><span className="tiny">Sparks</span><b>{fmt(user.sparks || 0)}</b></div>
          <div className="col"><span className="tiny">Kinship</span><b>{fmt(user.kinship || 0)}</b></div>
          <div className="col"><span className="tiny">Streak</span><b>{(user.streak || 0)}d</b></div>
        </div>
      </div>
      <button className="btn ghost block" onClick={() => nav('/help')}>
        📖 Help & Rules
      </button>
    </motion.div>
  );
}