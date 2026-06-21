# Research: Phaser 4 + Reddit (Devvit) starter template

Notes and sources gathered while designing this template (June 2026). Everything
here was verified current at the time — Phaser 4 is a ground-up rewrite, so most
pre-2026 Phaser tutorials are stale; the links below are the post-v4 ones.

## TL;DR landscape (June 2026)

| Thing | State | Why it matters |
|---|---|---|
| **Phaser** | v4.2.0 on npm (v4.1.0 was the Apr 30 2026 stable). v4 is the *only* dev focus now; v3.90 is the dead-end branch. | New WebGL renderer (RenderNodes), `SpriteGPULayer` (1M+ sprites/draw call), unified Filters, dynamic lighting. |
| **Reddit Devvit Web** | `@devvit/web` 0.12.x | Non-"blocks" model: Vite client in an iframe + Hono serverless backend + Redis. The deployment target. |
| **Reddit ❤️ Phaser** | Official `reddit/devvit-template-phaser` (updated Jun 15 2026) + a **$40K hackathon** (Jun 17 – Jul 15 2026). | Reddit is actively pushing exactly this stack; hackathon judging = design guidelines. |

## Stack chosen for this template

Phaser **4.2** · React **19** (HUD shell ↔ Phaser via EventBus bridge) ·
`@devvit/web` **0.12.24** · Hono **4.12** · Vite **8** (via `@devvit/start/vite`) ·
TypeScript **6** · `phaser-box2d` **1.1** (MIT). Node ≥ 22.2.

## Reference code & docs

### Reddit / Devvit (the base)
- **`reddit/devvit-template-phaser`** — canonical starting point (Phaser+Devvit+Vite+Hono+TS). https://github.com/reddit/devvit-template-phaser
- `reddit/devvit-template-bare` — minimal Devvit Web skeleton. https://github.com/reddit/devvit-template-bare
- Phaser's writeup of the Devvit template. https://phaser.io/news/2025/08/devvit-phaser-starter-template
- **Reddit + Phaser $40K hackathon** (rules / judging / dates). https://phaser.io/news/2026/06/reddit-and-phaser-launch-a-40-000-game-dev-hackathon · entry: https://redditgameswithahook.devpost.com/
- `aws-samples/sample-reddit-ai-game-starter` — fuller worked example of the same stack. https://github.com/aws-samples/sample-reddit-ai-game-starter
- Devvit docs for LLMs. https://developers.reddit.com/docs/llms.txt

