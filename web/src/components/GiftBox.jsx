import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { haptic } from '../lib/haptics.js';
import { apiPost } from '../lib/api.js';
import { celebrate } from '../lib/celebrate.jsx';
import { toast } from './Toast.jsx';

export default function GiftBox() {
  const { data } = useApp();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (!data?.user) return null;

  async function redeem() {
    const c = code.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    try {
      const r = await apiPost('/api/gift/redeem', { code: c });
      setOpen(false);
      setCode('');
      const body = r.data || r;
      celebrate({
        title: 'Gift received',
        subtitle: body.code,
        emoji: 'gift',
        tone: 'gold',
        reward: (body.summary || []).map((s) => `${s.kind} +${s.amount || ''}`).join(' · ')
      });
    } catch (e) {
      toast(e.message || 'Could not redeem', 'bad');
    } finally { setBusy(false); }
  }

  return (
    <>
      <motion.button
        onClick={() => { haptic('light'); setOpen(true); }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'fixed', right: 16,
          bottom: 'calc(var(--safe-bot) + var(--tabbar-h) + 24px)',
          width: 54, height: 54, borderRadius: '50%', zIndex: 180,
          background: 'radial-gradient(circle at 30% 25%, #efc168, #8a5e19)',
          boxShadow: '0 6px 20px rgba(239,193,104,.35)',
          display: 'grid', placeItems: 'center'
        }}
        aria-label="Gift box"
      >
        <span style={{ fontSize: 24 }}>🎁</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 190,
              background: 'rgba(6,5,8,0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
            }}
          >
            <motion.div
              initial={{ scale: 0.85, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="glass strong"
              style={{ width: '100%', maxWidth: 400, padding: 26, borderRadius: 'var(--r-2xl)', textAlign: 'center' }}
            >
              <div style={{ fontSize: 64, marginBottom: 8 }}>🎁</div>
              <h2 className="display" style={{ fontSize: 22, marginBottom: 6 }}>Redeem a gift</h2>
              <p className="tiny" style={{ marginBottom: 20 }}>Enter a code to claim your reward.</p>
              <input
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9\-_]/g, '').slice(0, 32))}
                onKeyDown={(e) => { if (e.key === 'Enter') redeem(); }}
                placeholder="FIRE42"
                style={{
                  width: '100%', padding: '14px 18px', borderRadius: 14,
                  background: 'rgba(6,5,8,.55)',
                  border: '1.5px solid var(--glass-brd)',
                  fontFamily: 'var(--font-mono)', fontSize: 20,
                  letterSpacing: '0.16em', textAlign: 'center',
                  color: 'var(--bone-50)', textTransform: 'uppercase', outline: 'none'
                }}
              />
              <button
                onClick={redeem}
                disabled={busy || code.trim().length < 4}
                style={{
                  marginTop: 16, width: '100%', padding: 14, borderRadius: 999,
                  background: 'linear-gradient(180deg, var(--ember-400), var(--ember-600))',
                  color: '#1a0b02', fontWeight: 700, fontSize: 15,
                  border: '1px solid rgba(255,131,36,0.55)',
                  opacity: (busy || code.trim().length < 4) ? 0.5 : 1
                }}
              >{busy ? 'Claiming…' : 'Redeem'}</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}