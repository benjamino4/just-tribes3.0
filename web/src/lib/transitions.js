// Per-route entrance choreography. Each family evokes a different OS feel:
//  - ios:     scale + fade + gentle rise (springy, glassy)
//  - harmony: depth push — comes forward from behind with blur clearing
//  - oxygen:  crisp directional slide with slight overshoot
import { animEnabled } from './settings.js';

const FAMILIES = {
  ios: {
    initial: { opacity: 0, y: 16, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.99 },
    transition: { type: 'spring', stiffness: 320, damping: 32 },
  },
  harmony: {
    initial: { opacity: 0, scale: 1.06, filter: 'blur(8px)' },
    animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, scale: 0.98, filter: 'blur(6px)' },
    transition: { type: 'spring', stiffness: 260, damping: 30 },
  },
  oxygen: {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { type: 'spring', stiffness: 420, damping: 34 },
  },
  rise: {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 },
    transition: { type: 'spring', stiffness: 300, damping: 28 },
  },
};

// Map routes to a family so each sub-page opens differently.
const ROUTE_FAMILY = {
  '/': 'ios',
  '/tribe': 'harmony',
  '/ranks': 'oxygen',
  '/lands': 'harmony',
  '/store': 'ios',
  '/profile': 'oxygen',
  '/home/streak': 'rise',
  '/home/ash': 'harmony',
  '/home/quests': 'oxygen',
  '/home/trials': 'ios',
  '/home/spin': 'rise',
  '/tribe/kiva': 'rise',
  '/tribe/pyre': 'harmony',
  '/tribe/elections': 'oxygen',
  '/tribe/war': 'harmony',
  '/tribe/members': 'oxygen',
  '/store/pack': 'rise',
  '/admin': 'oxygen',
};

export function variantFor(pathname) {
  const fam = ROUTE_FAMILY[pathname] || (pathname.startsWith('/tribe') ? 'harmony' : pathname.startsWith('/home') ? 'rise' : 'ios');
  const v = FAMILIES[fam];
  if (!animEnabled()) {
    return { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } };
  }
  return v;
}
