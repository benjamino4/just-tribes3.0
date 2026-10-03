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
  const tribe = data?.tribe;
  const tier = user.rank_tier || {};
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

      {/* At-a-glance standing: rank, sparks, kinship */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
        <div className="glass card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Rank</div>
          <b className="tabular" style={{ fontSize: 18, color: tier.color_hex || 'var(--ember-200)' }}>
            {user.rank_rating || 1000}
          </b>
          <div className="tiny" style={{ opacity: 0.8 }}>{tier.title || 'Kin'}</div>
        </div>
        <div className="glass card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Sparks</div>
          <b className="tabular" style={{ fontSize: 18 }}>🔥 {fmt(user.sparks || 0)}</b>
          <div className="tiny" style={{ opacity: 0.8 }}>day {streak}</div>
        </div>
        <div className="glass card" style={{ padding: '12px 10px', textAlign: 'center' }}>
          <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Kinship</div>
          <b className="tabular" style={{ fontSize: 18, color: 'var(--gold-300)' }}>🏛 {fmt(user.kinship || 0)}</b>
          <div className="tiny" style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tribe ? tribe.name : 'no tribe'}
          </div>
        </div>
      </div>

      <div className="sec-h" style={{ marginTop: 18 }}><h3>Where to next</h3><span className="line" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
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