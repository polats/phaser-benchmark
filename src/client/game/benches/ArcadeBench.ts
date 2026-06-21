import * as Phaser from 'phaser';
import type { Physics } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';
import { enablePointerDrag } from './pointerDrag';

const ARCADE_TINTS = [0x6ad1ff, 0x9b8cff, 0x66ffcc, 0xff9ed8, 0xffe066];

// Arcade Physics stress: thousands of dynamic bodies bouncing off the world
// bounds. Exercises the cheap AABB integrator + bounds collision (CPU-bound).
export class ArcadeBench extends BenchScene {
  protected readonly benchId = 'arcade';
  private balls: Physics.Arcade.Image[] = [];

  constructor() {
    super({ key: 'ArcadeBench', physics: { arcade: { debug: false } } });
    this.stepSize = 400;
  }

  protected setup() {
    const { width, height } = this.scale;
    this.balls = [];
    addGradientBackground(this, '#1a1f4a', '#080a16');
    this.physics.world.setBounds(0, 0, width, height);
    this.scale.on('resize', this.onResize, this);

    // Drag-and-drop: grab the nearest ball, then fling it on release.
    enablePointerDrag<Physics.Arcade.Image>({
      scene: this,
      grabRadius: 28,
      items: () => this.balls,
      onMove: (img, x, y) => {
        img.setPosition(x, y);
        img.setVelocity(0, 0);
      },
      onRelease: (img, vx, vy) => img.setVelocity(vx * 50, vy * 50),
    });
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(20, height - 20);
      const img = this.physics.add.image(x, y, 'dot');
      img.setCollideWorldBounds(true);
      img.setBounce(1, 1);
      img.setVelocity(Phaser.Math.Between(-260, 260), Phaser.Math.Between(-260, 260));
      img.setTint(ARCADE_TINTS[i % ARCADE_TINTS.length]!);
      this.balls.push(img);
    }
  }

  private onResize() {
    this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height);
  }

  override shutdown() {
    super.shutdown();
    this.scale.off('resize', this.onResize, this);
  }
}
