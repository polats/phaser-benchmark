import { defineConfig, type Connect, type Plugin } from 'vite';

// Standalone LOCAL preview (no Devvit / no Reddit). Serves the expanded game view
// (game.html -> React -> Phaser) and mocks the Hono server's /api routes in
// memory, so you can play the demo and run the bench scenes in a normal browser.
//
//   npm run dev:local   ->   http://localhost:5173/game.html
//
// The real app still builds/deploys via vite.config.ts (the Devvit plugin). This
// file is only for fast local iteration on game/UI code.

type Json = Record<string, unknown>;

function readBody(req: Connect.IncomingMessage): Promise<Json> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? (JSON.parse(data) as Json) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function mockApi(): Plugin {
  // Tiny in-memory state so the leaderboard/score round-trip behaves.
  let best = 0;
  const board = new Map<string, number>([
    ['snoo_fan', 420],
    ['pixelpusher', 310],
  ]);
  const benchBest = new Map<string, number>();

  return {
    name: 'mock-devvit-api',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const url = req.url ?? '';
        const send = (obj: Json) => {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(obj));
        };

        if (url.startsWith('/init')) {
          return send({ type: 'init', postId: 'local', username: 'localdev', bestScore: best });
        }
        if (url.startsWith('/leaderboard')) {
          const entries = [...board.entries(), ['localdev', best] as const]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([username, score], i) => ({ username, score, rank: i + 1 }));
          return send({ type: 'leaderboard', postId: 'local', entries });
        }
        if (url.startsWith('/score')) {
          const body = await readBody(req);
          const score = Number(body.score) || 0;
          best = Math.max(best, score);
          board.set('localdev', best);
          return send({ type: 'score', postId: 'local', bestScore: best, rank: 1 });
        }
        if (url.startsWith('/bench-result')) {
          const body = await readBody(req);
          const bench = String(body.bench);
          const capacity = Number(body.capacity) || 0;
          const globalBest = Math.max(benchBest.get(bench) ?? 0, capacity);
          benchBest.set(bench, globalBest);
          return send({ type: 'bench-result', bench, globalBest });
        }
        next();
      });

      // Open the game view by default.
      server.middlewares.use((req, _res, next) => {
        if (req.url === '/') req.url = '/game.html';
        next();
      });
    },
  };
}

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { include: ['phaser'] },
  plugins: [mockApi()],
  server: {
    host: true, // bind 0.0.0.0 so other devices (e.g. over Tailscale) can reach it
    port: 5173,
    strictPort: true,
    open: false,
    allowedHosts: true, // accept the Tailscale magicDNS hostname / any Host header
  },
});
