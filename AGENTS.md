You are working on a **Phaser 4 game that runs inside Reddit** via Devvit Web.

## Tech stack

- **Game**: Phaser 4.2 (WebGL; SpriteGPULayer, unified Filters).
- **UI shell**: React 19 mounted around the Phaser canvas (see `src/client/react`).
- **Physics**: Arcade + Matter (built into Phaser) + Phaser Box2D v3 (`phaser-box2d`).
- **Backend**: Node v22 serverless (Devvit), Hono, Redis — via `@devvit/web/server`.
- **Build**: Vite via `@devvit/start/vite`, TypeScript (project references).

## Layout

- `src/client` — runs inside an iframe on reddit.com. Entrypoints are declared in
  `devvit.json` and mapped to HTML files:
  - `splash.html` — inline feed view. Keep it tiny and dependency-free.
  - `game.html` — expanded view → React (`game.tsx`) → Phaser (`game/main.ts`).
- `src/server` — Hono app. Access `redis`, `reddit`, `context` from `@devvit/web/server`.
  Add a route file under `routes/` and wire it in `index.ts`.
- `src/shared` — types shared by client and server (`api.ts`). Single source of truth.

## Frontend rules (Devvit webview constraints)

- Use `navigateTo` from `@devvit/web/client`, never `window.location`.
- No `window.alert` — use `showToast` / `showForm` from `@devvit/web/client`.
- **No external scripts / CDNs** — Devvit's CSP blocks them. Bundle everything via npm.
- No inline `<script>` in HTML — use a separate `.ts`/`.tsx` module.
- Geolocation, camera, mic, notifications: unavailable.

## Phaser specifics

- This is **Phaser 4**, not 3. The v3 Pipeline system is gone — use **RenderNodes**
  and the **unified Filter system** (`camera.filters.internal.addX()`). FX and Masks
  are now Filters.
- Files that reference `Phaser.*` **values** at runtime (e.g. `Phaser.Math.Between`)
  must `import * as Phaser from 'phaser'` — the ESM build does not create a global.
  Type-only references can use `import type * as Phaser from 'phaser'`.
- React ↔ Phaser communication goes through the `EventBus` (`game/EventBus.ts`) with
  payloads typed in `game/events.ts`. Scenes emit `GameEvents.SceneReady` in `create()`.

## Phaser Box2D gotchas

- The npm package's `main` points at a missing `index.js`; import the prebuilt bundle:
  `import * as B from 'phaser-box2d/dist/PhaserBox2D.js'`.
- It ships **no types** and its JSDoc-generated types (in the repo) are inconsistent.
  All access goes through the typed facade in `game/physics/box2d.ts` — extend that
  rather than importing the library directly elsewhere.

## Stress-test scenes

- `benches/BenchScene.ts` is a reusable harness: implement `setup()` + `addObjects(n)`
  and it ramps the count until FPS drops, reporting capacity to the server.
- To add a bench: extend `BenchScene`, register the scene in `game/main.ts`, and add
  an entry to `benches/registry.ts` (the React bench bar reads this list).

## Commands

- `npm run type-check` — `tsc --build` across client/server/shared/vite projects.
- `npm run lint` — ESLint.
- `npm run build` — Vite build (client + server) into `dist/`.
- `npm run dev` — `devvit playtest` (live on a test subreddit).

## Code style

- Type aliases over interfaces. Named exports over default exports. Never cast types
  except at a documented boundary (see `physics/box2d.ts`).
- When adding a menu item / trigger / form, add both the endpoint in `src/server` and
  the mapping in `devvit.json`.

Docs: https://developers.reddit.com/docs/llms.txt · https://phaser.io/phaser4
