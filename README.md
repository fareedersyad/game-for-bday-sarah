# A World Made Just For Her
### The Princess & Her Royal Companion

> *"Di dalam dunia yang luas ini, ada satu dunia kecil yang dicipta hanya untuk awak."*

An interactive, story-driven romantic fantasy birthday adventure that runs in the browser. She is crowned as a Princess, receives her first bouquet, unlocks her own castle, reads a love letter, and then explores a connected open world with her **Royal Companion**, who walks beside her the whole way. The adventure ends with a fireworks finale and a secret room.

Built with **React + TypeScript + Vite + Three.js / React Three Fiber**, and deployed as a static site on **GitHub Pages**.

---

## Contents
1. [What's inside](#whats-inside)
2. [Quick start](#quick-start)
3. [Personalise it (no code changes)](#personalise-it)
4. [Deploy to GitHub Pages](#deploy-to-github-pages)
5. [Updating the website](#updating-the-website)
6. [Saving, resuming & backups](#saving-resuming--backups)
7. [Optional: AI-powered free chat](#optional-ai-powered-free-chat)
7. [Controls](#controls)
8. [Testing](#testing)
9. [Project structure & architecture](#project-structure--architecture)
10. [Device compatibility & performance](#device-compatibility--performance)
11. [Troubleshooting](#troubleshooting)
12. [Licensing & assets](#licensing--assets)

---

## What's inside

**Story (in order)**
| Chapter | What happens |
|---|---|
| 0 — The Royal Invitation | Cinematic opening over the royal garden, then **Enter Your Kingdom**. |
| 1 — The Coronation | She walks up to the rose-gold crown and chooses **Accept My Crown**. The crown floats up, the camera follows it, and it settles on her hijab. Flowers bloom, her companion appears, and her royal identity card is shown. |
| 2 — The First Gift | A bouquet of pink roses and white tulips is waiting at the flower display. |
| 3 — The Secret Royal Castle | The magical gate opens to reveal the castle, followed by the **Enter My Castle** button. |
| 4 — The Love Letter | A sealed envelope on the bedside table, with envelope animation, handwriting reveal, and paper texture. |
| Open world | Garden of Her Dreams · Magical Mirror · Dream Library · Future Lawyer Courtroom · Children's Wonderland · Stormy Forest (*Finding My Shelter*) |
| Finale | Fireworks Celebration Hill, which unlocks after all six adventures, ending with **One Last Surprise**. |
| Optional | **Sarah's Strawberry Garden** (next to the Garden of Her Dreams): pick 5 ripe strawberries in *The Sweetest Little Harvest*, then sit for a picnic with Prince Fareed in the sage-green gazebo. It never blocks the main story. |
| Epilogue | The Secret Room: Fareed reveals a **heart-shaped birthday cake**, she makes a wish (**Make a Birthday Wish**) and blows out the candles (**Blow the Candles**), fireworks light up the window and the kingdom, and then the final letter and credits follow. |

**Systems:** a third-person 3D world with collision · a **permanent companion** with A* pathfinding, formation following, obstacle avoidance, stuck recovery, door transitions, and sitting with her when she lingers · a contextual dialogue engine that remembers past conversations · a quest journal (ID, name, description, location, objectives, rewards, and locked/active/completed states) · inventory and flower collection · a world map with fast travel · procedural music and sound · autosave to `localStorage` · settings · mobile touch controls · a **2D Storybook Mode** fallback for devices without WebGL.

---

## Quick start

Requirements: **Node.js 20+** (22 LTS recommended) and npm.

```bash
npm install          # install dependencies
npm run dev          # start the dev server → http://localhost:5173
```

Other scripts:

```bash
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
npm test             # unit tests (world, collision, pathfinding, companion, quests, dialogue)
npm run typecheck    # TypeScript only
```

To open the dev server on your phone over the same Wi-Fi, use the "Network" URL that Vite prints.

---

## Personalise it

You never need to touch game logic. **Every text she sees lives in one file:**
[`src/config/personalContent.ts`](src/config/personalContent.ts) — names, birthday,
letters, messages, dialogue (Fareed, Sarah and every NPC), quests, items,
locations, banners, notifications, buttons and credits.

👉 Beginner guide (Bahasa Melayu): **[PERSONAL_CONTENT_GUIDE.md](PERSONAL_CONTENT_GUIDE.md)**

| Section in the file | What |
|---|---|
| `1. NAMA` | `HER_NAME` (`'Sarah'`), `YOUR_NAME` (`'Fareed'`), nicknames, `BIRTHDAY_DATE`, speaker names |
| `2.`–`4.` | Royal title, opening, love letter, final message, final secret letter, gift, memory stars, books, per-location messages, cake, credits |
| `6. DIALOG` | Every scene, idle comment, "Talk to him" topic and offline free-chat reply |
| `7.`–`9.` | Quest titles/descriptions/objectives/hints, items, locations |
| `10.`–`11.` | Story banners, notifications, action prompts, all screen/menu/button text |

`gameConfig.ts`, `dialogueConfig.ts` and `questConfig.ts` now only combine this text
with gameplay numbers and logic. Tokens `{HER_NAME}`, `{HER_NICKNAME}`, `{YOUR_NAME}`
and `{YOUR_NICKNAME}` are replaced automatically; paragraphs are separated by `

`.

After an intentional text edit run `npm run content:accept` (updates the content
snapshot that protects against accidentally lost sentences), then `npm run dev` to preview.

> **Tip:** her character's colours (gown, hijab, crown gems) can also be changed in-game from the Royal Vanity in the Mirror Room, or from **Profile → Almari Diraja**.

---

## Deploy to GitHub Pages

The repository includes `.github/workflows/deploy.yml`. Every push to `main` installs dependencies, runs the unit tests, builds with the correct base path, and publishes to GitHub Pages.

### 1. Create the repository
1. Go to <https://github.com/new>.
2. Name it, for example `A-World-Made-Just-For-Her`. Choose **Private** if you like; GitHub Pages works with private repos on paid plans, otherwise use **Public**.
3. Don't add a README or .gitignore. They already exist here.

### 2. Push the source code
From this project folder:

```bash
git init
git add .
git commit -m "A World Made Just For Her"
git branch -M main
git remote add origin https://github.com/<your-username>/A-World-Made-Just-For-Her.git
git push -u origin main
```

### 3. Enable GitHub Pages
1. Open the repository on GitHub, then go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

### 4. Watch it deploy
Open the **Actions** tab. The *Deploy to GitHub Pages* workflow runs automatically. It also runs on every push, and you can start it manually with **Run workflow**. When it finishes, the site is live at:

```
https://<your-username>.github.io/game-for-bday-sarah/
```

**About the base path:** the workflow computes it from the repository name (`/<repo>/`, or `/` for a `<username>.github.io` repository), so assets load correctly from the sub-folder. The app uses `HashRouter` (URLs look like `…/#/`), so refreshing never causes a 404.

---

## Updating the website

```bash
# edit src/config/*.ts (or anything else)
npm run dev                 # check locally
git add .
git commit -m "Update messages"
git push                    # GitHub Actions rebuilds and redeploys (~1–2 min)
```

Her progress is saved in her browser (`localStorage`), so new deployments don't erase it. See [Saving, resuming & backups](#saving-resuming--backups).

---

## Saving, resuming & backups

**Where:** only in the browser she plays in (`localStorage`, key `awmjfh.progress.v1`; settings in `awmjfh.settings.v1`). There is **no account and no cross-device sync**. Progress on her phone and on a laptop are separate unless you move it with Export and Import.

**Autosave:** every story event that changes progress is saved automatically. That includes quests, the crown, bouquet, castle, letter, items, flowers planted and watered, strawberries, locations, the Secret Room, dialogue milestones and the birthday candles. Writes are combined into one save about 0.35 s after a change, and flushed immediately when the tab is hidden or closed. Her position is saved at most every 4 seconds while she moves, and storage is never written every frame. Settings are saved when changed.

**Save indicator:** a small icon at the top right shows *Menyimpan…* (saving), *Kemajuan disimpan* (saved) or *Gagal menyimpan* (failed). It is driven by the real write result, and on phones it shows the icon only so it never covers the controls.

**Resume:** opening the site again detects the save, validates it, and offers **Sambung pengembaraan** with the time it was last saved. Continuing restores her quests, unlocked areas, inventory, strawberries, flowers, story flags and settings. She returns to her last checkpoint with Prince Fareed beside her. One-time cinematics that already played are not replayed.

**Safety:**
- The save has a schema version, and older saves are migrated automatically.
- Every field is validated on load. A missing or broken field is repaired with its default; a valid save is never thrown away because one field is missing.
- If the save is unreadable (for example, corrupted), the raw data is kept under `awmjfh.progress.corrupt` and the last automatic backup is restored. The title screen tells her this happened.
- An automatic backup (`awmjfh.progress.backup`) is taken at the start of each session and before every reset, import or restore.
- If storage is full or blocked, the game keeps running, shows *Gagal menyimpan*, and retries on the next save. In private browsing it shows a notice that progress will not survive closing the tab.

**Settings › Simpanan & sandaran:**
- **Eksport simpanan** downloads `kerajaan-<name>-<date>.json`. It contains only game progress and game settings, never cookies, browser data or personal details.
- **Import simpanan** checks the file (format, game, schema version, every field), shows what it contains and asks for confirmation before replacing anything. The current progress is backed up first, and invalid files are rejected with a message without changing anything.
- **Pulihkan sandaran automatik** restores the automatic backup, after confirmation.
- **Padam kemajuan & mula semula** explains that it resets progress in this browser only, asks for confirmation, and keeps a restorable backup.

**If browser data is cleared** ("Clear site data", or uninstalling the browser), the save and its backups are deleted with it, because they live only in that browser. Export a backup file first if the progress matters.

---

## Optional: AI-powered free chat (Google Gemini)

By default the companion uses a **built-in offline dialogue engine** — no account or key needed.

To let Prince Fareed answer **Sembang bebas** with Google Gemini, deploy the Cloudflare
Worker in [`proxy/`](proxy/README.md) (step-by-step **Cloudflare Dashboard** guide inside).
The Gemini API key is stored only as the Worker secret `GEMINI_API_KEY` — never in the
website, never in GitHub. Then add the repository *variable* `VITE_AI_PROXY_URL` (the
public Worker URL) under **Settings → Secrets and variables → Actions → Variables**.

- The conversation is remembered in her browser (`awmjfh.chat.v1`, separate from the save system) and can be cleared from the chat.
- If the Worker or Gemini is unreachable, Fareed answers offline and shows a small notice.
- ⚠️ Read the **Privasi** section in `proxy/README.md` first: on the Gemini Free Tier, prompts may be reviewed by humans.

See `.env.example` for local development.

---

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Move | **WASD** / arrow keys (hold **Shift** to run) | Left virtual joystick (push fully to run) |
| Camera | Drag with the mouse · scroll wheel to zoom | Drag the screen · pinch to zoom |
| Interact | **E** (or click the prompt) | Gold **Interact** button (or tap the prompt) |
| Talk to him | **E** when near him, or the prompt | Pink heart button |
| Dialogue | Click, **Space**, **Enter**, or **E** | Tap the dialogue box or **Next** |
| Pause / menu | **Esc** | ☰ button |
| Journal / Map / Inventory | **J** / **M** / **I** | Top-right buttons |

A physical keyboard is never required.

---

## Testing

**Unit tests** (`npm test`, Vitest) cover the core systems, which are pure TypeScript:
- the world layout: every interactable is reachable once its gates open, story gates really block progress, and spawn, door, and seat positions are valid
- collision (push-out, no tunnelling, bounds)
- A* navigation (paths around walls, unreachable goals)
- the companion follower: follows without clipping, A* through buildings, recovery after fast travel, walking in through doors instead of teleporting, scripted movement
- quest logic (status, auto-completion safety net, gate unlocking, no cycles)
- the save system (`src/test/save.test.ts`): validation and repair, v1 to v2 migration, rejecting newer schemas, corrupted-save recovery from backup, quarantine of damaged data, combined writes, the indicator states, storage-full retry and failure, export and import round-trip and rejections, reset backups, and settings sanitising
- the Strawberry Garden and birthday cake (`src/test/celebrations.test.ts`): collecting all five strawberries, no duplicates, inventory and save/restore, picnic unlocking, cake reveal conditions, wish and candles completing exactly once, and Prince Fareed following through the garden, sitting at the picnic and joining her at the cake
- the dialogue engine (unheard lines first, reactions, hints with progress, memories, keyword chat)

**End-to-end playthrough** (`scripts/e2e.mjs`, real Chrome with WebGL via Playwright):

```bash
npm run build:pages   # build with the GitHub Pages sub-path
npm run e2e           # uses your installed Chrome/Edge; set CHROME_PATH to override
```

It serves the build under `/game-for-bday-sarah/` exactly like GitHub Pages and plays the **entire story** from the title screen to the credits. It checks every milestone (including the strawberry harvest, picnic, birthday cake, wish and candles, and that re-entering the Secret Room does not replay the ending), keyboard movement, companion following, persistence after reload, the phone viewport with a real touch joystick, and the 2D Storybook fallback. It also checks for console errors and failed asset requests, and saves screenshots to `e2e-screenshots/`.

---

## Project structure & architecture

```
src/
  config/            personalContent.ts ← ALL text · gameConfig.ts · dialogueConfig.ts · questConfig.ts
  systems/           renderer-agnostic game core (pure TypeScript, unit-tested)
    WorldManager/      worldLayout.ts (single source of truth for geometry), locations, types
    PlayerController/  collision.ts (spatial-hashed circle/box collision)
    CompanionNavigation/ navGrid.ts (occupancy grid + A* + path smoothing)
    CompanionController/ companionController.ts (follow / goto / sit / door arrival / recovery)
    QuestManager/      questManager.ts (quests derived purely from save data)
    DialogueManager/   dialogueEngine.ts (offline) · remoteAI.ts (Gemini proxy client) · chatHistory.ts
    AudioManager/      audioEngine.ts (procedural WebAudio) · audioDirector.ts
    SaveManager/       safeStorage.ts (localStorage with private-mode fallback)
    Story/             cutscene.ts (skippable async scripts) · story.ts (every chapter & interaction)
    GameLoop/          game.ts (simulation step, zones, prompts, triggers, transitions)
  stores/            zustand: gameStore (persisted progress) · settingsStore · uiStore · worldStore
  scenes/            3D locations: Coronation, Castle (exterior/interior), Garden, Mirror, Library,
                     Courtroom, Children, Storm, Fireworks, SecretRoom
  components/
    game/            Canvas, camera rig, characters, terrain, vegetation, effects, markers, batching
    fallback/        World2D.tsx (Storybook Mode)
    ui/ dialogue/ quests/ inventory/ navigation/ overlays/ menus/
proxy/               optional Cloudflare Worker → Google Gemini (server-side key, worker-dashboard.js to paste)
scripts/e2e.mjs      end-to-end playthrough
.github/workflows/deploy.yml
```

Key design decisions:
- **One simulation, two renderers.** `game.step(dt)` runs movement, the companion, zones, prompts, and story triggers. The 3D world (React Three Fiber) and the 2D fallback both just draw it.
- **The layout is data.** `worldLayout.ts` defines colliders, zones, interactables, seats, doors, and paths. Rendering, collision, the navigation grid, the map, and the tests all read it, so what you see is what you collide with.
- **Cutscenes are async scripts.** When one is skipped, every helper becomes a no-op and the script fast-forwards, so the world always ends in the correct state. A background safety net also completes any quest whose objectives are already met.
- **Mobile performance.** Static scenery is merged per material (`StaticBatch`), foliage is instanced, distant set-pieces are culled, and particle counts and shadows scale with the quality tier.

---

## Device compatibility & performance

Designed for iPhone, Android phones, iPad/Android tablets, Windows and Mac laptops, and desktops, in Safari, Chrome, Firefox, and Edge:
- **iOS viewport:** uses `100dvh` with a JavaScript `--app-height` fallback, plus `viewport-fit=cover` and safe-area insets.
- **Touch:** Pointer Events with pointer capture (multi-touch joystick and camera drag), no hover-only interactions, and no double-tap zoom.
- **Audio:** created only after a user gesture, a silent-buffer unlock for iOS, and suspend/resume on tab switches.
- **WebGL:** checked at startup. Software renderers get the low quality tier. If WebGL is missing or the context is lost, the game switches to **Storybook Mode (2D)**, which can also be chosen in Settings.
- **Storage:** if `localStorage` is unavailable (for example Safari private mode), the game keeps running in memory and shows a notice.
- **Quality tiers:** Auto / Low / Medium / High (resolution, shadows, particles, foliage density). Auto picks a tier from the device class.
- **Reduced motion:** follows the system setting by default and can be toggled in Settings. It disables lightning flashes, camera sweeps, and UI motion.

> **Honest testing note:** automated testing was done in headless desktop Chrome (WebGL via SwiftShader), in an emulated iPhone viewport with touch events, and in the 2D fallback. It has **not** been run on physical iOS or Android devices or on real Safari. Please try it on her device before the big day.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page on GitHub Pages | Check **Settings → Pages → Source = GitHub Actions**, and that the workflow succeeded in the **Actions** tab. |
| Assets 404 under a custom path | The workflow sets `BASE_PATH` automatically. For manual builds, run `npm run build:pages` or set `VITE_BASE_PATH`. |
| No sound | Tap or click once (browsers block audio until a gesture) and check the volume sliders and **Senyapkan semua** in Settings. On iPhone, turn off silent mode. |
| Slow on an older phone | Settings → **Kualiti grafik → Rendah**, or **Mod paparan → Mod Buku Cerita (2D)**. |
| Progress not saving | Private browsing modes block storage. Open the site in a normal tab. |
| Git Bash turns `/A-World…/` into `C:/Program Files/Git/…` | Run `export MSYS_NO_PATHCONV=1` before building with `--base`. |

---

## Licensing & assets

- **No external art, model, or audio files.** All characters, buildings, foliage, particles, sky, and water are generated in code, and all music and sound effects are synthesised live with the Web Audio API. Everything is original.
- Fonts are **Cormorant Garamond**, **Dancing Script**, and **Nunito** (SIL Open Font License), bundled via `@fontsource`, so no external font requests are made.
- Icons: **Lucide** (ISC).
- Libraries: MIT/ISC licensed (React, Three.js, React Three Fiber, drei, Zustand, Framer Motion, Tailwind CSS, React Router).

Made with love — *satu baris kod pada satu masa, hanya untuk dia.* 🤍
