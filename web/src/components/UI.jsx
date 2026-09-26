import React from 'react';
import { motion } from 'framer-motion';
import { haptic } from '../lib/telegram.js';

export function Card({ children, strong, className = '', style, ...rest }) {
  return (
    <div className={`glass card ${strong ? 'strong' : ''} ${className}`} style={style} {...rest}>
      {children}
    </div>
  );
}

export function SectionHeader({ children }) {
  return (
    <div className="sec-h">
      <h3>{children}</h3>
      <span className="line" />
    </div>
  );
}

export function Button({ children, variant = '', size = '', block, onClick, disabled, haptic: h = 'medium', ...rest }) {
  return (
    <motion.button
      className={`btn ${variant} ${size} ${block ? 'block' : ''}`}
      disabled={disabled}
      whileTap={{ scale: 0.955 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      onClick={(e) => { haptic(h); onClick && onClick(e); }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function ProgressBar({ value = 0, max = 100, tone = 'ember', height = 10 }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const grad = tone === 'good'
    ? 'linear-gradient(90deg,#3ddc84,#5ce39a)'
    : 'linear-gradient(90deg,var(--ember-500),var(--ember-400))';
  return (
    <div style={{ height, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: pct + '%' }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }}
        style={{ height: '100%', borderRadius: 999, background: grad, boxShadow: '0 0 12px rgba(255,122,24,.5)' }}
      />
    </div>
  );
}

export function Stat({ icon, label, value }) {
  return (
    <div className="col" style={{ gap: 2 }}>
      <span className="tiny">{label}</span>
      <b className="tabular" style={{ fontSize: 18 }}>{value}</b>
    </div>
  );
}
