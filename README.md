# TRIBES — Rise of the Tribes (v3, rebuilt)

A Telegram Mini App: stone-age tribe / settlement idle game with live Tribe
Wars, TON Connect and Telegram Stars. This is a ground-up rebuild that
**retains the original game concept and terminology** while introducing a new
fluid, tactile UI inspired by iOS 26/27 liquid glass, HarmonyOS depth layering
and OxygenOS geometry.

## Architecture (hybrid: React + vanilla)

```
tribes/
  server/        Node + Express + Postgres backend (game brain / economy / wars)
    src/         auth, routes, war, relics, council, spies, admin, push, ton…
    migrations/  Postgres migrations (run once with MIGRATE=1)
    public/      ← built frontend lands here (git-ignored build artifact)
  web/           Vite + React frontend (the new UI)
    src/
      styles/    design system — tokens.css (Ember Glass), components.css
      components/ Campfire (pure SVG+CSS), TabBar, Sheet, Toast, UI primitives…
      screens/   Fire, Tribe, Ranks, Lands, Store
      lib/       api client, Telegram SDK wrapper, formatting
    public/      admin panel + static assets copied verbatim into the build
  render.yaml    one-click Render blueprint (single web service)
```

**Why hybrid:** React drives the app shell, routing, state and all interactive
UI (sheets, lists, forms, live war). The living art layer — campfire, embers,
aurora — stays framework-free SVG + CSS so it renders cheaply and smoothly,
with a `data-fx="reduced"` tier that automatically trims blur/particles on
low-end phones.

## Concept preserved

- **Ember** = soft currency · **Ash** = idle pool that converts to Ember.
- **The Great Pyre** = tribe treasury; feeding it is “Stoke the Pyre”.
- Roles: Toddler → Kin → Hunter → Elder → Head → Chief.
- Screens: **Fire** (home), **Tribe**, **Ranks**, **Lands**, **Sky/Store**.
- Settlement evolves Village → Town → Dynasty → Empire → Kingdom.
- Tribe Wars, Relic NFTs, Path of Fire battle pass, airdrop share, TON Connect.

## Run locally

Two terminals:
```bash
# 1) backend (needs DATABASE_URL + BOT_TOKEN; set ALLOW_GUEST=1 to play without Telegram)
cd server && npm install && npm start

# 2) frontend dev server (proxies /api to :3000, hot reload)
cd web && npm install && npm run dev   # open http://localhost:5173
```
The UI also renders with a built-in demo state if the API isn't reachable yet,
so you can preview the design immediately.

### One-command production preview
```bash
npm run build   # builds web/ into server/public
npm start       # serves API + SPA from the Express server on :3000
```

## Deploy on Render

1. Push this folder to a GitHub/GitLab repo.
2. Render → **New +** → **Blueprint** → pick the repo (uses `render.yaml`), or
   create a **Web Service** with Build Command `npm run build` and Start Command
   `npm start`.
3. Add env vars (see `server/.env.example`): `DATABASE_URL`, `BOT_TOKEN`,
   `ADMIN_TOKEN`, and optionally TON / admin vars.
4. First deploy only: set `MIGRATE=1` to run migrations, then remove it.
5. In **@BotFather** → your bot → *Web App* → paste the Render HTTPS URL.

## Status / roadmap

- **Done (this phase):** full design system + app shell + fluid navigation,
  Fire (home) screen wired to the live API with optimistic updates, and
  first-pass Tribe / Ranks / Lands / Store screens.
- **Next:** deepen Tribe (Pyre donate, war actions, kin chat), full Ranks &
  leaderboards, Lands upgrades, Store invoices + TON Connect, and a rebuilt
  admin control room.

The backend API, migrations, webhooks and env contract are unchanged, so the
new frontend drops onto the existing server and database.
