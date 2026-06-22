import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';

// Phaser 4 GPU tilemap stress (TilemapGPULayer via createLayer(..., true) — a whole
// layer drawn as one shader quad). Ramps stacked parallax layers; each layer is a
// full-screen tilemap shader pass, so capacity = how many the device sustains.
// Tileset is generated at runtime (no vendored asset).
const TILE = 32;
const MAPW = 48;
const MAPH = 36;
const TILESET_KEY = 'benchtiles';
const TILE_COLORS = ['#1b3a6b', '#2a6b4a', '#6b5a2a', '#5a2a6b', '#2a5a6b', '#6b2a3a', '#3a6b2a', '#444a5a'];

export class TilemapBench extends BenchScene {
  protected readonly benchId = 'tilemap';
  private layers: Array<Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer> = [];

  constructor() {
    super({ key: 'TilemapBench' });
    this.stepSize = 2;
    this.maxCount = 80;
  }

  protected setup() {
    this.layers = [];
    this.cameras.main.setBackgroundColor('#070a16');

    if (!this.textures.exists(TILESET_KEY)) {
      const cols = TILE_COLORS.length;
      const canvas = document.createElement('canvas');
      canvas.width = cols * TILE;
      canvas.height = TILE;
      const ctx = canvas.getContext('2d')!;
      for (let i = 0; i < cols; i++) {
        const x = i * TILE;
        ctx.fillStyle = TILE_COLORS[i]!;
        ctx.fillRect(x, 0, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, 1, TILE - 2, TILE - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + TILE / 2 - 4, TILE / 2 - 4, 8, 8);
      }
      this.textures.addCanvas(TILESET_KEY, canvas);
    }
  }

  protected addObjects(n: number) {
    for (let i = 0; i < n; i++) {
      const idx = this.layers.length;
      const data: number[][] = [];
      for (let y = 0; y < MAPH; y++) {
        const row: number[] = [];
        for (let x = 0; x < MAPW; x++) row.push(Phaser.Math.Between(0, TILE_COLORS.length - 1));
        data.push(row);
      }
      const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE, TILE);
      if (!tileset) continue;
      // 5th arg requests a GPU layer in Phaser 4 (falls back to a normal layer).
      const layer = map.createLayer(0, tileset, 0, 0, true);
      if (!layer) continue;
      layer.setAlpha(0.55);
      layer.setScrollFactor(0.3 + idx * 0.06);
      this.layers.push(layer);
    }
  }

  protected override onUpdate(delta: number) {
    const cam = this.cameras.main;
    cam.scrollX += delta * 0.04;
    cam.scrollY = Math.sin(this.time.now * 0.0002) * 120;
  }

  override shutdown() {
    super.shutdown();
    this.layers = [];
  }
}
