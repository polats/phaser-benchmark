import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { GameEvents } from '../events';
import { addGradientBackground, applyVignette } from '../lib/look';

// Title screen. Tapping anywhere (or the Play button) starts the demo game.
// The React bench bar overlays on top, so this scene leaves the top-right clear.
export class MainMenu extends Scene {
  private title!: GameObjects.Text;
  private prompt!: GameObjects.Text;
  private titleGlow!: GameObjects.PointLight;

  constructor() {
    super('MainMenu');
  }

  create() {
    addGradientBackground(this, '#22356b', '#0a0e1c');
    applyVignette(this.cameras.main);

    // Soft warm glow behind the title (a self-illuminating PointLight — cheap, no
    // normal maps needed) for a bit of atmosphere.
    const glow = this.add.pointlight(0, 0, 0xffd166, 320, 0.6).setDepth(-500);
    this.tweens.add({ targets: glow, intensity: 0.35, duration: 1600, yoyo: true, repeat: -1 });
    this.titleGlow = glow;

    this.title = this.add
      .text(0, 0, 'reddit-phaser', {
        fontFamily: 'Arial Black',
        fontSize: 56,
        color: '#ffd166',
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.prompt = this.add
      .text(0, 0, 'tap to play', {
        fontFamily: 'Arial',
        fontSize: 24,
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.tweens.add({
      targets: this.prompt,
      alpha: 0.3,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });

    this.input.once('pointerdown', () => this.scene.start('Game'));

    this.layout();
    this.scale.on('resize', this.layout, this);

    EventBus.emit(GameEvents.SceneReady, this);
  }

  private layout() {
    const { width, height } = this.scale;
    this.title.setPosition(width / 2, height * 0.42);
    this.prompt.setPosition(width / 2, height * 0.56);
    this.titleGlow.setPosition(width / 2, height * 0.42);
  }

  shutdown() {
    this.scale.off('resize', this.layout, this);
  }
}
