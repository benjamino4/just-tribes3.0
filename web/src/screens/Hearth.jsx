import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { fmt } from '../lib/format.js';
import { apiPost } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import LivingFire from '../components/LivingFire.jsx';
import { toast } from '../components/Toast.jsx';

export default function Hearth() {
  const nav = useNavigate();
  const { data, reload } = useApp();
  const user = data?.user || {};
  const streak = Number(user.streak || 0);

  async function doCheckin() {
    try {
      const r = await apiPost('/api/checkin');
      const body = r.data || r;
      if (!body.ok && body.reason === 'already') { toast('Already fed today', 'info'); return; }
      toast(`+${fmt(body.reward)} Sparks · Day ${body.streak}`, 'good');
      reload();
    } catch (e) { toast(e.message || 'Check-in failed', 'bad'); }
  }

  return (
    <motion.div className="col" style={{ gap: 4 }} variants={{ initial: {}, animate: {} }} initial="initial" animate="animate">
      <div className="glass hero card hearth-card">
        <div className="hearth-fire-wrap">
          <LivingFire streak={streak} />
        </div>
        <p className="tiny hearth-verse" style={{ textAlign: 'center', marginTop: 12 }}>
          Day {streak} · The flame remembers you.
        </p>
        <button
          className="btn primary block"
          style={{ marginTop: 16 }}
          onClick={(e) => { e.stopPropagation(); haptic('heavy'); doCheckin(); }}
        >
          🔥 Feed the Fire
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => nav('/arena')} className="glass card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>⚔️</div>
          <b style={{ fontSize: 13, marginTop: 4 }}>Arena</b>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => nav('/tribe')} className="glass card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>🏛</div>
          <b style={{ fontSize: 13, marginTop: 4 }}>Tribe</b>
        </motion.button>
        <motion.button whileTap={{ scale: 0.95 }} onClick={() => nav('/vault')} className="glass card" style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ fontSize: 28 }}>💎</div>
          <b style={{ fontSize: 13, marginTop: 4 }}>Vault</b>
        </motion.button>
      </div>
    </motion.div>
  );
}