const ARTICLES = [
  {
    slug: 'basics', section: 'Basics', title: 'What is TRIBES?',
    body: 'TRIBES is a stone-age tribe game. You feed a personal fire, belong to a tribe, and fight other players in 1v1 mini-games. Sparks are earned by playing. Kinship is earned by winning. Stars are bought with real money.'
  },
  {
    slug: 'hearth', section: 'Hearth', title: 'The Hearth',
    body: 'Your Hearth is your fire. Feed it once a day to keep it alive. The fire grows with your streak — miss a day and it drops. Above the fire is the button that feeds it. Below are your daily tasks and the Arena.'
  },
  {
    slug: 'arena', section: 'Arena', title: 'The Arena',
    body: 'The Arena is where you fight. Ranked matches are free and give Kinship. Staked matches cost Sparks. Wars are tribe vs. tribe, 30 minutes long, fought in three fronts.'
  },
  { slug: 'game-reflex',   section: 'Games', title: 'Ember Reflex',   body: 'Tap the fire as soon as it lights. You get 5 rounds. Faster taps = higher score.' },
  { slug: 'game-cascade',  section: 'Games', title: 'Cascade',        body: 'Tap the lights in the order they appeared. Wrong tap = round restart.' },
  { slug: 'game-ancestor', section: 'Games', title: 'Ancestor Memory',body: 'Repeat the emoji sequence the totem speaks. Longer sequences = more points.' },
  { slug: 'game-rune',     section: 'Games', title: 'Missing Rune',   body: 'A ring of runes pulses. One is removed. Name the missing one.' },
  { slug: 'game-hands',    section: 'Games', title: 'Rite of Hands',  body: 'Rock-paper-scissors, best of 5. You see the opponent\'s last 5 moves.' },
  { slug: 'game-bid',      section: 'Games', title: 'Bid or Fold',    body: 'Both bid 0-3 coins. Higher wins the pot but loses their bid. First to 5.' },
  { slug: 'game-chain',    section: 'Games', title: 'Chain of Fire',  body: 'Add a torch that connects to the last. Cannot move = lose.' },
  { slug: 'game-masks',    section: 'Games', title: 'Three Masks',    body: 'Opponent wears WAR, TRICK or GUARD. Pick ATTACK, WAIT or FLEE. Best of 3.' },
  {
    slug: 'tribe', section: 'Tribe', title: 'The Tribe',
    body: 'A tribe has 7 named seats and a roster. Rank determines seats — recalculated every Sunday. The Kiva is chat. The Pyre is the shared treasury.'
  },
  {
    slug: 'rank', section: 'Tribe', title: 'Rank',
    body: 'Your rank starts at 1000. Win matches to raise it. Lose matches and it drops. Every Sunday at 20:00 UTC the top six ranks get named seats.'
  },
  {
    slug: 'vault', section: 'Vault', title: 'Relics',
    body: 'You have three relic slots: Flame (economy), Blade (combat), Voice (tribe). Every relic does one thing. Equip one per category.'
  },
  {
    slug: 'store', section: 'Store', title: 'The Store',
    body: 'Spend Stars on relic caches, cosmetics and tribe branding. Stars are bought with real money through Telegram.'
  },
  {
    slug: 'rules', section: 'Rules', title: 'Fair Play',
    body: 'All scores are verified on the server. Any attempt to manipulate scores or currency will result in a permanent ban.'
  }
];

export function list() {
  return ARTICLES;
}

export function get(slug) {
  return ARTICLES.find((a) => a.slug === slug) || null;
}