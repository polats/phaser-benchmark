import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

const TINTS = [0x6ad1ff, 0x9b8cff, 0x66ffcc, 0xff9ed8, 0xffe066];

// Tween-engine stress (CPU): every object carries an infinite yoyo tween, so the
// TweenManager re-evaluates `count` tweens every frame. Pure engine throughput —
// the rendered objects are cheap so the cost is the tween update loop.
export class TweensBench extends BenchScene {
  protected readonly benchId = 'tweens';

  constructor() {
    super({ key: 'TweensBench' });
    this.stepSize = 500;
  }

  protected setup() {
    addGradientBackground(this, '#241a4a', '#080a16');
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const img = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 'star')
        .setTint(TINTS[i % TINTS.length]!)
        .setScale(0.5);
      this.tweens.add({
        targets: img,
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        scale: 0.2 + Math.random() * 0.8,
        angle: 360,
        duration: 800 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }
}
