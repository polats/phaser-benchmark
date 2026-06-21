import * as Phaser from 'phaser';
import type { GameObjects } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';
import { enablePointerDrag } from './pointerDrag';

// Phaser 4 dynamic lighting showcase + stress test. A handful of colored lights
// orbit over a growing field of normal-mapped, self-shadowed sprites. The normal
// maps (generated in lib/textures.ts) give each sprite real 3D shading; ramping
// the lit-sprite count measures the lighting pass cost.
//
// Docs: https://phaser.io/news/2026/05/phaser-4-dynamic-lighting
type OrbitLight = {
  light: GameObjects.Light;
  cx: number;
  cy: number;
  r: number;
  speed: number;
  phase: number;
};

const LIGHT_COLORS = [0xff5566, 0x55aaff, 0xffdd66, 0x66ff99, 0xcc66ff, 0xff9944];

export class LightingBench extends BenchScene {
  protected readonly benchId = 'lighting';
  // Note: do NOT name this `lights` — that's the Scene's LightsManager plugin.
  private orbits: OrbitLight[] = [];
  private litSprites: GameObjects.Image[] = [];
  private elapsed = 0;

  constructor() {
    super({ key: 'LightingBench' });
    this.targetFps = 50;
    this.stepSize = 150;
    this.maxCount = 40_000;
  }

  protected setup() {
    const { width, height } = this.scale;
    addGradientBackground(this, '#10131f', '#05060b');

    this.lights.enable();
    this.lights.setAmbientColor(0x141420);

    // Drag-and-drop: slide lit sprites through the moving lights.
    this.litSprites = [];
    enablePointerDrag<GameObjects.Image>({
      scene: this,
      grabRadius: 30,
      items: () => this.litSprites,
      onMove: (img, x, y) => img.setPosition(x, y),
    });

    this.orbits = [];
    for (let i = 0; i < 6; i++) {
      const cx = Phaser.Math.Between(Math.round(width * 0.2), Math.round(width * 0.8));
      const cy = Phaser.Math.Between(Math.round(height * 0.2), Math.round(height * 0.8));
      const light = this.lights.addLight(cx, cy, 320, LIGHT_COLORS[i % LIGHT_COLORS.length], 2);
      this.orbits.push({
        light,
        cx,
        cy,
        r: Phaser.Math.Between(120, 260),
        speed: Phaser.Math.FloatBetween(0.4, 1.1) * (i % 2 ? 1 : -1),
        phase: Phaser.Math.FloatBetween(0, Math.PI * 2),
      });
    }
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const useBox = (i & 3) === 0;
      const spr = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), useBox ? 'box' : 'ball')
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1))
        .setTint(Phaser.Display.Color.RandomRGB(120, 255).color);
      spr.setLighting(true);
      spr.setSelfShadow(true);
      spr.setZ(6);
      this.litSprites.push(spr);
    }
  }

  protected override onUpdate(delta: number) {
    this.elapsed += delta / 1000;
    for (const o of this.orbits) {
      o.light.x = o.cx + Math.cos(this.elapsed * o.speed + o.phase) * o.r;
      o.light.y = o.cy + Math.sin(this.elapsed * o.speed + o.phase) * o.r;
    }
  }

  override shutdown() {
    super.shutdown();
    this.orbits = [];
  }
}
