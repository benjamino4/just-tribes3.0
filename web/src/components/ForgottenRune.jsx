export default function ForgottenRune({ size = 10, tone = 'var(--slate-400)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke={tone} strokeWidth="0.8" />
      <path d="M6 2.5 L9.5 9 L2.5 9 Z" fill="none" stroke={tone} strokeWidth="0.7" />
      <path d="M4 7.5 L8 7.5" stroke={tone} strokeWidth="0.5" opacity="0.6" />
    </svg>
  );
}