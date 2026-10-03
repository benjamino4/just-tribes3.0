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
      {TABS.map((t, idx) => {
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
            <motion.span
              className="tab-icon-wrap"
              animate={active
                ? { scale: [1, 1.35, 1.12], rotate: [0, -12, 10, 0], y: [0, -3, -1] }
                : { scale: [1, 1.09, 1], y: [0, -2.5, 0], rotate: [0, 1.5, -1.5, 0] }}
              transition={active
                ? { duration: 0.5, ease: 'easeOut' }
                : { duration: 2.8, ease: 'easeInOut', repeat: Infinity, delay: idx * 0.22 }}
              whileTap={{ scale: 0.82 }}
            >
              {t.icon}
            </motion.span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}