### Official Phaser templates & example games
- `phaserjs/template-vite-ts` — official Vite+TS template. https://github.com/phaserjs/template-vite-ts
- `phaserjs/template-react-ts` — React↔Phaser bridge pattern (this template's `PhaserGame.tsx` is based on it). https://github.com/phaserjs/template-react-ts
- **`phaserjs/phaser-by-example`** — 9 complete games, converted to TS + Phaser v4. Best "real game" reference. https://github.com/phaserjs/phaser-by-example
- Phaser framework source. https://github.com/phaserjs/phaser
- `Raiper34/awesome-phaser` — curated libraries/plugins. https://github.com/Raiper34/awesome-phaser

### Stress-test / showcase (the impressive stuff)
- **Phaser 4 Examples / Sandbox** — hundreds of live examples, updated for v4. https://phaser.io/examples · https://labs.phaser.io/
- **Phaser 4 showcase page.** https://phaser.io/phaser4
- **SpriteGPULayer: 1M+ sprites** (article). https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance
- **Live runnable SpriteGPULayer demos (Phaser Sandbox):**
  - 🌲 **Big Forest** (1.4M GPU-animated sprites; dusk cycle, wind, parallax, pollen) — https://phaser.io/sandbox/X4nXSf53
  - 🐛 Creepy Crawly — https://phaser.io/sandbox/UvCabgF5
  - 🏃 Animated Sprites — https://phaser.io/sandbox/enjM3mHc
  - 🐰 Bunny Hop — https://phaser.io/sandbox/3J6qU2sy
- GPU gradients / color ramps / dithering dev log. https://phaser.io/news/2026/03/phaser-4-gradients-color-ramps-dithering
- Phaser 3 vs 4 (what changed). https://phaser.io/news/2026/05/phaser-3-vs-phaser-4 · migration: https://phaser.io/news/2026/04/migrating-from-phaser-3-to-phaser-4-what-you-need-to-know

### Shaders / filters (v4 RenderNode era)
- **Phaser 4 Shader Guide** — custom filters = `Controller` + `RenderNode` (inline/loaded GLSL, `#pragma`). https://github.com/phaserjs/phaser/blob/master/docs/Phaser%204%20Shader%20Guide/Phaser%204%20Shader%20Guide.md
- Rendering concepts deep-dive. https://phaser.io/tutorials/phaser-4-rendering-concepts
- **Unified Filter system** — 14 built-ins (Glow, Blur, Barrel, Vignette, ColorMatrix, Bokeh, TiltShift, Pixelate, GradientMap, Quantize, Blocky, ImageLight, Shadow, …) stack on any object/camera. https://phaser.io/news/2026/05/phaser-4-filter-system
- rexRainbow notes (largest community shader/plugin catalog). https://rexrainbow.github.io/phaser3-rex-notes/docs/site/shader-builtin/
- `Jerenaux/shaders-phaser` (custom GLSL on sprites). https://github.com/Jerenaux/shaders-phaser
- `neozenweb/phaserGames` (multi-pass shaders via render-to-texture). https://github.com/neozenweb/phaserGames

### Lighting (new in v4 — used in this template)
- **Phaser 4 Dynamic Lighting**: `this.lights.addLight`, `sprite.setLighting(true)`, `setSelfShadow(...)`, z-height, normal maps. https://phaser.io/news/2026/05/phaser-4-dynamic-lighting
- `CodeAndWeb/Phaser3-Lighting` — normal-map light demo + the TexturePacker normal-map pipeline. https://github.com/CodeAndWeb/Phaser3-Lighting

### Physics (all three wired into this template)
- Concepts overview (Arcade vs Matter). https://docs.phaser.io/phaser/concepts/physics
- Matter API. https://docs.phaser.io/api-documentation/class/physics-matter-matterphysics
- **Phaser Box2D v3** — MIT, ~70KB, 50+ examples, deterministic/CCD. https://phaser.io/box2d · repo: https://github.com/phaserjs/phaser-box2d · getting started: https://github.com/phaserjs/phaser-box2d/blob/main/getting-started/GETTING-STARTED.md
- `nkholski/phaser-grid-physics` (grid/tile physics). https://github.com/nkholski/phaser-grid-physics

### Tooling
- Phaser Editor v5 (full v4 + filters + Spine + AI). https://phaser.io/news/2026/04/phaser-editor-v5-release
- `phaserjs/phaser-editor-template-react-ts`. https://github.com/phaserjs/phaser-editor-template-react-ts

## Gotchas discovered while building (save yourself the pain)

- **Phaser 4 ESM has no `Phaser` global** — `import * as Phaser from 'phaser'` in any file that uses `Phaser.*` *values* at runtime (`Phaser.Math.Between`, etc.); `import type * as Phaser` for type-only use.
- **`phaser-box2d` npm package is half-broken**: `main` points at a non-existent `index.js` → import `phaser-box2d/dist/PhaserBox2D.js`. It ships **no types**, and the repo's generated JSDoc types are inconsistent (e.g. `WorldStep` typed `{worldDef}` but called with `{worldId, deltaTime}`; `size` marked required but omitted in docs). We isolate all of this behind a typed facade (`src/client/game/physics/box2d.ts`) + an ambient `declare module`.
- **Box2D needs a FIXED timestep** (we step 1/60). Feeding the variable frame delta makes fast bodies tunnel through thin static shapes when FPS drops.
- **Box2D static/dynamic coordinate drift**: `CreateBoxPolygon` + `pxmVec2` and `SpriteToBox` use different internal pixel↔meter conversions, so a `pxmVec2` floor won't line up with `SpriteToBox` bodies. Fix: build floors/walls from sprites via `SpriteToBox(STATIC)` so visuals *are* the collision shapes.
- **Phaser 4 lighting + generated textures**: attach a normal map to a canvas texture with `textures.addCanvas(key, diffuseCanvas)` then `textures.get(key).setDataSource(normalCanvas)`. A sphere's normal map is analytic (a hemisphere) — cleaner than hand-painted.
- **SpriteGPULayer member tint** needs `tintBlend: 1` *and* the four corner tints set; per-member animation via `MemberAnimation` (`ease: 'Sine.easeInOut'`, `loop`, `yoyo`, `velocity`, …).
- **Devvit webview CSP**: no external scripts/CDNs (bundle everything via npm), no `window.alert`/`window.location` (use `showToast`/`navigateTo` from `@devvit/web/client`), no inline `<script>`.
- **Devvit dev loop is `vite build --watch`** (not a dev server), so `@vitejs/plugin-react` (Fast Refresh) isn't needed — esbuild compiles TSX from tsconfig `jsx`.

## Internal references (in this monorepo neighborhood)
- `../game-a-day/devvit-web-app` — proven Devvit plumbing (devvit.json entrypoints/menu/scheduler/triggers, Hono routes, splash+game two-entrypoint, score interception).
- `../Tongits.io/apps/web/src/components/game/phaser` — production Phaser 4.2 scene architecture (camera-zoom responsive scaling, geometry masks, React↔Phaser bridge).
