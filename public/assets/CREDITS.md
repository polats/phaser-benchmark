# Asset credits

The assets in this folder back the **official Phaser showcase demos** vendored
under `src/client/game/demos/` (Big Forest, Creepy Crawly, GPU Animated Sprites,
Bunny Bounce). They were created by **Phaser Studio / PhotonStorm** and are
distributed as Phaser's public example assets (originally served from
`https://cdn.phaserfiles.com/v385`):

- `atlas/big-forest.*` — Big Forest demo atlas
- `skies/bigsky.png` — sky backdrop
- `atlas/trimsheet/*` — animated bubble trimsheet
- `sprites/bunny.png` — bunny sprite
- `normal-maps/{spider,stones}*` — normal-mapped spider + stone floor

They are included so the demos run offline inside the Devvit webview (whose CSP
blocks external CDNs). They're great for **benchmarking and learning**, but for a
published game you should replace them with your own art — see
`src/client/game/scenes/Preloader.ts` and `game/lib/textures.ts` for where art is
loaded/generated.

Demo source: https://phaser.io/sandbox (entries X4nXSf53, UvCabgF5, enjM3mHc, 3J6qU2sy).
