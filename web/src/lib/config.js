import { create } from 'zustand';

/* =====================================================================
   Client-side game config. Admins edit this in the Admin mini-app and
   the whole game reads it instantly (persisted to localStorage). In
   production this mirrors the server `config` table — the admin panel
   would POST changes to /api/admin and the client would hydrate from
   /api/state. For now it makes admin controls fully live in the demo.
===================================================================== */
const KEY = 'tribes.cfg';

export const DEFAULT_CFG = {
  // Home tab layout — admin can toggle sections + reorder + pick a shape.
  home: {
    heroShape: 'blob',            // blob | circle | curved | shield
    accent: '#ff7a18',
    sections: [
      { id: 'streak',  name: 'Streak Trail',   icon: 'flame',   shape: 'circle', on: true },
      { id: 'ash',     name: 'Gather the Ash',  icon: 'ash',     shape: 'curved', on: true },
      { id: 'quests',  name: 'Daily Quests',    icon: 'scroll',  shape: 'blob',   on: true },
      { id: 'trials',  name: 'Trials of Fire',  icon: 'bolt',    shape: 'shield', on: true },
      { id: 'spin',    name: 'Wheel of Ash',    icon: 'wheel',   shape: 'circle', on: true },
    ],
  },
  // Emoji economy — 5 free, the rest unlock with Stars (admin sets price).
  emojiSets: [
    { id: 'ancients', name: 'Ancient Spirits', price: 120, emojis: ['🔥','⚡','🌀','🌙','☄️','🌋','🪨','🧿','💀','🎖️'] },
    { id: 'beasts',   name: 'Wild Beasts',      price: 200, emojis: ['🐺','🦅','🐍','🦏','🐻','🦣','🐗','🦌','🐎','🦂'] },
  ],
  freeEmojis: ['🔥','🙌','⚔️','👍','😂'],
  // “Seal” = the unique term for pin. Anyone can seal a message with Stars.
  seal: { term: 'Ember-Seal', price: 60 },
  // Relic packs — admin edits price + per-rarity drop rates (must sum ~100).
  packs: [
    { id: 'kindling', name: 'Kindling Pack', price: 100, glow: '#ff9f45',
      rates: { Common: 62, Rare: 26, Epic: 9, Legendary: 2.5, Cursed: 0.5 } },
    { id: 'wildfire', name: 'Wildfire Pack', price: 350, glow: '#c39bff',
      rates: { Common: 40, Rare: 33, Epic: 18, Legendary: 7, Cursed: 2 } },
    { id: 'inferno',  name: 'Inferno Pack',  price: 900, glow: '#ff5a3c',
      rates: { Common: 18, Rare: 30, Epic: 30, Legendary: 16, Cursed: 6 } },
  ],
  // Relic catalog — admin can add relics, set buffs, category, art (svg glyph).
  relics: [
    { id: 'emberheart', name: 'Emberheart', rarity: 'Legendary', category: 'Blessed', glyph: 'flame', tone: '#ffb03a', buff: 'Ash pools +25%' },
    { id: 'ashfang',    name: 'Ashfang',    rarity: 'Epic',      category: 'Blessed', glyph: 'bolt',  tone: '#c39bff', buff: 'War points +15%' },
    { id: 'stonesigil', name: 'Stone Sigil',rarity: 'Rare',      category: 'Blessed', glyph: 'shield',tone: '#7cc4ff', buff: 'Loyalty +10%' },
    { id: 'gravebrand', name: 'Gravebrand', rarity: 'Cursed',    category: 'Cursed',  glyph: 'skull', tone: '#8b5cf6', buff: '+40% Ash, -10% loyalty' },
    { id: 'kinspark',   name: 'Kinspark',   rarity: 'Common',    category: 'Blessed', glyph: 'spark', tone: '#5ce39a', buff: 'Daily +5% Ember' },
  ],
  // Kiva message relics (buffs). Chief gets the flagship free.
  kivaBuffs: [
    { id: 'heralds-voice', name: "Herald's Voice", desc: 'Your messages glow gold & never fade', price: 0, chiefFree: true, tone: '#ffd27a' },
    { id: 'echo-stone',    name: 'Echo Stone',     desc: 'Retain the last 500 messages for the tribe', price: 250, tone: '#7cc4ff' },
    { id: 'ember-ink',     name: 'Ember Ink',      desc: 'Animated ember trail on your text', price: 150, tone: '#ff9f45' },
    { id: 'whisper-veil',  name: 'Whisper Veil',   desc: 'Send one anonymous message per day', price: 180, tone: '#c39bff' },
  ],
};

function read() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    return saved ? deepMerge(structuredClone(DEFAULT_CFG), saved) : structuredClone(DEFAULT_CFG);
  } catch (e) { return structuredClone(DEFAULT_CFG); }
}
function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) base[k] = deepMerge(base[k] || {}, over[k]);
    else base[k] = over[k];
  }
  return base;
}

export const useConfig = create((set, get) => ({
  cfg: read(),
  update(mutator) {
    const cfg = structuredClone(get().cfg);
    mutator(cfg);
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
    set({ cfg });
  },
  reset() { try { localStorage.removeItem(KEY); } catch (e) {} set({ cfg: structuredClone(DEFAULT_CFG) }); },
}));
