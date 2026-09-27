import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import { useMotionConfig } from '../lib/motion.js';

const TABS = [
  { to: '/',           icon: 'fire',  label: 'Hearth' },
  { to: '/longhouse',  icon: 'tribe', label: 'Longhouse' },
  { to: '/standings',  icon: 'ranks', label: 'Standings' },
  { to: '/settlement', icon: 'lands', label: 'Settlement' },
  { to: '/post',       icon: 'store', label: 'Post' },
];

export default function TabBar() {
  const location = useLocation();
  const M = useMotionConfig();

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map(t => {
        const active = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
        return (
          <NavLink key={t.to} to={t.to} className="tab" data-active={active}>
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="tab-pill"
                style={{ left: 8, right: 8 }}
                transition={M.buoyant}
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