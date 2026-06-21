import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { startBenchReadout } from './fpsReadout';

// Official Phaser demo "GPU Animated Sprites" by PhotonStorm (sandbox enjM3mHc),
// ported to Phaser 4.2. Thousands of frame-animated sprites drift across the
// screen, animation + movement driven entirely on the GPU.
//
// 4.2 change: SpriteGPULayer member `animation` is now a string key (not the
// {base,duration,delay} object the 4.0-beta demo used); per-member frame timing
// is configured via setAnimations instead.
type Member = Partial<Phaser.Types.GameObjects.SpriteGPULayer.Member>;

const COUNT = 1024 * 4;

export class GpuAnimatedDemo extends Scene {
  constructor() {
    super('GpuAnimatedDemo');
  }

  preload() {
    this.load.image('demo-sky', 'assets/skies/bigsky.png');
    this.load.path = 'assets/atlas/trimsheet/';
    this.load.atlas('testanims', 'trimsheet.png', 'trimsheet.json');
    this.load.path = '';
  }

  create() {
    const { width, height } = this.scale;
    this.add.image(0, 0, 'demo-sky').setOrigin(0, 0).setDisplaySize(width, height);

    this.textures.addSpriteSheetFromAtlas('bubble2', {
      atlas: 'testanims',
      frame: 'bubble',
      frameWidth: 34,
      frameHeight: 68,
    });

    const anim = this.anims.create({
      key: 'bobble2',
      frames: this.anims.generateFrameNumbers('bubble2', { start: 0, end: 6 }),
      frameRate: 10,
    });

    const layer = this.add.spriteGPULayer('testanims', COUNT);
    if (anim) layer.setAnimations([anim]);

    for (let i = 0; i < COUNT; i++) {
      const scale = (COUNT + i) / (COUNT * 2);
      const member: Member = {
        animation: 'bobble2',
        x: {
          base: -100,
          ease: 'Linear',
          amplitude: 1400,
          yoyo: false,
          duration: (Math.random() * 10000 + 10000) / scale,
          delay: Math.random() * 40000,
        },
        y: 32 + (650 * i) / COUNT,
        scaleX: scale,
        scaleY: scale,
      };
      layer.addMember(member);
    }

    startBenchReadout(this, 'demo-anim', COUNT);
  }
}
