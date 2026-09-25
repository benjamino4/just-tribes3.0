# Badge Art

Drop badge art here. Every badge is referenced by its **slug** (lowercase, underscores).

## Rules
- **Format:** SVG preferred. If raster, WebP with transparent background.
- **Size:** SVG any. Raster: 256×256 recommended, 512×512 max.
- **Naming:** `<slug>.svg` or `<slug>.webp` — lowercase, no spaces.
- **Style:** Monochrome silhouettes work best. Colour badges are fine but
  should stay in the ember / gold / blood / jade palette. Avoid gradients
  that clash with the surface behind them.

## Default slugs (safe to overwrite)
- `firekeeper.svg`     — 7-day streak
- `warlord.svg`        — 3 war wins
- `founder.svg`        — founded a tribe
- `hoarder.svg`        — 100k Ember
- `legend.svg`         — top-3 season finish
- `shadow.svg`         — 10 war actions
- `crown.svg`          — tribe reached Kingdom level
- `flame.svg`          — 30-day streak

## Adding a new badge via admin
1. Drop the file here with a slug name.
2. In the Warden → Badges section, create a badge with the same slug.
3. Assign unlock conditions (tribe wins, ember threshold, etc).

Missing file → the app falls back to the closest built-in badge SVG.