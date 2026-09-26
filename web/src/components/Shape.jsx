import React from 'react';

// Wraps content in an organic shape via border-radius / clip. Gives the home
// tiles their varied silhouettes (blob, circle, curved, shield).
const RADII = {
  blob:   '46% 54% 58% 42% / 52% 44% 56% 48%',
  circle: '50%',
  curved: '28px 28px 28px 8px',
  shield: '18px 18px 40% 40% / 18px 18px 60% 60%',
  soft:   'var(--r-lg)',
};

export default function Shape({ kind = 'soft', children, style, className = '', tone, ...rest }) {
  return (
    <div
      className={`glass ${className}`}
      style={{
        borderRadius: RADII[kind] || RADII.soft,
        ...(tone ? { borderColor: tone + '55' } : {}),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export { RADII };
