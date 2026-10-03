// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/data/emojis.js
// PURPOSE: Client-side builtin emoji fallback. Never optional.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
const svg = (content) => `<svg viewBox="0 0 24 24">${content}</svg>`;

export const BUILTIN_EMOJIS = {
  'smile': svg('<circle cx="12" cy="12" r="10" fill="#ffcf8f"/><circle cx="9" cy="10" r="1.6" fill="#1a0b02"/><circle cx="15" cy="10" r="1.6" fill="#1a0b02"/><path d="M7 14c1 2 3.5 3 5 3s4-1 5-3" stroke="#1a0b02" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  'bulb': svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" fill="none" stroke="#efc168" stroke-width="1.8" stroke-linecap="round"/>'),
  'star': svg('<path fill="#efc168" d="M12 2 14 9l7 1-5 5 1 7-5-3-5 3 1-7-5-5 7-1z"/>'),
  'crown': svg('<path fill="#efc168" d="M4 18h16l-1-9-4 4-3-6-3 6-4-4z"/>'),
  'reaction-fire': svg('<path fill="#f26a10" d="M12 2c1 3-1 4-1 6a3 3 0 0 0 3 3c0-2 1-3 1-3 2 2 3 4 3 6a6 6 0 1 1-12 0c0-3 2-5 3-7 1-1 3-2 3-5z"/>'),
  'reaction-swords': svg('<g stroke="#cfd0d8" stroke-width="2" stroke-linecap="round" fill="none"><path d="M3 21 14 10 15 6 19 3 18 7 7 18z"/><path d="M21 21 10 10 9 6 5 3 6 7 17 18z"/></g>'),
  'reaction-thumbsup': svg('<path fill="#ffcf8f" d="M8 10v9h8a3 3 0 0 0 2.8-2l1.2-5a2 2 0 0 0-2-2.5h-4l.8-4A2.5 2.5 0 0 0 12 3z"/><rect x="4" y="10" width="3" height="9" fill="#ff8324"/>'),
  'flame_flicker': svg('<g><animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="1.2s" repeatCount="indefinite" additive="sum"/><path fill="#ff8324" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/></g>'),
  'relic-vase': svg('<path fill="#c9a06a" d="M8 3h8l-1 3 3 6c1 3-1 8-6 9S5 15 6 12l3-6z"/><path d="M9 3h6" stroke="#8a5e19" stroke-width="1.4"/>'),
  'war-swords': svg('<g stroke="#d0483a" stroke-width="2" stroke-linecap="round" fill="none"><path d="M3 21 14 10 15 6 19 3 18 7 7 18z"/><path d="M21 21 10 10 9 6 5 3 6 7 17 18z"/></g>'),
  'gift': svg('<path fill="#efc168" d="M4 12h16v9H4z M4 8h16v4H4z M12 8v13 M8 8V5a2 2 0 0 1 4 0v3 M16 8V5a2 2 0 0 0-4 0v3"/>')
};