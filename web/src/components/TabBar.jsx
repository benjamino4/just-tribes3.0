import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { haptic } from '../lib/haptics.js';

const TABS = [
  { to: '/',       icon: '🔥', label: 'Hearth' },
  { to: '/arena',  icon: '⚔️', label: 'Arena' },
  { to: '/tribe',  icon: '🏛', label: 'Tribe' },
  { to: '/vault',  icon: '💎', label: 'Vault' }
];

export default function TabBar() {
  const location = useLocation();
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
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              />
            )}
            <span className="tab-icon-wrap">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}