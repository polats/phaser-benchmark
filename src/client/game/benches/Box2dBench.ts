import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import {
  bindDynamicSprite,
  bindStaticSprite,
  createWorld,
  initWorldScale,
  removeSpriteFromWorld,
  setBodyVelocity,
  stepWorld,
  syncSprites,
} from '../physics/box2d';
import { addGradientBackground } from '../lib/look';
import { enablePointerDrag } from './pointerDrag';

// Phaser Box2D v3 stress: deterministic dynamic bodies dropping into a visible
// bowl and piling up. Box2D runs as a separate world; we bind a Phaser sprite to
// each body and sync them every frame. Bodies spawn inside the visible area so
// the simulation reads clearly.
const WARM = [0xffb703, 0xfb8500, 0xff6b6b, 0xf4a261, 0xe9c46a];

export class Box2dBench extends BenchScene {
  protected readonly benchId = 'box2d';
  private worldId: unknown = null;
  private bodies: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super({ key: 'Box2dBench' });
    this.targetFps = 45;
    this.stepSize = 50;
  }

  protected setup() {
    const { width, height } = this.scale;
    addGradientBackground(this, '#241a3a', '#0a0a16');

    initWorldScale();
    this.worldId = createWorld(-10); // gravity pulls toward the floor at the bottom

    // Container built from sprites bound as STATIC bodies, so the visuals are the
    // exact collision shapes (no pixel/meter drift between floor and bodies).
    const wallColor = 0x3a3358;
    const floorThickness = 60;
    const wallThickness = 36;
    const mkWall = (x: number, y: number, w: number, h: number) => {
      const s = this.add.sprite(x, y, 'box').setDisplaySize(w, h).setTint(wallColor).setDepth(-10);
      bindStaticSprite(this.worldId, s);
    };
    mkWall(width / 2, height - floorThickness / 2, width, floorThickness);
    mkWall(wallThickness / 2, height / 2, wallThickness, height);
    mkWall(width - wallThickness / 2, height / 2, wallThickness, height);

    this.bodies = [];
    // Drag-and-drop: on grab, unbind the body so the sprite follows the pointer
    // 1:1 (no physics fighting it); on release, re-create the body from the
    // sprite's new position and fling it. This is the robust path — bodies are
    // only ever created via SpriteToBox, so there's no coordinate drift (an
    // earlier setTransform-based version teleported bodies off-screen on tap).
    enablePointerDrag<Phaser.GameObjects.Sprite>({
      scene: this,
      grabRadius: 34,
      items: () => this.bodies,
      onGrab: (s) => removeSpriteFromWorld(this.worldId, s),
      onMove: (s, x, y) => s.setPosition(x, y),
      onRelease: (s, vx, vy) => {
        const id = bindDynamicSprite(this.worldId, s);
        s.setData('bodyId', id);
        setBodyVelocity(id, vx * 60, vy * 60);
      },
    });
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(60, width - 60);
      const y = Phaser.Math.Between(Math.round(height * 0.05), Math.round(height * 0.4));
      const sprite = this.add
        .sprite(x, y, (i & 1) === 0 ? 'box' : 'ball')
        .setScale(Phaser.Math.FloatBetween(0.6, 1))
        .setTint(WARM[i % WARM.length]!);
      const bodyId = bindDynamicSprite(this.worldId, sprite);
      sprite.setData('bodyId', bodyId);
      this.bodies.push(sprite);
    }
  }

  protected override onUpdate() {
    if (!this.worldId) return;
    stepWorld(this.worldId);
    syncSprites(this.worldId);
  }
}
