# reddit-phaser

A production-ready starter template for building **Phaser 4** games that run inside
**Reddit** via [Devvit Web](https://developers.reddit.com/). It fuses Reddit's
official Devvit + Phaser plumbing with a **React HUD shell**, a server-backed
**leaderboard**, and a set of **stress-test scenes** that showcase Phaser 4's
newest capabilities (SpriteGPULayer, the unified filter system, and three physics
engines).

## Stack

| Layer | Tech |
|---|---|
| Game | **Phaser 4.2** (WebGL, SpriteGPULayer, unified Filters) |
| UI shell | **React 19** mounted around the Phaser canvas via an EventBus bridge |
| Physics | **Arcade** + **Matter.js** (built in) + **Phaser Box2D v3** (`phaser-box2d`) |
| Platform | **Devvit Web** (`@devvit/web` 0.12) — iframe client + serverless server |
| Server | **Hono** on Devvit's Node runtime, **Redis** for state/leaderboard |
| Build | **Vite 8** via `@devvit/start/vite`, **TypeScript 6** |

## Quick start

```bash
npm install
npm run login      # one-time: authenticate the Devvit CLI
npm run dev        # devvit playtest — live-develop on a test subreddit
```

Other scripts: `npm run build` · `npm run type-check` · `npm run lint` ·
`npm run deploy` (type-check + lint + upload) · `npm run launch` (deploy + publish).

> Requires Node ≥ 22.2 and a Reddit account connected at
> [developers.reddit.com](https://developers.reddit.com/).

## Deploying from a cloud container / CI

The app itself needs **no secrets** — its server uses Devvit-provided `redis`,
`reddit`, and `context` (injected by the runtime). The only thing a headless
environment needs is **Devvit CLI auth**, via one env var (see `.env.sample`):

| Var | Required | Value |
|---|---|---|
| `DEVVIT_AUTH_TOKEN` | ✅ | The exact contents of your local `~/.devvit/token` (a one-line JSON). Get it with `cat ~/.devvit/token` after `devvit login`. **Treat as a secret.** |
| `DEVVIT_DISABLE_METRICS` | optional | `1` — skip the CLI metrics prompt in CI. |
| `DEVVIT_SUBREDDIT` | optional | Default test subreddit for `devvit playtest` (matches `dev.subreddit` in `devvit.json`). |

```bash
# in the container
export DEVVIT_AUTH_TOKEN='<contents of ~/.devvit/token>'
npm ci
npm run deploy        # type-check + lint + devvit upload (headless)
```

The Devvit CLI reads `DEVVIT_AUTH_TOKEN` from the environment (or a gitignored
`.env`) instead of opening a browser — this is the intended path for web
containers. **Note:** the *first* upload of a brand-new app name may still need
one interactive `devvit upload` (anywhere with a browser) to register the global
name; after that, container deploys are fully headless.

## Standalone web playground (Vercel)

The game also runs as a **plain browser app** (benchmarks + demos, with a mocked
`/api`) — handy for sharing a public link without Reddit. `npm run build:web`
produces a static `dist-web/`, the `/api/*` mock ships as Vercel serverless
functions in `api/`, and `.github/workflows/vercel.yml` deploys it.

It needs three **Vercel** secrets (a Vercel token — *not* your GitHub PAT):
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (run `npx vercel link` once
to get the IDs). Or just import the repo at [vercel.com/new](https://vercel.com/new)
and Vercel auto-deploys via `vercel.json` — then delete the workflow. Setup notes
are in the workflow file. (This is *not* the Reddit app — that deploys to Devvit
via `deploy.yml`.)

## How it works

Reddit shows two views of a Devvit post, both declared in `devvit.json`:

- **`splash.html`** — the lightweight inline view in the feed. Plain HTML/CSS/TS,
  no Phaser, so it stays fast. A Play button calls `requestExpandedMode('game')`.
- **`game.html`** — the expanded view. Mounts React (`game.tsx` → `App.tsx`),
  which mounts Phaser through the `PhaserGame` bridge component.

The React shell and Phaser scenes talk over a shared `EventBus` (see
`src/client/game/events.ts`): scenes emit score/perf events; React submits scores
to the server and drives scene switching.

## Project layout

```
src/
├── client/                      # runs inside the Reddit iframe
│   ├── splash.{html,css,ts}     # inline feed view (fast, no Phaser)
│   ├── game.{html,css}, game.tsx# expanded view → React root
│   ├── react/                   # HUD shell: App, PhaserGame bridge, components
│   └── game/
│       ├── main.ts              # Phaser.Game config + scene registry
│       ├── EventBus.ts, events.ts, devvit-bridge.ts
│       ├── scenes/              # Boot, Preloader, MainMenu, Game (demo), GameOver
│       ├── benches/             # stress-test scenes + BenchScene harness + registry
│       └── physics/box2d.ts     # typed facade over phaser-box2d
├── server/                      # Hono on Devvit serverless
│   ├── index.ts, routes/        # api (init/score/leaderboard/bench), menu, triggers
│   └── core/post.ts
└── shared/api.ts                # client <-> server types
```

## Stress-test / showcase scenes

Open the expanded game and use the **bench bar** (top-right) to launch any of
these. Each ramps a load parameter once per second until FPS drops below target,
then reports the **capacity** to the server (`/api/bench-result`) — so you can
compare real devices inside the Reddit app. The harness lives in
`benches/BenchScene.ts`; add your own by extending it and listing it in
`benches/registry.ts`.

| Bench | What it stresses | Phaser 4 feature |
|---|---|---|
| **GPU Sprites** | renderer throughput | `SpriteGPULayer` — 100k+ GPU-animated sprites in one draw call |
| **Filters** | fragment fillrate | unified Filter system — stacked `addBlur/addGlow/addBarrel/...` |
| **Arcade** | CPU broadphase | Arcade Physics bodies |
| **Matter** | rigid-body solver | Matter.js stacking |
| **Box2D** | deterministic heavy physics | Phaser Box2D v3 (WASM-grade) |
| **Horde** | sprites + particles together | Vampire-Survivors-style swarm: auto-bolts, additive explosion bursts, trails, XP gems |

Plus the **official PhotonStorm Phaser demos**, vendored under `src/client/game/demos/`
as fixed-load benchmarks ("does this device hold 60fps at N sprites?"):

| Demo | Load | Shows off |
|---|---|---|
| 🌲 **Big Forest** | ~143k sprites (orig. 1.4M) | SpriteGPULayer parallax forest, weather, day/night, scroll |
| 🕷 **Spiders** | 8k | GPU layer + dynamic lights + normal maps |
| 🫧 **Bubbles** | 4k | GPU frame-animation |
| 🐰 **Bunnies** | 1k | multi-property GPU animation |

Their assets live in `public/assets/` (Phaser example assets — see `public/assets/CREDITS.md`).

## Replace the demo with your game

1. Put art in `public/assets/` and load it in `scenes/Preloader.ts`.
2. Build your gameplay in `scenes/Game.ts` (or add scenes and register them in
   `game/main.ts`). Emit `GameEvents.Score` to record a score.
3. Keep or delete the `benches/` folder — it's optional once you ship.

## License

BSD-3-Clause. Built on Reddit's
[`devvit-template-phaser`](https://github.com/reddit/devvit-template-phaser) and
the [Phaser](https://phaser.io) framework.
