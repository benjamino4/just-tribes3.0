// ═════════════════════════════════════════════════════
// Reply moderation — a simple, offline AI-style filter.
//
// Runs BEFORE a reply ever reaches the admin moderation queue. If it trips the
// filter it is "rejected silently": stored (so the one-per-day slot is spent)
// but never shown to the admin and never featured. The writer can't tell — to
// them it just looks sent-and-private, which is exactly the intended behaviour.
//
// Two things get a reply dropped:
//   1. Any URL / link / contact handle / email (keeps replies on-topic, no spam)
//   2. A slur / hard-blocked term (normalised so l33t-speak and padding fail)
// ═════════════════════════════════════════════════════

// Anything that looks like a link, domain, @handle, or email address.
const LINK_RE =
  /(https?:\/\/|www\.|t\.me\/|telegram\.me\/|@[a-z0-9_]{3,}|[a-z0-9-]+\.(?:com|net|org|io|xyz|co|me|app|dev|gg|ru|info|biz|link|site|online|shop|tg)\b|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b)/i;

// Hard-blocked terms. Deliberately compact; matched against a normalised copy
// of the text (lowercased, leet-folded, repeats collapsed, non-letters removed)
// so "f.u.c.k", "fuuuck", "f\u00fcck" and "f0ck" all reduce to the same stem.
const BLOCK_STEMS = [
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'kike', 'spic', 'chink',
  'wetback', 'tranny', 'coon', 'dyke', 'paki', 'gook', 'cunt',
];

// Fold confusable characters / leetspeak to their plain letter.
const LEET = {
  '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a',
  '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g',
};

function normalize(text) {
  let s = String(text || '').toLowerCase();
  // strip accents
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  // fold leetspeak
  s = s.replace(/[01!34@5$789]/g, (c) => LEET[c] || c);
  // drop every non-letter (so padding like f.u.c.k / f u c k collapses)
  s = s.replace(/[^a-z]/g, '');
  // collapse 3+ repeats to a single letter (fuuuck -> fuck-ish)
  s = s.replace(/(.)\1{2,}/g, '$1');
  return s;
}

// Returns { clean, reason }. reason is for logs only — never shown to the user.
export function moderateReply(text) {
  const raw = String(text || '');
  if (LINK_RE.test(raw)) return { clean: false, reason: 'link' };

  const norm = normalize(raw);
  for (const stem of BLOCK_STEMS) {
    const folded = normalize(stem);
    if (folded && norm.includes(folded)) return { clean: false, reason: 'slur' };
  }
  return { clean: true, reason: null };
}
