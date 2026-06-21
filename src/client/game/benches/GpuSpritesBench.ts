import * as Phaser from 'phaser';
import type { GameObjects } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

// A "Big Forest"-style showcase for SpriteGPULayer: a deep, swaying, glowing
// environment rendered in a couple of draw calls, with every sprite animated
// entirely on the GPU. We still ramp the member count as a throughput benchmark.
//
// Depth is faked with tiers: far foliage is smaller, darker, and sways slowly;
// near foliage is larger, brighter, and sways more. A second additive layer adds
// drifting pollen motes, and the sky runs a slow dusk colour cycle.
//
// Docs: https://phaser.io/news/2026/05/phaser4-spritegpulayer-performance
const FOLIAGE_GREENS = [0x1d3b1f, 0x2f5a2c, 0x3f7a39, 0x57a14a, 0x7cc45e];

export class GpuSpritesBench extends BenchScene {
  protected readonly benchId = 'gpu-sprites';
  private foliage?: GameObjects.SpriteGPULayer;
  private pollen?: GameObjects.SpriteGPULayer;
  private sky?: GameObjects.Image;

  constructor() {
    super({ key: 'GpuSpritesBench' });
    this.targetFps = 50;
    this.stepSize = 4000;
    this.maxCount = 200_000;
  }

  protected setup() {
    this.sky = addGradientBackground(this, '#2a2a55', '#0c1228');
    // Slow dusk cycle: warm sunset -> cool night -> back.
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0xffa552),
          Phaser.Display.Color.ValueToColor(0x4a5fb0),
          100,
          Math.round(t * 100)
        );
        this.sky?.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      },
    });

    this.foliage = this.add.spriteGPULayer('leaf', this.maxCount);
    this.pollen = this.add.spriteGPULayer('glow', Math.ceil(this.maxCount / 6)).setBlendMode(Phaser.BlendModes.ADD);
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    const foliage = this.foliage;
    const pollen = this.pollen;
    if (!foliage || !pollen) return;

    for (let i = 0; i < n; i++) {
      // depth 0 (far) .. 1 (near)
      const depth = Math.pow(Phaser.Math.FloatBetween(0, 1), 1.5);
      const scale = Phaser.Math.Linear(0.25, 1.3, depth);
      const tintColor = FOLIAGE_GREENS[Math.min(FOLIAGE_GREENS.length - 1, Math.floor(depth * FOLIAGE_GREENS.length))]!;
      const sway = Phaser.Math.Linear(0.05, 0.35, depth);

      foliage.addMember({
        x: Phaser.Math.Between(-20, width + 20),
        // Near foliage clusters toward the bottom of the screen.
        y: Phaser.Math.Linear(height * 0.35, height + 10, depth) + Phaser.Math.Between(-30, 30),
        scaleX: scale,
        scaleY: scale,
        originY: 1, // pivot at the base so it sways like a plant
        tintBlend: 1,
        tintTopLeft: tintColor,
        tintTopRight: tintColor,
        tintBottomLeft: tintColor,
        tintBottomRight: tintColor,
        rotation: {
          base: -sway / 2,
          amplitude: sway,
          ease: 'Sine.easeInOut',
          duration: Phaser.Math.Between(2200, 4200),
          loop: true,
          yoyo: true,
        },
      });

      // ~1 pollen mote per 6 foliage sprites: drifts upward, additive glow.
      if (i % 6 === 0) {
        const startY = Phaser.Math.Between(0, height);
        const ps = Phaser.Math.FloatBetween(0.05, 0.16);
        pollen.addMember({
          x: Phaser.Math.Between(0, width),
          y: { base: startY, amplitude: -height * 0.5, ease: 'Linear', duration: Phaser.Math.Between(4000, 9000), loop: true },
          scaleX: ps,
          scaleY: ps,
          tintBlend: 1,
          tintTopLeft: 0xffe9a8,
          tintTopRight: 0xffe9a8,
          tintBottomLeft: 0xffe9a8,
          tintBottomRight: 0xffe9a8,
          alpha: { base: 0.2, amplitude: 0.6, ease: 'Sine.easeInOut', duration: 2600, loop: true, yoyo: true },
        });
      }
    }
  }
}
