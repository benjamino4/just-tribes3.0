// TRIBES-FILE: web/src/components/TonConnect.jsx
// PHASE: 8 — Payments + Polish
// TON Connect button. Uses the wallet connect bridge when available.

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiPost } from '../lib/api.js';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import { toast } from '../components/Toast.jsx';
import Button from '../components/Button.jsx';
import Icon from '../components/Icon.jsx';

export default function TonConnect({ onLinked }) {
  const M = useMotionConfig();
  const [busy, setBusy] = useState(false);
  const [addr, setAddr] = useState('');

  // If the TON Connect SDK is present on the page, it attaches window.tonConnectUI
  useEffect(() => {
    const sdk = window.tonConnectUI;
    if (sdk?.onStatusChange) {
      sdk.onStatusChange((w) => {
        if (w?.account?.address) {
          setAddr(w.account.address);
          apiPost('/api/ton/link', { address: w.account.address }).then(() => {
            toast('Wallet linked', 'good');
            onLinked?.();
          }).catch(() => {});
        }
      });
    }
  }, [onLinked]);

  async function connect() {
    setBusy(true);
    haptic('medium');
    try {
      const sdk = window.tonConnectUI;
      if (sdk?.openModal) {
        await sdk.openModal();
      } else {
        toast('TON Connect SDK not loaded', 'bad');
      }
    } catch (e) {
      toast(e.message || 'Could not open wallet', 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={addr ? 'ghost' : 'primary'} block onClick={connect} disabled={busy}>
      <Icon name="spark" size={16} />
      {addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect TON Wallet'}
    </Button>
  );
}