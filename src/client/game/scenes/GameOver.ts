import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { GameEvents } from '../events';

type GameOverData = { score?: number };

export class GameOver extends Scene {
  private score = 0;
  private title!: GameObjects.Text;
  private scoreText!: GameObjects.Text;
  private again!: GameObjects.Text;

  constructor() {
    super('GameOver');
  }

  init(data: GameOverData) {
    this.score = data.score ?? 0;
  }

  create() {
    this.title = this.add
      .text(0, 0, 'Time!', {
        fontFamily: 'Arial Black',
        fontSize: 56,
        color: '#ef6f6c',
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.scoreText = this.add
      .text(0, 0, `Score: ${this.score}`, {
        fontFamily: 'Arial Black',
        fontSize: 36,
        color: '#ffd166',
      })
      .setOrigin(0.5);

    this.again = this.add
      .text(0, 0, 'tap to play again', {
        fontFamily: 'Arial',
        fontSize: 22,
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.input.once('pointerdown', () => this.scene.start('MainMenu'));

    this.layout();
    this.scale.on('resize', this.layout, this);

    EventBus.emit(GameEvents.SceneReady, this);
  }

  private layout() {
    const { width, height } = this.scale;
    this.title.setPosition(width / 2, height * 0.38);
    this.scoreText.setPosition(width / 2, height * 0.5);
    this.again.setPosition(width / 2, height * 0.62);
  }

  shutdown() {
    this.scale.off('resize', this.layout, this);
  }
}
