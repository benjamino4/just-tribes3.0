// Premium "Stone Age" animated emoji set.
// These are PAID (price_stars > 0, builtin = false) — unlocked via the Altar/Vault
// store, never granted for free. Each glyph is a self-contained SMIL-animated SVG
// (no scripts, no event handlers) so it animates safely wherever it is rendered.
//
// Seeding is idempotent: ON CONFLICT (key/slug) DO NOTHING. It runs on every boot
// so the premium set is always present in production without needing MIGRATE=1,
// but it never overwrites an admin's later edits to price or art.

const C = (body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" ${extra}>${body}</svg>`;

export const STONE_AGE_EMOJIS = [
  {
    key: 'sa_campfire', name: 'Campfire',
    svg: C(`
      <ellipse cx="32" cy="54" rx="18" ry="5" fill="#2a1a0e"/>
      <rect x="14" y="48" width="36" height="6" rx="3" fill="#6b4423" transform="rotate(12 32 51)"/>
      <rect x="14" y="48" width="36" height="6" rx="3" fill="#8a5a2b" transform="rotate(-12 32 51)"/>
      <path fill="#f7a259" d="M32 14c7 8 10 14 10 22a10 10 0 0 1-20 0c0-6 3-10 10-22z">
        <animate attributeName="d" dur="0.7s" repeatCount="indefinite"
          values="M32 14c7 8 10 14 10 22a10 10 0 0 1-20 0c0-6 3-10 10-22z;
                  M32 12c8 9 11 15 11 23a11 11 0 0 1-22 0c0-7 3-11 11-23z;
                  M32 14c7 8 10 14 10 22a10 10 0 0 1-20 0c0-6 3-10 10-22z"/>
      </path>
      <path fill="#ffe08a" d="M32 26c4 5 6 8 6 13a6 6 0 0 1-12 0c0-4 2-7 6-13z">
        <animate attributeName="opacity" dur="0.5s" repeatCount="indefinite" values="1;0.6;1"/>
      </path>`)
  },
  {
    key: 'sa_mammoth', name: 'Mammoth',
    svg: C(`
      <ellipse cx="34" cy="34" rx="20" ry="15" fill="#6b4e8c"/>
      <path d="M14 34c-4 0-7 4-7 9" stroke="#4b3663" stroke-width="4" fill="none" stroke-linecap="round"/>
      <circle cx="16" cy="30" r="10" fill="#7d5ea3"/>
      <path d="M12 36c-3 4-3 9 0 13" stroke="#efe6d2" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M20 36c-2 4-2 9 1 13" stroke="#efe6d2" stroke-width="3" fill="none" stroke-linecap="round"/>
      <circle cx="13" cy="28" r="1.8" fill="#1a1020"/>
      <g>
        <path d="M8 38c-5 2-7 7-5 12" stroke="#d7b57a" stroke-width="3.5" fill="none" stroke-linecap="round"/>
        <animateTransform attributeName="transform" type="rotate" dur="2s" repeatCount="indefinite"
          values="-4 10 36;4 10 36;-4 10 36"/>
      </g>
      <rect x="24" y="46" width="4" height="8" fill="#4b3663"/>
      <rect x="42" y="46" width="4" height="8" fill="#4b3663"/>`)
  },
  {
    key: 'sa_wheel', name: 'Stone Wheel',
    svg: C(`
      <g>
        <circle cx="32" cy="32" r="22" fill="#9a9188" stroke="#5c554d" stroke-width="4"/>
        <circle cx="32" cy="32" r="5" fill="#5c554d"/>
        <rect x="30" y="12" width="4" height="40" fill="#5c554d"/>
        <rect x="12" y="30" width="40" height="4" fill="#5c554d"/>
        <rect x="30" y="12" width="4" height="40" fill="#5c554d" transform="rotate(45 32 32)"/>
        <rect x="12" y="30" width="40" height="4" fill="#5c554d" transform="rotate(45 32 32)"/>
        <animateTransform attributeName="transform" type="rotate" dur="3s" repeatCount="indefinite"
          values="0 32 32;360 32 32"/>
      </g>`)
  },
  {
    key: 'sa_axe', name: 'Stone Axe',
    svg: C(`
      <g>
        <rect x="29" y="20" width="6" height="36" rx="3" fill="#8a5a2b"/>
        <path d="M20 14l16 2 2 10-16-2z" fill="#9a9188" stroke="#5c554d" stroke-width="2"/>
        <path d="M36 16l8 1 1 6-8-1z" fill="#bdb5aa"/>
        <animateTransform attributeName="transform" type="rotate" dur="1.6s" repeatCount="indefinite"
          values="-14 32 54;10 32 54;-14 32 54"/>
      </g>`)
  },
  {
    key: 'sa_meat', name: 'Meat Leg',
    svg: C(`
      <g>
        <path d="M20 44c-8-8-6-22 4-28 9-5 20 2 20 12 0 6-4 10-10 12" fill="#b4532f" stroke="#7d3418" stroke-width="2"/>
        <rect x="14" y="42" width="14" height="7" rx="3.5" fill="#f0e6d2" transform="rotate(40 21 45)"/>
        <circle cx="38" cy="26" r="3" fill="#d6744a"/>
        <path d="M30 10c2-4 6-4 8 0" stroke="#ffd27f" stroke-width="2" fill="none" stroke-linecap="round">
          <animate attributeName="opacity" dur="1.2s" repeatCount="indefinite" values="0.2;1;0.2"/>
        </path>
        <path d="M38 8c2-4 6-4 8 0" stroke="#ffd27f" stroke-width="2" fill="none" stroke-linecap="round">
          <animate attributeName="opacity" dur="1.2s" begin="0.4s" repeatCount="indefinite" values="0.2;1;0.2"/>
        </path>
      </g>`)
  },
  {
    key: 'sa_saber', name: 'Saber Tooth',
    svg: C(`
      <circle cx="32" cy="32" r="20" fill="#d79a4a"/>
      <path d="M14 20l8 6-10 2z" fill="#d79a4a"/>
      <path d="M50 20l-8 6 10 2z" fill="#d79a4a"/>
      <circle cx="25" cy="30" r="3" fill="#2a1a0e"><animate attributeName="ry" dur="2.5s" repeatCount="indefinite" values="3;0.6;3;3"/></circle>
      <circle cx="39" cy="30" r="3" fill="#2a1a0e"><animate attributeName="ry" dur="2.5s" repeatCount="indefinite" values="3;0.6;3;3"/></circle>
      <path d="M28 44l4-3 4 3" stroke="#2a1a0e" stroke-width="2" fill="none"/>
      <path d="M27 42l-2 10" stroke="#f4f0e6" stroke-width="3" stroke-linecap="round"/>
      <path d="M37 42l2 10" stroke="#f4f0e6" stroke-width="3" stroke-linecap="round"/>`)
  },
  {
    key: 'sa_spear', name: 'Flint Spear',
    svg: C(`
      <g>
        <rect x="10" y="29" width="44" height="5" rx="2.5" fill="#8a5a2b"/>
        <path d="M52 24l10 7.5-10 7.5-4-7.5z" fill="#9a9188" stroke="#5c554d" stroke-width="2"/>
        <animateTransform attributeName="transform" type="translate" dur="1s" repeatCount="indefinite"
          values="-5 0;5 0;-5 0"/>
      </g>`)
  },
  {
    key: 'sa_cave', name: 'Cave',
    svg: C(`
      <rect x="6" y="10" width="52" height="46" rx="6" fill="#6b6058"/>
      <path d="M20 56c0-14 4-24 12-24s12 10 12 24z" fill="#1a1410"/>
      <circle cx="32" cy="46" r="3" fill="#f7a259">
        <animate attributeName="r" dur="0.8s" repeatCount="indefinite" values="2.4;3.4;2.4"/>
        <animate attributeName="opacity" dur="0.8s" repeatCount="indefinite" values="0.6;1;0.6"/>
      </circle>
      <path d="M12 16h8M26 15h10M44 17h7" stroke="#4b443d" stroke-width="2" stroke-linecap="round"/>`)
  },
  {
    key: 'sa_fire_dance', name: 'Dancing Flame',
    svg: C(`
      <path fill="#d46f2c" d="M32 10c6 10 12 14 12 24a12 12 0 0 1-24 0c0-8 5-12 12-24z">
        <animateTransform attributeName="transform" type="skewX" dur="0.6s" repeatCount="indefinite"
          values="-6;6;-6" additive="sum"/>
      </path>
      <path fill="#ffd27f" d="M32 24c3 6 6 8 6 14a6 6 0 0 1-12 0c0-5 3-8 6-14z">
        <animate attributeName="opacity" dur="0.4s" repeatCount="indefinite" values="1;0.5;1"/>
      </path>
      <ellipse cx="32" cy="52" rx="14" ry="4" fill="#2a1a0e" opacity="0.6"/>`)
  },
  {
    key: 'sa_handprint', name: 'Cave Handprint',
    svg: C(`
      <g fill="#b4532f">
        <ellipse cx="32" cy="42" rx="11" ry="13"/>
        <rect x="20" y="20" width="5" height="20" rx="2.5"/>
        <rect x="27" y="14" width="5" height="26" rx="2.5"/>
        <rect x="34" y="14" width="5" height="26" rx="2.5"/>
        <rect x="41" y="20" width="5" height="20" rx="2.5"/>
        <rect x="13" y="34" width="6" height="14" rx="3" transform="rotate(40 16 41)"/>
        <animate attributeName="opacity" dur="2.4s" repeatCount="indefinite" values="0.75;1;0.75"/>
      </g>`)
  }
];

export const STONE_AGE_SET = {
  slug: 'stone_age',
  name: 'Stone Age (Animated)',
  description: 'A premium pack of 10 hand-animated stone-age glyphs. Unlock once, use everywhere.',
  price_stars: 150,
  keys: STONE_AGE_EMOJIS.map((e) => e.key)
};

export async function seedEmoji(pool) {
  if (!pool) return;
  for (let i = 0; i < STONE_AGE_EMOJIS.length; i++) {
    const e = STONE_AGE_EMOJIS[i];
    await pool.query(
      `INSERT INTO emoji_defs (key, name, svg, set_slug, price_stars, sort_order, builtin, active)
       VALUES ($1,$2,$3,$4,0,$5,false,true)
       ON CONFLICT (key) DO NOTHING`,
      [e.key, e.name, e.svg, STONE_AGE_SET.slug, (i + 1) * 10]
    );
  }
  await pool.query(
    `INSERT INTO emoji_sets (slug, name, description, price_stars, emoji_keys, sort_order, active)
     VALUES ($1,$2,$3,$4,$5::jsonb,10,true)
     ON CONFLICT (slug) DO NOTHING`,
    [STONE_AGE_SET.slug, STONE_AGE_SET.name, STONE_AGE_SET.description,
     STONE_AGE_SET.price_stars, JSON.stringify(STONE_AGE_SET.keys)]
  );
}
