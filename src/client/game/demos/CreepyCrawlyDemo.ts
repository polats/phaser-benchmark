import * as Phaser from 'phaser';
import { Scene, type GameObjects } from 'phaser';
import { startBenchReadout } from './fpsReadout';

// Official Phaser demo "Creepy Crawly" by PhotonStorm (sandbox UvCabgF5), ported
// to Phaser 4.2. ~8k normal-mapped spiders on a SpriteGPULayer, lit by several
// dynamic lights (including a pointer-following one) over a normal-mapped tiled
// floor, with an animated camera. Combines GPU batching + lighting + normal maps.
type Member = Partial<Phaser.Types.GameObjects.SpriteGPULayer.Member>;

const COUNT = 1024 * 8;

export class CreepyCrawlyDemo extends Scene {
  private mouseLight!: GameObjects.Light;

  constructor() {
    super('CreepyCrawlyDemo');
  }

  preload() {
    this.load.image('spider', ['assets/normal-maps/spider.png', 'assets/normal-maps/spider_n.png']);
    this.load.image('stones', ['assets/normal-maps/stones.png', 'assets/normal-maps/stones_n_standard.png']);
  }

  create() {
    this.cameras.main.setBackgroundColor('#000000');

    this.lights.enable();
    this.lights.addLight(-1000, -300, 3000, 0x8844bb, 1);
    this.lights.addLight(500, -1000, 3000, 0x888888, 1);
    this.lights.addLight(1800, -300, 3000, 0x44ff44, 1);
    this.lights.addLight(400, 1600, 2000, 0xffbb88, 3);
    this.lights.addLight(400, 800, 600, 0xffbb88, 3).setZNormal(0.5);
    this.mouseLight = this.lights.addLight(0, 0, 256, 0xbbbbff, 3).setZNormal(0.5);

    this.add.tileSprite(-1280, 720, 1280 * 4, 720 * 4, 'stones').setLighting(true);

    const layer = this.add.spriteGPULayer('spider', COUNT).setLighting(true);

    const centerX = 640;
    const centerY = 360;
    const radius = Math.sqrt(900 * 900 + 700 * 700);

    for (let i = 0; i < COUNT; i++) {
      const angle1 = Math.random() * Math.PI * 2;
      const angle2 = angle1 + (Math.random() + 0.5) * Math.PI;
      const startX = centerX + Math.cos(angle1) * radius;
      const startY = centerY + Math.sin(angle1) * radius;
      const endX = centerX + Math.cos(angle2) * radius;
      const endY = centerY + Math.sin(angle2) * radius;
      const dx = endX - startX;
      const dy = endY - startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = 20 + Math.random() * 6;
      const duration = (1000 * distance) / velocity;
      const delay = Math.random() * duration;
      const scale = 0.03 + Math.random() * Math.random() * 0.1;

      const member: Member = {
        x: { base: startX, ease: 'Linear', amplitude: dx, duration, delay, yoyo: false },
        y: { base: startY, ease: 'Linear', amplitude: dy, duration, delay, yoyo: false },
        // Sprites face DOWN, a quarter turn above standard.
        rotation: {
          base: Math.atan2(dy, dx) - 0.1 - Math.PI / 2,
          ease: 'Smoothstep.easeInOut',
          amplitude: 0.2,
          duration: 160 + Math.random() * 80,
        },
        scaleX: scale,
        scaleY: scale,
      };
      layer.addMember(member);
    }

    startBenchReadout(this, 'demo-spiders', COUNT);
  }

  override update(time: number) {
    const camera = this.cameras.main;
    camera.setScroll(100 * Math.sin(time / 1000), 100 * Math.cos((time + 3456) / 1200));
    camera.setRotation(time / 10000);
    camera.setZoom(1 + 0.2 * (Math.sin(time / 1234) + 1));

    const vec = camera.getWorldPoint(this.input.mousePointer.x, this.input.mousePointer.y);
    this.mouseLight.x = vec.x;
    this.mouseLight.y = vec.y;
  }
}
