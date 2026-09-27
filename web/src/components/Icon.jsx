// A small animated icon set. Phase 1: static SVG paths used everywhere.
// Phase 4 adds the full animated emoji library.
const PATHS = {
  fire:    'M12 2c1 3-1 4-1 6a3 3 0 0 0 3 3c0-2 1-3 1-3 2 2 3 4 3 6a6 6 0 1 1-12 0c0-3 2-5 3-7 1-1 3-2 3-5z',
  tribe:   'M12 3l3 5 5 1-4 4 1 6-5-3-5 3 1-6-4-4 5-1z',
  ranks:   'M4 20V9m5 11V4m5 16v-7m5 7V8',
  lands:   'M3 20l4-8 3 4 4-9 3 6 4-4v11z',
  store:   'M4 8l1-3h14l1 3M4 8h16v11H4zM9 12h6',
  ember:   'M12 3c.6 2-.7 3-.7 4.5A2 2 0 0 0 14 9c0-1 .6-1.8.6-1.8 1.4 1.4 2 3 2 4.6a4.6 4.6 0 1 1-9.2 0c0-2 1.2-3.4 2-4.8.8-1.2 2.4-1.8 2.6-4z',
  ash:     'M5 15h14M6 12h12M8 9h8M4 18h16',
  bolt:    'M13 2L4 14h6l-1 8 9-12h-6z',
  crown:   'M4 18h16l-1-9-4 4-3-6-3 6-4-4z',
  spark:   'M12 2v6m0 8v6m10-10h-6M8 12H2m14.5-6.5L14 8m-4 8l-2.5 2.5M18.5 18L16 15.5M8 8L5.5 5.5',
  check:   'M4 12l5 5L20 6',
  chevron: 'M9 6l6 6-6 6',
  gear:    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2l1.6 2.6 3-.5.5 3L21 10l-1.9 2.4 1.9 2.4-2.4 1.4-.5 3-3-.5L12 22l-1.6-2.6-3 .5-.5-3L4 14l1.9-2.4L4 9.2l2.4-1.4.5-3 3 .5z',
  user:    'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  plus:    'M12 5v14M5 12h14',
  lock:    'M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z',
  chevL:   'M15 6l-6 6 6 6',
};
const FILLED = new Set(['fire', 'tribe', 'ember', 'lands', 'bolt', 'crown']);

export default function Icon({ name, size = 24, stroke = 2, className, style }) {
  const d = PATHS[name] || PATHS.spark;
  const filled = FILLED.has(name);
  return (
    <svg
      className={className}
      style={style}
      width={size} height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}