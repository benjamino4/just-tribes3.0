import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import { useApp } from '../lib/store.jsx';

const TABS = [
  { to: '/',       icon: 'hearth', label: 'Hearth' },
  { to: '/arena',  icon: 'swords', label: 'Arena' },
  { to: '/tribe',  icon: 'tribe',  label: 'Tribe' },
  { to: '/vault',  icon: 'relic',  label: 'Vault' }
];

export default function TabBar() {
  const location = useLocation();
  const M = useMotionConfig();

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
        return (
          <NavLink
            key={t.to}
            to={t.to}
            className="tab"
            data-active={active}
            onClick={() => haptic('select')}
            style={{ position: 'relative' }}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                style={{ left: 6, right: 6 }}
                transition={M.buoyant}
              />
            )}
            <span className="tab-icon-wrap">
              <Icon name={t.icon} size={22} className="glyph" />
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}