const svg = (content) => `<svg viewBox="0 0 24 24">${content}</svg>`;

const EMOJI = {
  'brand-fire': svg('<path fill="#f26a10" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/>'),
  'smile': svg('<circle cx="12" cy="12" r="10" fill="#ffcf8f"/><circle cx="9" cy="10" r="1.6" fill="#1a0b02"/><circle cx="15" cy="10" r="1.6" fill="#1a0b02"/><path d="M7 14c1 2 3.5 3 5 3s4-1 5-3" stroke="#1a0b02" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  'bulb': svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z" fill="none" stroke="#efc168" stroke-width="1.8" stroke-linecap="round"/>'),
  'star': svg('<path fill="#efc168" d="M12 2 14 9l7 1-5 5 1 7-5-3-5 3 1-7-5-5 7-1z"/>'),
  'crown': svg('<path fill="#efc168" d="M4 18h16l-1-9-4 4-3-6-3 6-4-4z"/>'),
  'shield': svg('<path d="M12 2 4 5v7c0 6 4 9 8 10 4-1 8-4 8-10V5z" fill="none" stroke="#efc168" stroke-width="2" stroke-linejoin="round"/>'),
  'lock': svg('<path d="M6 11V8a6 6 0 0 1 12 0v3" fill="none" stroke="#efc168" stroke-width="2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="#efc168"/>'),
  'reaction-fire': svg('<path fill="#f26a10" d="M12 2c1 3-1 4-1 6a3 3 0 0 0 3 3c0-2 1-3 1-3 2 2 3 4 3 6a6 6 0 1 1-12 0c0-3 2-5 3-7 1-1 3-2 3-5z"/>'),
  'reaction-clap': svg('<circle cx="12" cy="12" r="9" fill="#ffcf8f"/><circle cx="9" cy="10" r="1.6" fill="#1a0b02"/><circle cx="15" cy="10" r="1.6" fill="#1a0b02"/><path d="M8 15c1.3 1.6 6.7 1.6 8 0" stroke="#1a0b02" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  'reaction-swords': svg('<g stroke="#cfd0d8" stroke-width="2" stroke-linecap="round" fill="none"><path d="M3 21 14 10 15 6 19 3 18 7 7 18z"/><path d="M21 21 10 10 9 6 5 3 6 7 17 18z"/></g>'),
  'reaction-thumbsup': svg('<path fill="#ffcf8f" d="M8 10v9h8a3 3 0 0 0 2.8-2l1.2-5a2 2 0 0 0-2-2.5h-4l.8-4A2.5 2.5 0 0 0 12 3z"/><rect x="4" y="10" width="3" height="9" fill="#ff8324"/>'),
  'reaction-joy': svg('<circle cx="12" cy="12" r="10" fill="#ffcf8f"/><path d="M7 15c1 2 3 2.5 5 2.5s4-.5 5-2.5" stroke="#1a0b02" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="9" cy="10" r="1.4" fill="#1a0b02"/><circle cx="15" cy="10" r="1.4" fill="#1a0b02"/>'),
  'flame_flicker': svg('<defs><linearGradient id="ff1" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#8f3402"/><stop offset=".5" stop-color="#f26a10"/><stop offset="1" stop-color="#fff2e0"/></linearGradient></defs><g><animateTransform attributeName="transform" type="scale" values="1;1.08;1" dur="1.2s" repeatCount="indefinite" additive="sum"/><path fill="url(#ff1)" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/></g>'),
  'spark_orbit': svg('<g><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="3s" repeatCount="indefinite"/><circle cx="12" cy="4" r="2" fill="#efc168"/><circle cx="20" cy="12" r="1.6" fill="#ffcf8f"/><circle cx="12" cy="20" r="2" fill="#ff8324"/><circle cx="4" cy="12" r="1.6" fill="#ffcf8f"/></g>'),
  'skull_pulse': svg('<g><animate attributeName="opacity" values=".7;1;.7" dur="1.8s" repeatCount="indefinite"/><path fill="#f0e6cf" d="M12 2a9 9 0 0 0-9 9c0 3 1.2 5 3 6.2V21h3v-2.5h2V21h4v-2.5h2V21h3v-3.8c1.8-1.2 3-3.2 3-6.2a9 9 0 0 0-9-9z"/><circle cx="8" cy="11" r="2" fill="#0b0a10"/><circle cx="16" cy="11" r="2" fill="#0b0a10"/></g>'),
  'moon_phase': svg('<g><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="10s" repeatCount="indefinite"/><circle cx="12" cy="12" r="9" fill="#f0e6cf"/><circle cx="16" cy="11" r="8" fill="rgba(0,0,0,.62)"/></g>'),
  'bolt_strike': svg('<g><animate attributeName="opacity" values="1;0;1;1" keyTimes="0;.1;.2;1" dur="3s" repeatCount="indefinite"/><path fill="#efc168" d="M13 2 5 14h5l-1 8 9-12h-5z"/></g>'),
  'eye_blink': svg('<path d="M2 12c3-5 7-7 10-7s7 2 10 7c-3 5-7 7-10 7S5 17 2 12z" fill="#f0e6cf"/><circle cx="12" cy="12" r="3.4" fill="#0b0a10"><animate attributeName="r" values="3.4;.1;3.4" keyTimes="0;.5;1" dur="4s" repeatCount="indefinite"/></circle>'),
  'eagle_flap': svg('<g><animateTransform attributeName="transform" type="scale" values="1;.88;1" dur=".6s" repeatCount="indefinite" additive="sum"/><path fill="#4a4235" d="M12 6 2 12l4 2 6-4 6 4 4-2z"/><path fill="#0b0a10" d="M10 14h4l-1 6-1-3-1 3z"/></g>'),
  'wolf_gaze': svg('<path fill="#4a4235" d="M4 4l3 5h10l3-5 1 9-9 9-9-9z"/><g><animate attributeName="opacity" values=".6;1;.6" dur="1.4s" repeatCount="indefinite"/><circle cx="9" cy="12" r="1.6" fill="#efc168"/><circle cx="15" cy="12" r="1.6" fill="#efc168"/></g>'),
  'rune_draw': svg('<path d="M4 20 12 4l8 16M8 14h8" stroke="#efc168" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-dasharray="60" stroke-dashoffset="60"><animate attributeName="stroke-dashoffset" from="60" to="0" dur="2s" repeatCount="indefinite"/></path>'),
  'halo_glow': svg('<circle cx="12" cy="12" r="10" fill="none" stroke="#efc168" stroke-width="1.4"><animate attributeName="r" values="8;11;8" dur="2.4s" repeatCount="indefinite"/><animate attributeName="opacity" values=".4;1;.4" dur="2.4s" repeatCount="indefinite"/></circle><circle cx="12" cy="12" r="4" fill="#efc168"/>'),
  'dagger_drip': svg('<path d="M12 2 10 14h4z" fill="#cfd0d8"/><rect x="8" y="14" width="8" height="2" fill="#4a4235"/><path d="M12 16v3" stroke="#a83028" stroke-width="1.6" stroke-linecap="round"/>'),
  'blood_seal': svg('<circle cx="12" cy="12" r="9" fill="#661a16"/><path fill="#d0483a" d="M12 6l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="8s" repeatCount="indefinite"/></path>'),
  'wound_open': svg('<path d="M12 3c-3 4-3 8 0 12s3 6 0 6-3-2 0-6-3-8 0-12z" fill="#d0483a" opacity=".9"/>'),
  'crack_spread': svg('<path d="M12 2 10 9l3 3-2 4 2 4-2 6" stroke="#661a16" stroke-width="1.6" fill="none" stroke-linecap="round"/>'),
  'ember_trail': svg('<g><circle cx="20" cy="20" r="1.6" fill="#ffcf8f"/><circle cx="18" cy="17" r="1.2" fill="#ff8324"/><circle cx="16" cy="14" r="1" fill="#f26a10"/></g>'),
  'ice_crystal': svg('<g stroke="#b9d5ff" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/></g>'),
  'frost_breath': svg('<g fill="none" stroke="#b9d5ff" stroke-width="1.6" stroke-linecap="round" opacity=".9"><path d="M4 12h6M4 8h3M4 16h3"/></g>'),
  'snowfall': svg('<g fill="#e6f6ff"><circle cx="4" cy="4" r="1.4"/><circle cx="9" cy="4" r="1.4"/><circle cx="14" cy="4" r="1.4"/><circle cx="19" cy="4" r="1.4"/></g>'),
  'freeze_shatter': svg('<g><path d="M12 4 9 12l4 4 3-8z" fill="#b9d5ff"/></g>'),
  'aurora_wave': svg('<path d="M2 16c4-4 8-4 10 0s6 4 10 0" stroke="#5f92d4" stroke-width="2" fill="none" stroke-linecap="round"/>'),
  'dom-fire': svg('<path fill="#f26a10" d="M12 2c1.5 3.5-.5 4.5-.5 6.5A3 3 0 0 0 15 11c0-2 .8-3 .8-3 2.2 2 3.2 4.4 3.2 6.6a7 7 0 1 1-14 0c0-3.3 2-5.5 3.4-7.6C9.6 5.6 11.7 4.5 12 2z"/>'),
  'dom-bone': svg('<path fill="#f0e6cf" d="M4 8a3 3 0 1 0 2 5l3 3a3 3 0 1 0 5-2l3-3a3 3 0 1 0-2-5l-3 3a3 3 0 0 0-5 2z" stroke="#877a5c" stroke-width="1.4" stroke-linejoin="round"/>'),
  'dom-sun': svg('<circle cx="12" cy="12" r="5" fill="#efc168"/><g stroke="#ff8324" stroke-width="2" stroke-linecap="round"><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></g>'),
  'dom-moon': svg('<path fill="#cfd0d8" d="M20 15A9 9 0 1 1 9 4a7 7 0 0 0 11 11z"/>'),
  'dom-ash': svg('<g stroke="#b8a99a" stroke-width="2" stroke-linecap="round"><path d="M5 15h14M6 12h12M8 9h8M4 18h16"/></g>'),
  'relic-vase': svg('<path fill="#c9a06a" d="M8 3h8l-1 3 3 6c1 3-1 8-6 9S5 15 6 12l3-6z"/><path d="M9 3h6" stroke="#8a5e19" stroke-width="1.4"/>'),
  'curse-key': svg('<circle cx="8" cy="8" r="4" fill="none" stroke="#7642a3" stroke-width="2"/><path d="M11 11l8 8-2 2-2-2-1 1-2-2-1 1-2-2" stroke="#7642a3" stroke-width="2" fill="none" stroke-linejoin="round"/>'),
  'war-swords': svg('<g stroke="#d0483a" stroke-width="2" stroke-linecap="round" fill="none"><path d="M3 21 14 10 15 6 19 3 18 7 7 18z"/><path d="M21 21 10 10 9 6 5 3 6 7 17 18z"/></g>')
};

const SETS = {
  spirits:   ['flame_flicker', 'spark_orbit', 'skull_pulse', 'moon_phase', 'bolt_strike'],
  ancestors: ['eye_blink', 'eagle_flap', 'wolf_gaze', 'rune_draw', 'halo_glow'],
  rites:     ['dagger_drip', 'blood_seal', 'wound_open', 'crack_spread', 'ember_trail'],
  winter:    ['ice_crystal', 'frost_breath', 'snowfall', 'freeze_shatter', 'aurora_wave']
};

function setFor(key) {
  for (const [s, keys] of Object.entries(SETS)) if (keys.includes(key)) return s;
  return null;
}

function nameFor(key) {
  return key.replace(/^(reaction|dom|terrain|trial|brand)-/, '')
    .replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

let _order = 0;
export const BUILTIN_SEED = Object.entries(EMOJI).map(([key, svgStr]) => ({
  key, name: nameFor(key), svg: svgStr,
  set_slug: setFor(key), price_stars: 0,
  sort_order: (_order += 10)
}));
export default BUILTIN_SEED;