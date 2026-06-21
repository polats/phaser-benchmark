import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { startBenchReadout } from './fpsReadout';

// Official Phaser demo "Bunny Bounce!" by PhotonStorm (sandbox 3J6qU2sy), ported
// to Phaser 4.2 + TypeScript. 1024 bunnies, each with multi-property GPU
// animation (squash/stretch/rotation/tint), all on one SpriteGPULayer.
type Member = Partial<Phaser.Types.GameObjects.SpriteGPULayer.Member>;

const COUNT = 1024;
const GAME_W = 1280;
const GAME_H = 720;

export class BunnyBounceDemo extends Scene {
  constructor() {
    super('BunnyBounceDemo');
  }

  preload() {
    this.load.image('bunny', 'assets/sprites/bunny.png');
  }

  create() {
    this.cameras.main.setBackgroundColor('#020280');
    const layer = this.add.spriteGPULayer('bunny', 1 + COUNT);

    for (let i = 0; i < COUNT; i++) {
      const phase = Math.random() * 500;
      const member: Member = {
        x: { base: Math.random() * GAME_W, ease: 'Linear', amplitude: -100, duration: 500, delay: phase },
        y: { base: GAME_H - Math.random() * 100, ease: 'Quad.easeOut', amplitude: -100, duration: 250, delay: phase },
        rotation: { base: -0.25, ease: 'Linear', amplitude: 0.5, duration: 500, delay: phase },
        scaleX: { base: 1.1, ease: 'Cubic.easeOut', amplitude: -0.1, duration: 250, delay: phase },
        scaleY: { base: 0.8, ease: 'Cubic.easeOut', amplitude: 0.2, duration: 250, delay: phase },
        originY: 1,
        tintBlend: { base: 1, ease: 'Quad.easeOut', amplitude: -1, duration: 500, delay: phase - 250 },
        tintTopLeft: 0xff0000,
        tintBottomLeft: 0x00ff00,
        tintTopRight: 0x0000ff,
        alphaBottomLeft: 0,
        alphaBottomRight: 0,
      };
      layer.addMember(member);
    }

    startBenchReadout(this, 'demo-bunny', COUNT);
  }
}
