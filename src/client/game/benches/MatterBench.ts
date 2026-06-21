import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

const MATTER_TINTS = [0x06d6a0, 0x118ab2, 0x73d2de, 0xffd166, 0xef476f];

// Matter.js stress: rigid bodies dropping in and piling up against the walls.
// Heavier per-body than Arcade (full rigid-body solver), so capacity is lower.
export class MatterBench extends BenchScene {
  protected readonly benchId = 'matter';

  constructor() {
    super({
      key: 'MatterBench',
      physics: { matter: { gravity: { x: 0, y: 1 }, debug: false } },
    });
    this.targetFps = 45;
    this.stepSize = 60;
  }

  protected setup() {
    const { width, height } = this.scale;
    addGradientBackground(this, '#0d2c33', '#06121a');
    this.matter.world.setBounds(0, 0, width, height);
    // Native drag-and-drop: grab and fling any body with the pointer.
    this.matter.add.pointerConstraint({ stiffness: 0.2, length: 0 });
  }

  protected addObjects(n: number) {
    const { width } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(-200, 40);
      const useCircle = (i & 1) === 0;
      const img = this.matter.add.image(x, y, useCircle ? 'ball' : 'box');
      if (useCircle) {
        img.setCircle(16);
      }
      img.setBounce(0.35);
      img.setFriction(0.05);
      img.setTint(MATTER_TINTS[i % MATTER_TINTS.length]!);
    }
  }
}
