// phaser-box2d ships no type declarations on npm. We import its prebuilt ESM
// bundle and apply our own typed facade (see box2d.ts), so an untyped ambient
// module declaration is all TypeScript needs here.
declare module 'phaser-box2d/dist/PhaserBox2D.js';
