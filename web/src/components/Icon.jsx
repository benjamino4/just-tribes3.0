// Lightweight inline-SVG icon component.
// Reconstructed to satisfy the `../components/Icon.jsx` import used by screens;
// renders a small stroked glyph by name with a safe fallback.

const PATHS = {
  flame: 'M12 2c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.6C8 8 7 9.5 7 12a5 5 0 0 0 10 0c0-4-3-6-5-10z',
  blade: 'M4 20l10-10M14 4l6 6-4 1-3-3 1-4z',
  voice: 'M12 3v18M8 7v10M16 7v10M4 10v4M20 10v4',
  shield: 'M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z',
  spark: 'M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M9 15h6v3H9zM8 20h8',
  skull: 'M12 3a7 7 0 0 0-4 12v3h8v-3a7 7 0 0 0-4-12zM9 11h.01M15 11h.01',
};

export default function Icon({ name = 'flame', size = 20, tone = 'currentColor', strokeWidth = 1.75, style, ...rest }) {
  const d = PATHS[name] || PATHS.flame;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={tone}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle', ...style }}
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
