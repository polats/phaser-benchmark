import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';

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
  plugins: [
    devvit({
      client: {
        build: {
          // Phaser + React + physics engines push the bundle past the default warn limit.
          chunkSizeWarningLimit: 3000,
        },
      },
    }),
  ],
});
