// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/components/Icon.jsx
// PURPOSE: Icon set. 24x24 SVG paths. Single component, name-keyed.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
const PATHS = {
  hearth: 'M12 3c.8 3.4-1 4.6-1 7a3 3 0 0 0 3 3c0-2 1-3 1-3 2.2 2.2 3 5 3 7a6 6 0 0 1-12 0c0-3.4 2-5.6 3.4-7.6C10.4 7.4 12 6 12 3z',
  tribe: 'M12 3l3.2 5.4 6.2 1-4.5 4.4 1.1 6.2-6-3.2-6 3.2 1.1-6.2L2.6 9.4l6.2-1L12 3z',
  ranks: 'M4 20V9m5 11V4m5 16v-7m5 7V8',
  lands: 'M3 20l4.2-8 3 4 4-9 3 6 4-4v11z',
  store: 'M4 8l1-3h14l1 3M4 8h16v11H4zM9 12h6',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  ember: 'M12 3c.6 2-.7 3-.7 4.5A2 2 0 0 0 14 9c0-1 .6-1.8.6-1.8 1.4 1.4 2 3 2 4.6a4.6 4.6 0 1 1-9.2 0c0-2 1.2-3.4 2-4.8.8-1.2 2.4-1.8 2.6-4z',
  ash: 'M5 15h14M6 12h12M8 9h8M4 18h16',
  star: 'M12 3 14 9l6.5 1-5 4.6 1.3 6.4-5.8-3-5.8 3 1.3-6.4-5-4.6 6.5-1z',
  chevron: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12l5 5L20 6',
  lock: 'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  eye: 'M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7S5 17 2 12z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bell: 'M12 3a5 5 0 0 0-5 5v4l-2 3h14l-2-3V8a5 5 0 0 0-5-5z M9.5 18a2.5 2.5 0 0 0 5 0',
  shield: 'M12 2 4 5v7c0 6 4 9 8 10 4-1 8-4 8-10V5z',
  ban: 'M5 5l14 14M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  warn: 'M12 3 1.8 20h20.4z M12 9v5 M12 18v.01',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7v.01',
  bolt: 'M13 2 4 14h6l-1 8 9-12h-6z',
  swords: 'M3 21 14 10l1-4 4-3-1 4-11 11z M21 21 10 10 9 6 5 3l1 4 11 11z',
  crown: 'M3 19h18l-1.5-11-4.5 4.5L12 5l-3 7.5L4.5 8z M12 5v2',
  pyre: 'M3 20h18l-2-6H5z M12 14V8 M9 8l3-5 3 5 M9 4h6',
  relic: 'M12 3l3 6h6l-4.5 4 1.5 6-6-3.5L6 19l1.5-6L3 9h6z',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2l1.6 2.6 3-.5.5 3L21 10l-1.9 2.4 1.9 2.4-2.4 1.4-.5 3-3-.5L12 22l-1.6-2.6-3 .5-.5-3L4 14l1.9-2.4L4 9.2l2.4-1.4.5-3 3 .5z',
  gift: 'M4 12h16v9H4z M4 8h16v4H4z M12 8v13 M8 8V5a2 2 0 0 1 4 0v3 M16 8V5a2 2 0 0 0-4 0v3',
  hourglass: 'M6 3h12 M6 21h12 M6 3v4l6 5 6-5V3 M6 21v-4l6-5 6 5v4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v5l3 2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2 21a7 7 0 0 1 14 0 M17 8a3 3 0 1 0 0-6 M22 14a5 5 0 0 0-5-5',
  scroll: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M8 9h8 M8 13h6'
};

export default function Icon({ name, size = 24, stroke = 1.8, className, style }) {
  const d = PATHS[name];
  return (
    <svg
      className={className}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d || PATHS.bolt} />
    </svg>
  );
}