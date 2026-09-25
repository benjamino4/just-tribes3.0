# Spin Wheel Art

The Daily Spin uses a **spinning ember-stone** with 12 pockets around a
circular path. Pockets light up as the stone passes them.

## Files the client expects (optional — falls back to SVG)
- `stone-base.webp`      — 256×256, the spinning stone itself
- `pocket-ember.png`     — 64×64, small emblem inside each pocket
- `pocket-loyalty.png`
- `pocket-stars.png`
- `pocket-relic.png`
- `pocket-empty.png`     — shown when a pocket has no prize

## Physics (fixed, not art-configurable)
- Stone spin velocity decays via air-drag per frame
- Micro-jitter (±3°) at rest
- Haptic tick per pocket pass
- Total spin ~2.6s

## Drop table (set in admin)
Admin decides:
- which pocket index holds which reward
- the weight of each reward
- max paid spins per day
- price per extra spin (Stars)

Weights are drawn **before** the spin starts — the animation lands on the
pre-chosen result. The stone travel is deterministic from a seeded random,
so replaying the same spin id gives the same landing (audit-safe).