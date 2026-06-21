import type { Scene } from 'phaser';
import * as Phaser from 'phaser';

// Generates a monospace bitmap font at runtime (no binary .fnt/.png assets) so
// the Text benchmark can compare canvas `Text` against atlas-batched
// `BitmapText`. We rasterize the printable ASCII range into a fixed grid on a
// canvas, register it as a texture, and parse it into the bitmap-font cache with
// Phaser 4's RetroFont parser.

export const RETRO_FONT_KEY = 'bench-retro-font';
const TEX_KEY = 'bench-retro-font-tex';

const FIRST = 32; // space
const LAST = 126; // ~
const COLS = 16;
const CELL_W = 24;
const CELL_H = 32;

// Printable ASCII in code order — this exact order is what RetroFont.Parse maps
// onto the grid cells.
const CHARS = (() => {
  let s = '';
  for (let c = FIRST; c <= LAST; c++) s += String.fromCharCode(c);
  return s;
})();

export function ensureRetroFont(scene: Scene): void {
  if (scene.cache.bitmapFont.exists(RETRO_FONT_KEY)) return;

  const rows = Math.ceil(CHARS.length / COLS);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * CELL_W;
  canvas.height = rows * CELL_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable for retro font');

  // White glyphs so BitmapText's GPU tint can recolour them cleanly.
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.floor(CELL_H * 0.72)}px ui-monospace, "Courier New", monospace`;
  for (let i = 0; i < CHARS.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.fillText(CHARS[i]!, col * CELL_W + CELL_W / 2, row * CELL_H + CELL_H / 2 + 1);
  }

  if (scene.textures.exists(TEX_KEY)) scene.textures.remove(TEX_KEY);
  scene.textures.addCanvas(TEX_KEY, canvas);

  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: TEX_KEY,
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: COLS,
    'offset.x': 0,
    'offset.y': 0,
    'spacing.x': 0,
    'spacing.y': 0,
    lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(RETRO_FONT_KEY, data);
}
