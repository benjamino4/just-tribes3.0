// =====================================================================
// TabBar — Obsidian Glass v3
// Floating capsule. Moving gold-ember pill. Glow behind active icon.
// Optional per-tab badge dots. Haptic thump on switch.
// =====================================================================
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import Icon from './Icon.jsx';
import { useMotionConfig } from '../lib/motion.js';
import { haptic } from '../lib/haptics.js';
import { useApp } from '../lib/store.jsx';

const TABS = [
  { to: '/',           icon: 'hearth',   label: 'Hearth',     badgeKey: null },
  { to: '/longhouse',  icon: 'tribe',    label: 'Tribe',      badgeKey: 'kivaUnread' },
  { to: '/standings',  icon: 'ranks',    label: 'Ranks',      badgeKey: null },
  { to: '/settlement', icon: 'lands',    label: 'Settle',     badgeKey: null },
  { to: '/post',       icon: 'store',    label: 'Post',       badgeKey: null },
];

export default function TabBar() {
  const location = useLocation();
  const M = useMotionConfig();
  const { data } = useApp();

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        const active = t.to === '/' ? location.pathname === '/' : location.pathname.startsWith(t.to);
        const badge = t.badgeKey ? Number(data?.[t.badgeKey] || 0) : 0;
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
              {badge > 0 && <span className="tab-badge" aria-hidden="true" />}
            </span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}