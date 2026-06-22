import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

const TINTS = [0x6ad1ff, 0x9b8cff, 0x66ffcc, 0xff9ed8, 0xffe066, 0xff7b6b];

// Particle stress: a field of continuous additive fountains. Ramps the emitter
// count — per-particle update (velocity, gravity, easing) is CPU-bound while the
// additive blending stresses GPU fill. Each fountain holds ~30 live particles.
export class ParticlesBench extends BenchScene {
  protected readonly benchId = 'particles';
  private emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super({ key: 'ParticlesBench' });
    this.stepSize = 24;
  }

  protected setup() {
    addGradientBackground(this, '#0c1330', '#05070f');
    this.emitters = [];
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(40, width - 40);
      const y = Phaser.Math.Between(80, height - 40);
      const emitter = this.add.particles(x, y, 'glow', {
        speed: { min: 30, max: 110 },
        angle: { min: 210, max: 330 },
        gravityY: 90,
        lifespan: 1400,
        frequency: 45,
        quantity: 1,
        scale: { start: 0.35, end: 0 },
        alpha: { start: 0.75, end: 0 },
        tint: TINTS[i % TINTS.length]!,
        blendMode: Phaser.BlendModes.ADD,
      });
      this.emitters.push(emitter);
    }
  }
}
