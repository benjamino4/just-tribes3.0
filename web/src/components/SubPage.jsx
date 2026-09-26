import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import Hint from './Hint.jsx';
import { haptic } from '../lib/telegram.js';

// Standard header for every sub-page: a springy back chevron, title, and an
// optional hint bulb. Sub-pages live outside the tab bar.
export default function SubPage({ title, hint, children, right }) {
  const nav = useNavigate();
  return (
    <div className="col" style={{ gap: 4 }}>
      <div className="row between" style={{ margin: '2px 2px 12px' }}>
        <div className="row" style={{ gap: 10 }}>
          <motion.button whileTap={{ scale: 0.88, x: -3 }} onClick={() => { haptic('light'); nav(-1); }}
            className="chip" style={{ padding: 9, borderRadius: 999 }}>
            <Icon name="chevron" size={18} style={{ transform: 'rotate(180deg)' }} />
          </motion.button>
          <h2 className="display" style={{ fontSize: 22 }}>{title}</h2>
          {hint && <Hint text={hint} />}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
