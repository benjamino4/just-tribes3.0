import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import { haptic } from '../lib/telegram.js';

const TABS = [
  { to: '/', icon: 'fire', label: 'Fire' },
  { to: '/tribe', icon: 'tribe', label: 'Tribe' },
  { to: '/ranks', icon: 'ranks', label: 'Ranks' },
  { to: '/lands', icon: 'lands', label: 'Lands' },
  { to: '/store', icon: 'store', label: 'Sky' },
];

export default function TabBar() {
  const loc = useLocation();
  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(t.to);
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className="tab"
            data-active={active}
            onClick={() => haptic('select')}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                style={{ left: 8, right: 8 }}
                transition={{ type: 'spring', stiffness: 480, damping: 34 }}
              />
            )}
            <Icon name={t.icon} size={22} className="glyph" />
            <span>{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
