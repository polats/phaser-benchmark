import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import { devvit } from '@devvit/start/vite';

// ── Build identity ───────────────────────────────────────────────────────────
// Computed once at config load and threaded through the build two ways:
//   1. `define` exposes them to client code (src/client/build-info.ts) so the
//      live build id can be shown in the HUD.
//   2. The cacheBust() plugin stamps `?v=<token>` onto the emitted asset URLs so
//      a new deploy is never served from a stale webview/CDN cache (the Devvit
//      plugin forces stable filenames like `game.js`, which otherwise cache
//      forever across versions).
function gitSha(): string {
  // CI provides GITHUB_SHA; fall back to local git, then a placeholder.
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
}

const BUILD_SHA = gitSha();
const BUILD_TIME = new Date().toISOString();
// Unique per build (even when rebuilding the same commit), so it always busts.
const CACHE_TOKEN = `${BUILD_SHA}.${Date.now().toString(36)}`;

// Append `?v=<token>` to local .js/.css references in the generated HTML. Runs
// `post` so it sees the final tags Vite injects.
function cacheBust(token: string): Plugin {
  return {
    name: 'devvit-cache-bust',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /(src|href)="(\/[^"?]+\.(?:js|css))"/g,
        (_match, attr: string, url: string) => `${attr}="${url}?v=${token}"`
      );
    },
  };
}

// The Devvit plugin discovers client entrypoints (splash.html, game.html) from
// devvit.json and wires the server build.
//
// React (the shell around Phaser in game.html) is compiled by Vite's built-in
// transform using the `jsx`/`jsxImportSource` settings in tools/tsconfig.client.json
// ("react-jsx" automatic runtime), which Vite reads from tsconfig automatically, so
// no extra React plugin or explicit JSX config is required. The Devvit dev loop is
// `vite build --watch`, not a dev server, so Fast Refresh (the main reason to add
// @vitejs/plugin-react) would not apply anyway.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_SHA),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  plugins: [
    devvit({
      client: {
        build: {
          // Phaser + React + physics engines push the bundle past the default warn limit.
          chunkSizeWarningLimit: 3000,
        },
      },
    }),
    cacheBust(CACHE_TOKEN),
  ],
});
