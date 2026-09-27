// =====================================================================
// TRIBES — Icon set (v3)
// 60 hand-tuned SVG paths. Consistent 24×24 grid, 1.8 stroke, round caps.
// The FILLED set is for silhouettes that read better solid.
// =====================================================================

const PATHS = {
  // ---------- core nav ----------
  hearth:   'M12 3c.8 3.4-1 4.6-1 7a3 3 0 0 0 3 3c0-2 1-3 1-3 2.2 2.2 3 5 3 7a6 6 0 0 1-12 0c0-3.4 2-5.6 3.4-7.6C10.4 7.4 12 6 12 3z',
  tribe:    'M12 3l3.2 5.4 6.2 1-4.5 4.4 1.1 6.2-6-3.2-6 3.2 1.1-6.2L2.6 9.4l6.2-1L12 3z',
  ranks:    'M4 20V9m5 11V4m5 16v-7m5 7V8',
  lands:    'M3 20l4.2-8 3 4 4-9 3 6 4-4v11z',
  store:    'M4 8l1-3h14l1 3M4 8h16v11H4zM9 12h6',
  profile:  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',

  // ---------- resources ----------
  ember:    'M12 3c.6 2-.7 3-.7 4.5A2 2 0 0 0 14 9c0-1 .6-1.8.6-1.8 1.4 1.4 2 3 2 4.6a4.6 4.6 0 1 1-9.2 0c0-2 1.2-3.4 2-4.8.8-1.2 2.4-1.8 2.6-4z',
  ash:      'M5 15h14M6 12h12M8 9h8M4 18h16',
  star:     'M12 3 14 9l6.5 1-5 4.6 1.3 6.4-5.8-3-5.8 3 1.3-6.4-5-4.6 6.5-1z',
  coin:     'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M14.5 9H12a2 2 0 0 0 0 4h1a2 2 0 0 1 0 4h-2',
  gem:      'M6 4h12l3 6-9 10L3 10z M9 10l3 8 3-8z M6 4l3 6M18 4l-3 6M3 10h18',

  // ---------- chevrons & controls ----------
  chevron:  'M9 6l6 6-6 6',
  chevL:    'M15 6l-6 6 6 6',
  chevU:    'M6 15l6-6 6 6',
  chevD:    'M6 9l6 6 6-6',
  plus:     'M12 5v14M5 12h14',
  minus:    'M5 12h14',
  close:    'M6 6l12 12M18 6L6 18',
  check:    'M4 12l5 5L20 6',
  arrowR:   'M5 12h14M13 6l6 6-6 6',
  arrowL:   'M19 12H5M11 6l-6 6 6 6',
  send:     'M3 12l18-9-9 18-2-7z',
  gear:     'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2l1.6 2.6 3-.5.5 3L21 10l-1.9 2.4 1.9 2.4-2.4 1.4-.5 3-3-.5L12 22l-1.6-2.6-3 .5-.5-3L4 14l1.9-2.4L4 9.2l2.4-1.4.5-3 3 .5z',

  // ---------- status ----------
  lock:     'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  unlock:   'M6 11V8a6 6 0 0 1 11.4-2.6M5 11h14v10H5z',
  eye:      'M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7S5 17 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  eyeOff:   'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M6.2 6.2C3.8 8 2 12 2 12c3 5 7 7 10 7 2.2 0 4.4-.8 6.3-2M9.7 4.5c.7-.3 1.5-.5 2.3-.5 3 0 7 2 10 7-.6 1-1.4 2-2.3 2.9',
  bell:     'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5z M9.5 18a2.5 2.5 0 0 0 5 0',
  flag:     'M5 3v18M5 4h12l-2.5 4L17 12H5',
  shield:   'M12 2 4 5v7c0 6 4 9 8 10 4-1 8-4 8-10V5z',
  shieldOk: 'M12 2 4 5v7c0 6 4 9 8 10 4-1 8-4 8-10V5z M8.5 12l2.5 2.5 4.5-5',
  ban:      'M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  trash:    'M4 7h16M9 7V4h6v3m-8 0l1 13h8l1-13',
  warn:     'M12 3 1.8 20h20.4z M12 9v5 M12 18v.01',
  info:     'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7v.01',

  // ---------- war ----------
  bolt:     'M13 2 4 14h6l-1 8 9-12h-6z',
  swords:   'M3 21 14 10l1-4 4-3-1 4-11 11z M21 21 10 10 9 6 5 3l1 4 11 11z',
  spear:    'M14 3l7 7-3 1-6-6z M3 21l9-9 M11 13l-1-1',
  bow:      'M5 19a12 12 0 0 1 14-14 M3 21l4-4 M15 5l4 4',
  drum:     'M12 3a9 4 0 1 0 0 8 9 4 0 0 0 0-8z M3 7v10a9 4 0 0 0 18 0V7 M3 7a9 4 0 0 0 18 0',
  horn:     'M3 12c6 0 12-4 18-6v12c-6-2-12-6-18-6z M3 10v4',
  skull:    'M12 3a7 7 0 0 0-7 7c0 2 1 3.6 2 4.6V18h2v-2h2v2h2v-2h2v2h2v-3.4c1-1 2-2.6 2-4.6a7 7 0 0 0-7-7z M9 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M15 10a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  spy:      'M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7S5 17 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',

  // ---------- tribe & council ----------
  crown:    'M3 19h18l-1.5-11-4.5 4.5L12 5l-3 7.5L4.5 8z M12 5v2',
  banner:   'M5 3v18 M5 4h14l-3 5 3 5H5',
  campfire: 'M12 3c1 4-1 5-1 8a3 3 0 0 0 3 3v-2c2 1 3 3 3 5a5 5 0 0 1-10 0c0-4 3-6 5-9z M3 21h18',
  totem:    'M9 3h6v4H9z M9 8h6v4H9z M8 13h8v4H8z M6 18h12v3H6z',
  drum2:    'M7 5v14 M17 5v14 M7 5h10v14H7z M7 9h10 M7 15h10',
  moot:     'M12 3a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V8a5 5 0 0 0-5-5z M9 21v-4 M15 21v-4 M6 21h12',
  pyre:     'M3 20h18l-2-6H5z M12 14V8 M9 8l3-5 3 5 M9 4h6',
  idol:     'M12 3 9 8h6z M9 8h6v3H9z M8 11h8v4H8z M5 15h14v6H5z M12 17v2',

  // ---------- relics ----------
  relic:    'M12 3l3 6h6l-4.5 4 1.5 6-6-3.5L6 19l1.5-6L3 9h6z',
  urn:      'M8 3h8l-1 3 3 6c1 3-1 8-6 9S5 15 6 12l3-6z M9 3v3 M15 3v3',
  key:      'M14 4a5 5 0 1 0-4 8l1 1-1 1-1-1-1 1-1-1-1 1-1 1-1-1 1-1 1-1 1-1 1-1 1-1 4-4a5 5 0 0 1 0-2z',
  crystal:  'M12 3 5 10l7 11 7-11z M5 10h14 M12 3v18 M9 10l3-7 3 7',

  // ---------- misc ----------
  user:     'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  users:    'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 21a7 7 0 0 1 14 0 M17 8a3 3 0 1 0 0-6 M22 14a5 5 0 0 0-5-5',
  book:     'M4 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z M20 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8z',
  scroll:   'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M8 9h8 M8 13h6',
  map:      'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z M9 4v14 M15 6v14',
  clock:    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  hourglass:'M6 3h12 M6 21h12 M6 3v4l6 5 6-5V3 M6 21v-4l6-5 6 5v4',
  gift:     'M4 12h16v9H4z M4 8h16v4H4z M12 8v13 M8 8V5a2 2 0 0 1 4 0v3 M16 8V5a2 2 0 0 0-4 0v3',
  megaphone:'M3 10v4l5 1 3 6 2-1-2-6 9 3V5l-9 3z M3 10h5v5H3z',
  flask:    'M9 3h6 M10 3v6l-4 9a2 2 0 0 0 2 3h8a2 2 0 0 0 2-3l-4-9V3 M6 14h12',
  axe:      'M3 21l9-9 M14 3l7 7-5 5-7-7z M9 12l-2 2',
  bowArrow: 'M5 19A14 14 0 0 1 19 5 M3 21l4-4 M17 3l4 4 M14 14l3 3',
  paw:      'M12 14a4 4 0 0 0-4 4c0 2 1 3 4 3s4-1 4-3a4 4 0 0 0-4-4z M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M17 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M4 14a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 4 14z M20 14a1.8 1.8 0 1 0 0-3.6A1.8 1.8 0 0 0 20 14z',
  fish:     'M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z M15 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z M3 12l-2-2v4z',
  mountain: 'M2 20l7-12 4 6 3-4 6 10z M9 8l2 3M11 14l2-3',
};

const FILLED = new Set([
  'hearth', 'tribe', 'ember', 'lands', 'bolt', 'crown',
  'star', 'gem', 'spear', 'horn',
]);

export default function Icon({ name, size = 24, stroke = 1.8, className, style }) {
  const d = PATHS[name];
  const filled = FILLED.has(name);
  if (!d && import.meta.env?.DEV && !Icon._warned?.has(name)) {
    Icon._warned = Icon._warned || new Set();
    Icon._warned.add(name);
    console.warn('[Icon] unknown name:', name);
  }
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d || PATHS.bolt} />
    </svg>
  );
}