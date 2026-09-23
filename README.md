# TRIBES — Rise of the Tribes

A Telegram Mini App (frontend prototype) for a Stone-Age tribe / settlement idle game.
Everything is drawn in **SVG + CSS only — no image files anywhere**. Fonts: Inter (UI) + Cinzel (headings).

## What's inside
- `index.html` — shell, Tailwind CDN, Telegram WebApp SDK, reusable SVG defs
- `styles.css` — all animations (aurora, breathing fire, rising embers, glow sweeps, shimmer buttons, flowing bars, cascading transitions, kinetic nav)
- `app.js` — game state (localStorage), 5 screens, modals, mock economy, 40 unique tribes each with its own themed interface
- `admin.html` + `admin.js` — password-protected **live economy control room** (DRAFT — see security note)

## Screens & features
- **Fire (home):** campfire, Feed the Fire check-in + streak dial, streak milestone rewards, idle "Gather the Ash" (pools every 30 min, upgradable), daily quests, Cave Wall.
- **Tribe:** overview + **The Great Pyre** treasury (real-time donate/"Stoke"), live Tribe War, key figures, top contributors, roster w/ online status, Cave Wall edit (Head/Chief), War Cry, Chief vote + recall, mentorship, kin chat, found/join a band.
- **Ranks:** world tribe leaderboard (loyalty per member = airdrop share) + kin Ember leaderboard, your rank highlighted, share card.
- **Lands:** settlement evolving through Village → Town → Dynasty → Empire → Kingdom, settlement upgrade (spends Pyre), land expansion (Stars), tribe upgrades (Hearth/Well/Watchtower/Forge).
- **Sky/Store:** Path of Fire battle pass, Star packs, tools (Torch/Totem/Charm/Horn/Eternal Flame auto-collect), on-chain **Relic NFTs**, airdrop estimate + claim.
- **Wallet:** TON Connect flow (Tonkeeper / TON Space / MyTonWallet / Wallet-in-Telegram) — stubbed.
- Telegram **story/share cards** for streaks, ranks, roles, relics.

## Terminology chosen
- **Ember** = soft currency. **Ash** = idle pool that converts to Ember on collect.
- **The Great Pyre** = tribe treasury; feeding it is "Stoke the Pyre".
- Roles: Toddler → Kin → Hunter → Elder → Head → Chief (elected/recallable).

## Run locally
```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy on Render
1. Push this folder to a GitHub/GitLab repo.
2. Render → **New +** → **Static Site** → pick the repo.
3. Build Command: *(leave empty)*  ·  Publish Directory: `.`
4. Deploy — you get an HTTPS URL.
5. In **@BotFather** → your bot → *Bot Settings → Menu Button / Web App* → paste the HTTPS URL.

(A `render.yaml` blueprint is included if you prefer one-click Blueprint deploy.)

## Admin economy panel
- Open `admin.html` (draft password: `firekeeper`). Edit Ash rate, founding cost, quest rewards, store & relic prices, Star pack amounts, upgrade base costs, and rotating slogans.
- **Save · Go live** writes to the same store the game reads on launch (`localStorage “tribes.econ”`); **Reset** clears overrides back to defaults.
- ⚠ The password gate is **client-side only** and is NOT secure. Before launch, move it behind real server-side auth and push economy edits through an authenticated API.

## Wiring the real backend later
- **Stars:** replace the stubbed `buyPack/buyStars` with a server that creates an invoice, then `Telegram.WebApp.openInvoice(url, cb)`.
- **TON Connect:** add `@tonconnect/ui`, host a `tonconnect-manifest.json`, replace `connectWallet()` with the real `tonConnectUI` status callback.
- **Economy/anti-cheat:** move Ember accrual, streaks, Pyre and leaderboards server-side (client values here are for demo only).
- **Admin panel:** a draft is included (`admin.html`/`admin.js`) with a client-side gate. Move it behind a real password-protected route/service with server-side auth before launch.
