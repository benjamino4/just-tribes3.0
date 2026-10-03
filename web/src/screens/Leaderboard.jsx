import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Endpoints } from '../lib/api.js';
import { useEvents } from '../lib/EventProvider.jsx';

export default function Leaderboard() {
  const nav = useNavigate();
  const { subscribe } = useEvents();
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState(null);
  const [flash, setFlash] = useState(false);
  const firstLoad = useRef(true);

  async function load(silent) {
    try {
      const r = await Endpoints.leaderboard();
      const body = r.data || r;
      setBoard(body);
      setErr(null);
      if (!firstLoad.current && silent) { setFlash(true); setTimeout(() => setFlash(false), 600); }
      firstLoad.current = false;
    } catch (e) { setErr(e.message || 'Could not load the leaderboard'); }
  }

  // Initial load + light polling for near-real-time standings, and an instant
  // silent refresh whenever a rank-affecting island event lands.
  useEffect(() => {
    load(false);
    const iv = setInterval(() => load(true), 6000);
    const off = subscribe((evt) => {
      if (evt?.tier === 'island') load(true);
    });
    return () => { clearInterval(iv); off(); };
  }, [subscribe]);

  const top = board?.top || [];
  const me = board?.me;
  const inTop = top.some((r) => r.me);

  return (
    <motion.div className="col" style={{ gap: 12 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="row between" style={{ margin: '2px 2px 4px' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>←</button>
          <h2 className="display" style={{ fontSize: 22 }}>Leaderboard</h2>
        </div>
        <span className="kiva-live"><span className="kiva-live-dot" /> live</span>
      </div>

      {err && (
        <div className="glass card" style={{ textAlign: 'center', padding: 20, borderColor: 'var(--rose-300)' }}>
          <b>Could not load</b><p className="tiny" style={{ marginTop: 6 }}>{err}</p>
        </div>
      )}

      {me && (
        <motion.div className="glass card lb-me" animate={flash ? { boxShadow: ['0 0 0 rgba(247,162,89,0)', '0 0 26px rgba(247,162,89,0.5)', '0 0 0 rgba(247,162,89,0)'] } : {}} transition={{ duration: 0.6 }}>
          <div className="row between">
            <div>
              <div className="tiny" style={{ textTransform: 'uppercase', letterSpacing: '.1em', opacity: 0.7 }}>Your standing</div>
              <b style={{ fontSize: 22 }}>#{me.rank}<span className="tiny" style={{ opacity: 0.6 }}> / {me.total}</span></b>
            </div>
            <div style={{ textAlign: 'right' }}>
              <motion.b key={me.rank_rating} initial={{ scale: 1.3, color: '#f7a259' }} animate={{ scale: 1, color: 'var(--ink)' }} className="tabular" style={{ fontSize: 22, display: 'block' }}>{me.rank_rating}</motion.b>
              <span className="tiny">{me.wins}W · {me.games} games</span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="col" style={{ gap: 6 }}>
        <AnimatePresence initial={false}>
          {top.map((r, idx) => (
            <motion.div key={r.id} layout
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className={`glass card lb-row${r.me ? ' mine' : ''}`}>
              <span className={`lb-pos${idx < 3 ? ' top' : ''}`}>
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </span>
              <span className="lb-crest" style={{ background: `radial-gradient(circle at 35% 25%, ${r.tier?.color_hex || '#f7a259'}, #5a3a12 72%)` }}>
                {r.tier?.emoji || '🔥'}
              </span>
              <div className="grow" style={{ minWidth: 0 }}>
                <b style={{ fontSize: 14, color: r.name_color || 'var(--ink)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</b>
                <span className="tiny">{r.tier?.title || 'Kin'} · {r.wins}W</span>
              </div>
              <b className="tabular" style={{ fontSize: 16, color: r.tier?.color_hex || 'var(--ember-200)' }}>{r.rank_rating}</b>
            </motion.div>
          ))}
        </AnimatePresence>
        {me && !inTop && (
          <div className="glass card lb-row mine" style={{ opacity: 0.9 }}>
            <span className="lb-pos">#{me.rank}</span>
            <span className="lb-crest" style={{ background: 'radial-gradient(circle at 35% 25%, #f7a259, #5a3a12 72%)' }}>🔥</span>
            <div className="grow"><b style={{ fontSize: 14 }}>You</b><span className="tiny"> · {me.wins}W</span></div>
            <b className="tabular" style={{ fontSize: 16 }}>{me.rank_rating}</b>
          </div>
        )}
      </div>
    </motion.div>
  );
}
