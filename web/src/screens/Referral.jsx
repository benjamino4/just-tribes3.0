// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/screens/Referral.jsx
// PURPOSE: Referral Altar. Tiers. Share. Recent referrals as torches.
// DEPENDS ON: api, store, Button, Toast
// ═══════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../lib/store.jsx';
import { V } from '../lib/motion.js';
import { Endpoints } from '../lib/api.js';
import { haptic } from '../lib/haptics.js';
import Icon from '../components/Icon.jsx';
import Button from '../components/Button.jsx';
import { toast } from '../components/Toast.jsx';

const TIER_NAMES = ['Tribe Maker', 'Banner Bearer', 'Firebringer', 'Warbringer', 'Eternal Inviter'];
const TIER_MIN = [1, 5, 15, 30, 50];

export default function Referral() {
  const nav = useNavigate();
  const { data } = useApp();
  const [info, setInfo] = useState(null);

  async function load() {
    try {
      const r = await Endpoints.referral();
      setInfo(r.data || r);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  function copyLink() {
    haptic('light');
    const link = `https://t.me/YourBot?start=ref_${info?.code || ''}`;
    navigator.clipboard?.writeText(link).then(() => toast('Link copied', 'good'));
  }

  function shareTg() {
    haptic('medium');
    const link = `https://t.me/YourBot?start=ref_${info?.code || ''}`;
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Join my tribe in TRIBES')}`;
    window.open(url, '_blank');
  }

  const invited = info?.invited || 0;
  let tierIdx = 0;
  for (let i = 0; i < TIER_MIN.length; i++) if (invited >= TIER_MIN[i]) tierIdx = i;
  const nextAt = TIER_MIN[tierIdx + 1] || null;

  return (
    <motion.div variants={V.page} initial="initial" animate="animate" className="col" style={{ gap: 12 }}>
      <div className="row between" style={{ margin: '2px 2px 0' }}>
        <div className="row" style={{ gap: 10 }}>
          <button className="chip" style={{ padding: 9, borderRadius: 999 }} onClick={() => nav(-1)}>
            <Icon name="chevL" size={18} />
          </button>
          <h2 className="display" style={{ fontSize: 22 }}>The Altar</h2>
        </div>
      </div>

      <div className="glass strong card" style={{ textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🔥</div>
        <h3 className="display" style={{ fontSize: 20 }}>
          {TIER_NAMES[tierIdx]}
        </h3>
        <p className="tiny" style={{ marginTop: 6 }}>
          You have invited <b>{invited}</b> souls.
        </p>
        {nextAt && (
          <>
            <p className="tiny" style={{ marginTop: 8 }}>
              Next tier at {nextAt} invites.
            </p>
            <div className="bar" style={{ width: 220, margin: '12px auto 0' }}>
              <i style={{ width: Math.min(100, (invited / nextAt) * 100) + '%' }} />
            </div>
          </>
        )}
      </div>

      {(info?.list || []).length > 0 && (
        <div className="glass card">
          <b style={{ fontSize: 13, textTransform: 'uppercase' }}>Recent Kin</b>
          <div className="col" style={{ gap: 8, marginTop: 12 }}>
            {info.list.slice(0, 5).map((r, i) => (
              <div key={i} className="row between">
                <span style={{ fontSize: 13 }}>{r.first_name || r.username || 'Kin'}</span>
                <span className="tiny">{new Date(r.rewarded_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="primary" block onClick={shareTg}>
        <Icon name="gift" size={16} /> Invite a Friend
      </Button>
      <Button variant="ghost" block onClick={copyLink}>Copy link</Button>
    </motion.div>
  );
}