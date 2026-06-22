import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

const SEG = 18;
const SPACING = 16;
const TINTS = [0x6ad1ff, 0x9b8cff, 0x66ffcc, 0xff9ed8, 0xffe066];

type R = { rope: Phaser.GameObjects.Rope; pts: Phaser.Math.Vector2[]; phase: number; amp: number; freq: number };

// Rope geometry (Phaser 4 — Mesh/Plane were removed, Rope survives): a field of
// sine-deforming textured triangle strips. Ramps rope count; each frame every
// rope's vertices are recomputed and re-uploaded (setDirty) — CPU-bound vertex
// churn, additive-blended for glowing ribbons.
export class RopeBench extends BenchScene {
  protected readonly benchId = 'rope';
  private ropes: R[] = [];

  constructor() {
    super({ key: 'RopeBench' });
    this.stepSize = 120;
  }

  protected setup() {
    addGradientBackground(this, '#0a1030', '#05060f');
    this.ropes = [];
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(20, width - SEG * SPACING);
      const y = Phaser.Math.Between(20, height - 20);
      const pts = Array.from({ length: SEG }, (_, k) => new Phaser.Math.Vector2(k * SPACING, 0));
      const rope = this.add.rope(x, y, 'glow', undefined, pts);
      rope.setColors(TINTS[i % TINTS.length]!);
      rope.setAlpha(0.85);
      this.ropes.push({
        rope,
        pts,
        phase: Math.random() * Math.PI * 2,
        amp: 8 + Math.random() * 14,
        freq: 1.5 + Math.random() * 2,
      });
    }
  }

  protected override onUpdate(_delta: number) {
    const t = this.time.now * 0.001;
    for (const r of this.ropes) {
      for (let k = 0; k < r.pts.length; k++) {
        r.pts[k]!.y = Math.sin(k * 0.5 + t * r.freq + r.phase) * r.amp;
      }
      r.rope.setDirty();
    }
  }
}
