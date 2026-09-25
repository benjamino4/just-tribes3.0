# Relic Art

Every admin-created relic points at a file in this folder.

## Rules
- **Format:** WebP (transparent) or SVG. PNG acceptable but heavier.
- **Size:** 256×256 recommended. Displayed at 48–88 px.
- **Style:** Object on a warm stone background reads best. Relics sit inside
  a hexagonal frame in the store — keep the object centered with ~10% padding.
- **Naming:** `<slug>.webp` — lowercase, hyphens or underscores.

## Buff types (chosen in admin)
- `ember_mult`       — multiplies all Ember gains (e.g. 1.10 = +10%)
- `loyalty_mult`     — multiplies Loyalty gains
- `ash_cap`          — adds to Ash cap
- `offline_hours`    — extends offline accumulation
- `war_points_mult`  — multiplies your war action points
- `checkin_mult`     — multiplies daily check-in reward
- `trial_cooldown_mult` — reduces trial cooldowns
- `spin_extra`       — extra free daily spins

Buffs of the same type stack additively (multipliers compound) — cap is
enforced server-side, max 5.0× total per buff type.

## Default relics (safe to overwrite)
- `firestone.webp`
- `moonshard.webp`
- `sundisc.webp`
- `boneidol.webp`

## Adding a new relic via admin
1. Drop `<slug>.webp` here.
2. Warden → Relics → New. Enter the slug, name, description, buff type, value.
3. Set price in Stars or drop-chance from the Spin table.