// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/help.js
// PURPOSE: Help article definitions. Admin can add/edit via bot.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
const ARTICLES = [
  { slug: 'basics', section: 'Basics', title: 'What is TRIBES?',
    body: 'TRIBES is a stone-age tribe game. You feed a personal fire, belong to a tribe, and fight other players in 1v1 mini-games. Sparks are earned by playing. Kinship is earned by winning. Stars are bought with real money.' },
  { slug: 'hearth', section: 'Hearth', title: 'The Hearth',
    body: 'Your Hearth is your fire. Feed it once a day to keep it alive. The fire grows with your streak — miss a day and it drops. Above the fire is the button that feeds it. Below are your daily tasks and the Arena.' },
  { slug: 'arena', section: 'Arena', title: 'The Arena',
    body: 'The Arena is where you fight. Ranked matches are free and give Kinship. Staked matches cost Sparks. Wars are tribe vs. tribe, 5 minutes long, fought in three fronts.' },
  { slug: 'forgotten', section: 'Arena', title: 'The Forgotten Ones',
    body: 'Some fighters bear a small carved rune. They are the Forgotten — those who stayed when others left. They fill the ranks of every tribe that is not yet full. They fight on the front lines. They climb the ladder. They remember every match.' },
  { slug: 'rank', section: 'Arena', title: 'Rank Tiers',
    body: 'Your rank starts at Bone. Win matches to climb: Flint, Stone, Jade, Copper, Silver, Gold, Obsidian, Eternal. Every Sunday at 20:00 UTC the top six ranks in a tribe earn named seats.' },
  { slug: 'games', section: 'Arena', title: 'The Games',
    body: 'Twelve games rotate. Rune Match, Stone Stack, Fireflies, Rite of Hands, Ember Flow, Stone Sort, Bid or Fold, Three Masks, Chain of Fire, Ember Cascade, Rune Line, Rune Bloom. Each takes 30-90 seconds.' },
  { slug: 'tribe', section: 'Tribe', title: 'The Tribe',
    body: 'A tribe has 7 named seats and a roster. Rank determines seats — recalculated every Sunday. The Kiva is chat. The Pyre is the shared treasury.' },
  { slug: 'vault', section: 'Vault', title: 'Relics',
    body: 'You have three relic slots: Flame (economy), Blade (combat), Voice (tribe). Every relic does one thing. Equip one per category.' },
  { slug: 'referrals', section: 'Store', title: 'Inviting Kin',
    body: 'Invite friends from the Referral Altar. You earn Sparks and Kinship for every soul you bring. Climb five tiers: Tribe Maker, Banner Bearer, Firebringer, Warbringer, Eternal Inviter.' },
  { slug: 'store', section: 'Store', title: 'The Store',
    body: 'Spend Stars on relic caches, cosmetics and tribe branding. Stars are bought with real money through Telegram.' },
  { slug: 'rules', section: 'Rules', title: 'Fair Play',
    body: 'All scores are verified on the server. Any attempt to manipulate scores or currency will result in a permanent ban.' }
];

export function list() { return ARTICLES; }
export function get(slug) { return ARTICLES.find((a) => a.slug === slug) || null; }