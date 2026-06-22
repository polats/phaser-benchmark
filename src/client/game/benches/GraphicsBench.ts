import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

const COLORS = [0x6ad1ff, 0x9b8cff, 0x66ffcc, 0xff9ed8, 0xffe066, 0xff7b6b];

type Shape = {
  x: number;
  y: number;
  r: number;
  rot: number;
  spin: number;
  color: number;
};

// Vector throughput (CPU): one Graphics object that is cleared and re-tessellated
// every frame, drawing `count` rotating filled+stroked stars. Phaser rebuilds the
// path geometry on the main thread each frame, so FPS scales with shape count.
export class GraphicsBench extends BenchScene {
  protected readonly benchId = 'graphics';
  private gfx!: Phaser.GameObjects.Graphics;
  private shapes: Shape[] = [];
  private pts: Phaser.Math.Vector2[] = [];

  constructor() {
    super({ key: 'GraphicsBench' });
    this.stepSize = 250;
  }

  protected setup() {
    addGradientBackground(this, '#10233a', '#070a16');
    this.gfx = this.add.graphics();
    this.shapes = [];
    this.pts = Array.from({ length: 10 }, () => new Phaser.Math.Vector2(0, 0));
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      this.shapes.push({
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        r: 8 + Math.random() * 16,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 2,
        color: COLORS[i % COLORS.length]!,
      });
    }
  }

  protected override onUpdate(delta: number) {
    const g = this.gfx;
    if (!g) return;
    const dt = delta * 0.001;
    g.clear();
    for (const s of this.shapes) {
      s.rot += s.spin * dt;
      // five-point star = 10 vertices, alternating outer/inner radius
      for (let k = 0; k < 10; k++) {
        const rad = k % 2 === 0 ? s.r : s.r * 0.45;
        const a = s.rot + (k * Math.PI) / 5;
        this.pts[k]!.set(s.x + Math.cos(a) * rad, s.y + Math.sin(a) * rad);
      }
      g.fillStyle(s.color, 1);
      g.fillPoints(this.pts, true);
      g.lineStyle(1.5, 0xffffff, 0.35);
      g.strokePoints(this.pts, true);
    }
  }
}
