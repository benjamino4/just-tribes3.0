import React, { useEffect, useState, useMemo } from 'react';

// Tier helper kept for any callers that want just the palette.
export function fireStateFor(streak) {
  const s = Number(streak) || 0;
  if (s <= 0)  return { label: 'Extinguished', glow: '#4a5568' };
  if (s < 3)   return { label: 'Kindle', glow: '#c9184a' };
  if (s < 7)   return { label: 'Wildfire', glow: '#f97316' };
  if (s < 14)  return { label: 'Unstoppable', glow: '#facc15' };
  if (s < 30)  return { label: 'Mythic Laser', glow: '#c084fc' };
  return { label: 'Godlike Flame', glow: '#38bdf8' };
}

/**
 * LivingFire — a procedural, animated flame that grows with the user's streak.
 * @param {number} streak    Active streak count (0, 5, 14, 30+)
 * @param {number} size      Width/height in px (default 220)
 * @param {boolean} isFrozen Streak-freeze equipped (icy crystal shield mode)
 * @param {boolean} isMissed Day missed / broken streak (dying ember + smoke)
 */
export default function LivingFire({ streak = 0, size = 220, isFrozen = false, isMissed = false }) {
  const [displayedStreak, setDisplayedStreak] = useState(streak);
  const [isLevelingUp, setIsLevelingUp] = useState(false);

  useEffect(() => {
    setIsLevelingUp(true);
    const t = setTimeout(() => { setDisplayedStreak(streak); setIsLevelingUp(false); }, 220);
    return () => clearTimeout(t);
  }, [streak, isFrozen, isMissed]);

  const stage = useMemo(() => {
    if (isFrozen) return {
      label: 'Streak Frozen', emoji: '\uD83E\uDDCA',
      base: '#1e3a8a', mid: '#38bdf8', tip: '#f0f9ff', glow: '#38bdf8',
      badgeBg: 'rgba(56,189,248,0.18)', badgeBorder: 'rgba(56,189,248,0.65)',
      textGrad: 'linear-gradient(135deg,#ffffff 0%,#7dd3fc 50%,#38bdf8 100%)',
      height: Math.max(50, Math.min(130, 44 + streak * 3)), embers: 0, crystals: 10, smokeCount: 0,
    };
    if (isMissed) return {
      label: 'Missed Day!', emoji: '\uD83D\uDC94',
      base: '#18181b', mid: '#3f3f46', tip: '#ef4444', glow: '#71717a',
      badgeBg: 'rgba(239,68,68,0.12)', badgeBorder: 'rgba(239,68,68,0.5)',
      textGrad: 'linear-gradient(135deg,#fca5a5 0%,#ef4444 100%)',
      height: 38, embers: 2, crystals: 0, smokeCount: 6,
    };
    if (streak <= 0) return {
      label: 'Extinguished', emoji: '\uD83D\uDCA8',
      base: '#2b2d42', mid: '#4a5568', tip: '#718096', glow: '#4a5568',
      badgeBg: 'rgba(74,85,104,0.15)', badgeBorder: 'rgba(74,85,104,0.45)',
      textGrad: 'linear-gradient(135deg,#cbd5e1 0%,#64748b 100%)',
      height: 44, embers: 0, crystals: 0, smokeCount: 0,
    };
    if (streak < 3) return {
      label: 'Kindle', emoji: '\uD83C\uDF31',
      base: '#590d22', mid: '#a4133c', tip: '#ff4d6d', glow: '#c9184a',
      badgeBg: 'rgba(201,24,74,0.15)', badgeBorder: 'rgba(201,24,74,0.45)',
      textGrad: 'linear-gradient(135deg,#ff4d6d 0%,#c9184a 100%)',
      height: 64, embers: 4, crystals: 0, smokeCount: 0,
    };
    if (streak < 7) return {
      label: 'Wildfire', emoji: '\uD83D\uDD25',
      base: '#7f1d1d', mid: '#ea580c', tip: '#fde047', glow: '#f97316',
      badgeBg: 'rgba(249,115,22,0.15)', badgeBorder: 'rgba(249,115,22,0.45)',
      textGrad: 'linear-gradient(135deg,#fde047 0%,#ea580c 100%)',
      height: 86, embers: 7, crystals: 0, smokeCount: 0,
    };
    if (streak < 14) return {
      label: 'Unstoppable', emoji: '\u26A1',
      base: '#9a3412', mid: '#eab308', tip: '#ffffff', glow: '#facc15',
      badgeBg: 'rgba(250,204,21,0.15)', badgeBorder: 'rgba(250,204,21,0.45)',
      textGrad: 'linear-gradient(135deg,#ffffff 0%,#eab308 100%)',
      height: 106, embers: 11, crystals: 0, smokeCount: 0,
    };
    if (streak < 30) return {
      label: 'Mythic Laser', emoji: '\uD83D\uDD2E',
      base: '#4c1d95', mid: '#a855f7', tip: '#f472b6', glow: '#c084fc',
      badgeBg: 'rgba(192,132,252,0.16)', badgeBorder: 'rgba(192,132,252,0.45)',
      textGrad: 'linear-gradient(135deg,#f472b6 0%,#a855f7 100%)',
      height: 126, embers: 16, crystals: 0, smokeCount: 0,
    };
    return {
      label: 'Godlike Flame', emoji: '\uD83D\uDC51',
      base: '#0369a1', mid: '#06b6d4', tip: '#f0fdfa', glow: '#38bdf8',
      badgeBg: 'rgba(56,189,248,0.2)', badgeBorder: 'rgba(56,189,248,0.5)',
      textGrad: 'linear-gradient(135deg,#f0fdfa 0%,#06b6d4 100%)',
      height: 148, embers: 22, crystals: 0, smokeCount: 0,
    };
  }, [streak, isFrozen, isMissed]);

  const baseY = 165;
  const tipY = baseY - stage.height;
  const cid = useMemo(() => Math.random().toString(36).substring(2, 7), []);

  return (
    <div style={{
      width: size, display: 'flex', flexDirection: 'column', alignItems: 'center',
      position: 'relative', userSelect: 'none',
      transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      transform: isLevelingUp ? 'scale(1.08)' : 'scale(1)',
    }}>
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width="100%" height="100%" viewBox="0 0 200 200" style={{
          overflow: 'visible', transition: 'filter 0.5s ease',
          filter: isFrozen ? 'drop-shadow(0 0 16px rgba(56,189,248,0.6))'
            : isMissed ? 'drop-shadow(0 0 10px rgba(239,68,68,0.35))'
            : isLevelingUp ? `drop-shadow(0 0 22px ${stage.glow})` : 'none',
        }}>
          <defs>
            <radialGradient id={`glow-${cid}`} cx="50%" cy="80%" r="60%">
              <stop offset="0%" stopColor={stage.glow} stopOpacity={streak > 0 || isFrozen ? 0.6 : 0.18} />
              <stop offset="100%" stopColor={stage.glow} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`flameGrad-${cid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={stage.base} />
              <stop offset="48%" stopColor={stage.mid} />
              <stop offset="100%" stopColor={stage.tip} />
            </linearGradient>
            <linearGradient id={`coreGrad-${cid}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={stage.mid} stopOpacity={isMissed ? 0.2 : 0.45} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={isMissed ? 0.4 : 0.95} />
            </linearGradient>
            <linearGradient id={`iceGrad-${cid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          <circle cx="100" cy={baseY - 15} r="68" fill={`url(#glow-${cid})`} style={{ transition: 'all 0.5s ease' }}>
            <animate attributeName="r" values="66;74;66" dur={isFrozen ? '4s' : '2.4s'} repeatCount="indefinite" />
          </circle>

          <path fill={`url(#flameGrad-${cid})`}
            d={`M100 ${tipY} Q135 ${baseY - stage.height * 0.2} 100 ${baseY} Q65 ${baseY - stage.height * 0.2} 100 ${tipY}`}
            style={{ transition: 'd 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <animate attributeName="d" dur={isFrozen ? '4s' : isMissed ? '1.2s' : '1.8s'} repeatCount="indefinite"
              values={isFrozen
                ? `M100 ${tipY} Q135 ${baseY - stage.height * 0.2} 100 ${baseY} Q65 ${baseY - stage.height * 0.2} 100 ${tipY};M99 ${tipY - 2} Q136 ${baseY - stage.height * 0.19} 100 ${baseY} Q64 ${baseY - stage.height * 0.21} 99 ${tipY - 2};M100 ${tipY} Q135 ${baseY - stage.height * 0.2} 100 ${baseY} Q65 ${baseY - stage.height * 0.2} 100 ${tipY}`
                : `M100 ${tipY} Q135 ${baseY - stage.height * 0.2} 100 ${baseY} Q65 ${baseY - stage.height * 0.2} 100 ${tipY};M96 ${tipY - 8} Q139 ${baseY - stage.height * 0.15} 100 ${baseY} Q61 ${baseY - stage.height * 0.25} 96 ${tipY - 8};M104 ${tipY - 4} Q131 ${baseY - stage.height * 0.25} 100 ${baseY} Q69 ${baseY - stage.height * 0.15} 104 ${tipY - 4};M100 ${tipY} Q135 ${baseY - stage.height * 0.2} 100 ${baseY} Q65 ${baseY - stage.height * 0.2} 100 ${tipY}`} />
          </path>

          {(streak > 0 || isFrozen) && (
            <path fill={`url(#coreGrad-${cid})`}
              d={`M100 ${baseY - stage.height * 0.55} Q114 ${baseY - stage.height * 0.12} 100 ${baseY - 4} Q86 ${baseY - stage.height * 0.12} 100 ${baseY - stage.height * 0.55}`}
              style={{ transition: 'all 0.5s ease' }}>
              <animate attributeName="d" dur={isFrozen ? '3s' : '1.4s'} repeatCount="indefinite"
                values={`M100 ${baseY - stage.height * 0.55} Q114 ${baseY - stage.height * 0.12} 100 ${baseY - 4} Q86 ${baseY - stage.height * 0.12} 100 ${baseY - stage.height * 0.55};M98 ${baseY - stage.height * 0.6} Q116 ${baseY - stage.height * 0.1} 100 ${baseY - 4} Q84 ${baseY - stage.height * 0.14} 98 ${baseY - stage.height * 0.6};M100 ${baseY - stage.height * 0.55} Q114 ${baseY - stage.height * 0.12} 100 ${baseY - 4} Q86 ${baseY - stage.height * 0.12} 100 ${baseY - stage.height * 0.55}`} />
            </path>
          )}

          {isFrozen && (
            <polygon
              points={`100,${tipY - 14} 142,${baseY - stage.height * 0.5} 128,${baseY + 6} 72,${baseY + 6} 58,${baseY - stage.height * 0.5}`}
              fill={`url(#iceGrad-${cid})`} stroke="#bae6fd" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.82" />
          )}

          {isFrozen && Array.from({ length: stage.crystals }).map((_, i) => {
            const angle = (i / stage.crystals) * Math.PI * 2;
            const radius = 42 + (i % 3) * 12;
            const x = 100 + Math.cos(angle) * radius;
            const y = baseY - stage.height * 0.45 + Math.sin(angle) * (stage.height * 0.38);
            return (
              <polygon key={`crystal-${i}`}
                points={`${x},${y - 5} ${x + 3.5},${y} ${x},${y + 5} ${x - 3.5},${y}`}
                fill="#e0f2fe" stroke="#38bdf8" strokeWidth="0.8" opacity="0.85">
                <animateTransform attributeName="transform" type="rotate"
                  from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${4 + (i % 3) * 2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.95;0.3" dur={`${2 + (i % 2) * 1.5}s`} repeatCount="indefinite" />
              </polygon>
            );
          })}

          {isMissed && Array.from({ length: stage.smokeCount }).map((_, i) => {
            const startX = 96 + (i % 3) * 4 - 4;
            const driftX = 100 + ((i % 2 === 0 ? 1 : -1) * (18 + i * 8));
            const delay = (i * 0.38).toFixed(2);
            const duration = 2.4 + (i % 2) * 0.6;
            return (
              <circle key={`smoke-${i}`} cx={startX} cy={baseY - 10} r="4" fill="#a1a1aa" opacity="0">
                <animate attributeName="cx" values={`${startX};${driftX}`} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${baseY - 10};${baseY - 60};30`} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="r" values="4;16;28" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.5;0.25;0" keyTimes="0;0.2;0.6;1" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
            );
          })}

          {!isFrozen && Array.from({ length: stage.embers }).map((_, i) => {
            const delay = (i * 0.26).toFixed(2);
            const xOffset = ((i % 3) * 18 - 18);
            const duration = (1.9 + (i % 3) * 0.55).toFixed(1);
            return (
              <circle key={`ember-${i}`} cx="100" cy={baseY - 10} r={isMissed ? 1.2 : 1.6} fill={stage.tip}>
                <animate attributeName="cx" values={`100;${100 + xOffset};${100 + xOffset * 1.6}`} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="cy" values={`${baseY - 10};${baseY - stage.height * 0.55};25`} dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.95;0" keyTimes="0;0.25;1" dur={`${duration}s`} begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
        </svg>
      </div>

      <div style={{ marginTop: '-16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 2 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          backgroundColor: stage.badgeBg, border: `1.5px solid ${stage.badgeBorder}`,
          padding: '6px 16px', borderRadius: '999px',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          boxShadow: `0 8px 24px ${stage.glow}25, inset 0 1px 1px rgba(255,255,255,0.12)`,
          transition: 'all 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          transform: isLevelingUp ? 'scale(1.15) translateY(-4px)' : 'scale(1) translateY(0)',
        }}>
          <span style={{ fontSize: '18px', lineHeight: 1 }}>{stage.emoji}</span>
          <span style={{
            fontSize: '24px', fontWeight: 900, fontFamily: 'system-ui,-apple-system,sans-serif',
            lineHeight: 1, background: stage.textGrad,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px',
          }}>{displayedStreak}</span>
          <span style={{
            fontSize: '11.5px', fontWeight: 800, color: '#ffffff', opacity: 0.9,
            textTransform: 'uppercase', letterSpacing: '0.6px', fontFamily: 'system-ui,-apple-system,sans-serif',
          }}>{displayedStreak === 1 ? 'Day' : 'Days'}</span>
        </div>
        <span style={{
          fontSize: '11px', fontWeight: 700, color: stage.glow, letterSpacing: '1px',
          textTransform: 'uppercase', opacity: 0.9, textShadow: `0 2px 8px ${stage.glow}40`,
          transition: 'color 0.4s ease', fontFamily: 'system-ui,-apple-system,sans-serif',
        }}>{stage.label}</span>
      </div>
    </div>
  );
}
