// TRIBES-FILE: web/src/data/emojis.js
// PHASE: 4 — Relics
// The 25 animated SVG emojis. Each is a small self-contained SVG string
// with a shared animate API: <Emoji name="fire" size={24} animate />.
//
// 5 free (fire, clap, swords, thumbsup, joy)
// 5 spirits (flame_flicker, spark_orbit, skull_pulse, moon_phase, bolt_strike)
// 5 ancestors (eye_blink, eagle_flap, wolf_gaze, rune_draw, halo_glow)
// 5 rites (dagger_drip, blood_seal, wound_open, crack_spread, ember_trail)
// 5 winter (ice_crystal, frost_breath, snowfall, freeze_shatter, aurora_wave)

export const EMOJI = {
  /* ---------- free ---------- */
  fire: `<svg viewBox="0 0 24 24"><path fill="#ff7a18" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/></svg>`,
  clap: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#ffcf8f"/><circle cx="9" cy="10" r="1.6" fill="#2a1200"/><circle cx="15" cy="10" r="1.6" fill="#2a1200"/><path d="M8 15c1.3 1.6 6.7 1.6 8 0" stroke="#2a1200" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>`,
  swords: `<svg viewBox="0 0 24 24"><g stroke="#cfd0d8" stroke-width="2" stroke-linecap="round"><path d="M3 21 14 10 15 6 19 3 18 7 7 18z"/><path d="M21 21 10 10 9 6 5 3 6 7 17 18z"/></g></svg>`,
  thumbsup: `<svg viewBox="0 0 24 24"><path fill="#ffcf8f" d="M8 10v9h8a3 3 0 0 0 2.8-2l1.2-5a2 2 0 0 0-2-2.5h-4l.8-4A2.5 2.5 0 0 0 12 3z"/><rect x="4" y="10" width="3" height="9" fill="#ff9f45"/></svg>`,
  joy: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffcf8f"/><path d="M7 15c1 2 3 2.5 5 2.5s4-.5 5-2.5" stroke="#2a1200" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.4" fill="#2a1200"/><circle cx="15" cy="10" r="1.4" fill="#2a1200"/></svg>`,

  /* ---------- spirits ---------- */
  flame_flicker: `<svg viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="1.2s" repeatCount="indefinite" additive="sum"/><path fill="url(#ff)" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/></g><defs><linearGradient id="ff" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#c53a05"/><stop offset=".5" stop-color="#ff7a18"/><stop offset="1" stop-color="#fff3c4"/></linearGradient></defs></svg>`,
  spark_orbit: `<svg viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="3s" repeatCount="indefinite"/><circle cx="12" cy="4" r="2" fill="#ffd27a"/><circle cx="20" cy="12" r="1.6" fill="#ffcf8f"/><circle cx="12" cy="20" r="2" fill="#ff9f45"/><circle cx="4" cy="12" r="1.6" fill="#ffcf8f"/></g></svg>`,
  skull_pulse: `<svg viewBox="0 0 24 24"><g><animate attributeName="opacity" values=".7;1;.7" dur="1.8s" repeatCount="indefinite"/><path fill="#e6ded1" d="M12 2a9 9 0 0 0-9 9c0 3 1.2 5 3 6.2V21h3v-2.5h2V21h4v-2.5h2V21h3v-3.8c1.8-1.2 3-3.2 3-6.2a9 9 0 0 0-9-9z"/><circle cx="8" cy="11" r="2" fill="#1a1020"/><circle cx="16" cy="11" r="2" fill="#1a1020"/></g></svg>`,
  moon_phase: `<svg viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="10s" repeatCount="indefinite"/><circle cx="12" cy="12" r="9" fill="#f6efe6"/><circle cx="16" cy="11" r="8" fill="rgba(0,0,0,.55)"/></g></svg>`,
  bolt_strike: `<svg viewBox="0 0 24 24"><g><animate attributeName="opacity" values="1;0;1;1" keyTimes="0;.1;.2;1" dur="3s" repeatCount="indefinite"/><path fill="#ffd27a" d="M13 2 5 14h5l-1 8 9-12h-5z"/></g></svg>`,

  /* ---------- ancestors ---------- */
  eye_blink: `<svg viewBox="0 0 24 24"><path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7S5 17 2 12z" fill="#f6efe6"/><circle cx="12" cy="12" r="3.4" fill="#2a1200"><animate attributeName="r" values="3.4;.1;3.4" keyTimes="0;.5;1" dur="4s" repeatCount="indefinite"/></circle></svg>`,
  eagle_flap: `<svg viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="scale" values="1;.88;1" dur=".6s" repeatCount="indefinite" additive="sum"/><path fill="#4a4038" d="M12 6 2 12l4 2 6-4 6 4 4-2z"/><path fill="#2a1200" d="M10 14h4l-1 6-1-3-1 3z"/></g></svg>`,
  wolf_gaze: `<svg viewBox="0 0 24 24"><path fill="#4a4038" d="M4 4l3 5h10l3-5 1 9-9 9-9-9z"/><g><animate attributeName="opacity" values=".6;1;.6" dur="1.4s" repeatCount="indefinite"/><circle cx="9" cy="12" r="1.6" fill="#ffcf8f"/><circle cx="15" cy="12" r="1.6" fill="#ffcf8f"/></g></svg>`,
  rune_draw: `<svg viewBox="0 0 24 24"><path d="M4 20 12 4l8 16M8 14h8" stroke="#ffcf8f" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60"><animate attributeName="stroke-dashoffset" from="60" to="0" dur="2s" repeatCount="indefinite"/></path></svg>`,
  halo_glow: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="#ffd27a" stroke-width="1.4"><animate attributeName="r" values="8;11;8" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".4;1;.4" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="12" cy="12" r="4" fill="#ffd27a"/></svg>`,

  /* ---------- rites ---------- */
  dagger_drip: `<svg viewBox="0 0 24 24"><path d="M12 2 10 14h4z" fill="#cfd0d8"/><rect x="8" y="14" width="8" height="2" fill="#4a4038"/><path d="M12 16v3" stroke="#c0392b" stroke-width="1.6" stroke-linecap="round"><animate attributeName="y2" values="18;22;18" dur="1.6s" repeatCount="indefinite"/></path></svg>`,
  blood_seal: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#8b1a1a"/><path fill="#c0392b" d="M12 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite"/></path></svg>`,
  wound_open: `<svg viewBox="0 0 24 24"><path d="M12 3c-3 4-3 8 0 12s3 6 0 6-3-2 0-6-3-8 0-12z" fill="#c0392b" opacity=".9"><animate attributeName="opacity" values=".7;1;.7" dur="2s" repeatCount="indefinite"/></path><circle cx="12" cy="12" r="9" fill="none" stroke="#8b1a1a" stroke-width="1" opacity=".6"/></svg>`,
  crack_spread: `<svg viewBox="0 0 24 24"><path d="M12 2 10 9l3 3-2 4 2 4-2 6" stroke="#8b1a1a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="30" stroke-dashoffset="30"><animate attributeName="stroke-dashoffset" from="30" to="0" dur="2s" repeatCount="indefinite"/></path></svg>`,
  ember_trail: `<svg viewBox="0 0 24 24"><g><animateTransform attributeName="transform" type="translate" values="0 0;-2 -3;-4 -6;-6 -9" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;.6;.3;0" dur="2s" repeatCount="indefinite"/><circle cx="20" cy="20" r="1.6" fill="#ffcf8f"/><circle cx="18" cy="17" r="1.2" fill="#ff9f45"/><circle cx="16" cy="14" r="1" fill="#ff7a18"/></g></svg>`,

  /* ---------- winter ---------- */
  ice_crystal: `<svg viewBox="0 0 24 24"><g stroke="#8ddcff" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="20s" repeatCount="indefinite"/></path></g></svg>`,
  frost_breath: `<svg viewBox="0 0 24 24"><g fill="none" stroke="#b8e8ff" stroke-width="1.6" stroke-linecap="round" opacity=".9"><path d="M4 12h6M4 8h3M4 16h3"/><animateTransform attributeName="transform" type="translate" values="0 0;2 0;4 0;2 0;0 0" dur="3s" repeatCount="indefinite"/></g></svg>`,
  snowfall: `<svg viewBox="0 0 24 24"><g fill="#e6f6ff">${[0,1,2,3,4,5].map((i) => `<circle cx="${4 + i * 3.2}" cy="4" r="1.4"><animate attributeName="cy" values="2;22;2" dur="${2 + i * 0.3}s" repeatCount="indefinite"/></circle>`).join('')}</g></svg>`,
  freeze_shatter: `<svg viewBox="0 0 24 24"><g><animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite"/><path d="M12 4 9 12l4 4 3-8z" fill="#8ddcff"/><path d="M12 4v18M4 12h16" stroke="#8ddcff" stroke-width="1" fill="none" opacity=".4"/></g></svg>`,
  aurora_wave: `<svg viewBox="0 0 24 24"><path d="M2 16c4-4 8-4 10 0s6 4 10 0" stroke="#5ac8ff" stroke-width="2" fill="none" stroke-linecap="round"><animate attributeName="d" values="M2 16c4-4 8-4 10 0s6 4 10 0;M2 12c4 4 8 4 10 0s6-4 10 0;M2 16c4-4 8-4 10 0s6 4 10 0" dur="4s" repeatCount="indefinite"/></path><path d="M2 20c4-3 8-3 10 0s6 3 10 0" stroke="#7cc4ff" stroke-width="1.4" fill="none" opacity=".7"/></svg>`,
};

export const FREE_KEYS = ['fire', 'clap', 'swords', 'thumbsup', 'joy'];

export const SETS = {
  spirits: ['flame_flicker', 'spark_orbit', 'skull_pulse', 'moon_phase', 'bolt_strike'],
  ancestors: ['eye_blink', 'eagle_flap', 'wolf_gaze', 'rune_draw', 'halo_glow'],
  rites: ['dagger_drip', 'blood_seal', 'wound_open', 'crack_spread', 'ember_trail'],
  winter: ['ice_crystal', 'frost_breath', 'snowfall', 'freeze_shatter', 'aurora_wave'],
};

export function emojiHtml(key) {
  return EMOJI[key] || EMOJI.spark_orbit;
}