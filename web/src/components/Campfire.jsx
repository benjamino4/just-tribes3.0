// Pure SVG + CSS living campfire. Breathing flames, rising embers, glow halo.
import React, { useMemo } from 'react';
import './campfire.css';

export default function Campfire({ streak = 0, lit = true }) {
  const embers = useMemo(
    () => Array.from({ length: 10 }, (_, i) => ({
      i,
      x: 20 + Math.random() * 60,
      delay: (Math.random() * 4).toFixed(2),
      dur: (3 + Math.random() * 3).toFixed(2),
      scale: (0.5 + Math.random()).toFixed(2),
    })),
    []
  );

  return (
    <div className={'campfire' + (lit ? '' : ' out')} data-streak={streak}>
      <div className="cf-halo" />
      <div className="cf-embers">
        {embers.map((e) => (
          <span
            key={e.i}
            className="cf-ember"
            style={{
              left: e.x + '%',
              animationDelay: e.delay + 's',
              animationDuration: e.dur + 's',
              transform: `scale(${e.scale})`,
            }}
          />
        ))}
      </div>
      <svg className="cf-svg" viewBox="0 0 160 160" width="200" height="200" aria-hidden="true">
        <defs>
          <radialGradient id="flameG" cx="50%" cy="75%" r="70%">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="35%" stopColor="#ffb03a" />
            <stop offset="70%" stopColor="#ff6a12" />
            <stop offset="100%" stopColor="#c53a05" />
          </radialGradient>
          <linearGradient id="logG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6b4a30" />
            <stop offset="100%" stopColor="#3c2718" />
          </linearGradient>
        </defs>
        {/* logs */}
        <g className="cf-logs">
          <rect x="40" y="120" width="80" height="14" rx="7" fill="url(#logG)" transform="rotate(-12 80 127)" />
          <rect x="40" y="120" width="80" height="14" rx="7" fill="url(#logG)" transform="rotate(12 80 127)" />
        </g>
        {lit && (
          <g className="cf-flames">
            <path className="cf-flame f1" d="M80 40c10 18-6 26-6 40a18 18 0 0 0 36 0c0-8-4-14-4-14 4 4 6 10 6 16a26 26 0 1 1-52 0c0-16 14-24 20-42z" fill="url(#flameG)" />
            <path className="cf-flame f2" d="M80 62c5 9-3 14-3 22a10 10 0 0 0 20 0c0-4-2-7-2-7 5 6 3 20-8 22s-17-8-17-16c0-9 7-14 10-21z" fill="#ffd27a" />
          </g>
        )}
      </svg>
    </div>
  );
}
