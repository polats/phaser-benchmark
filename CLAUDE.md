See [AGENTS.md](./AGENTS.md) for the full guide to this codebase (stack, layout,
Devvit webview constraints, Phaser 4 specifics, the Box2D facade, and the
stress-test harness).

Quick reminders:

- Phaser **4** (not 3): unified Filters + RenderNodes; `import * as Phaser` when using
  `Phaser.*` values at runtime.
- React shell ↔ Phaser scenes communicate via `EventBus` (`src/client/game/events.ts`).
- Server state lives in Redis via `@devvit/web/server`; keep client/server types in
  `src/shared/api.ts`.
- Always run `npm run type-check` and `npm run lint` before considering a change done.
