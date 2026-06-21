import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { EventBus } from '../EventBus';
import { GameEvents } from '../events';
import { addGradientBackground, applyVignette } from '../lib/look';

// A tiny but complete playable demo: tap the falling stars to score. It exists
// to exercise the full loop — input, scoring, and the score -> server ->
// leaderboard round trip via the React shell. Replace with your real game.
export class GameScene extends Scene {
  private score = 0;
  private scoreText!: GameObjects.Text;
  private timeLeft = 30;
  private timerText!: GameObjects.Text;
  private spawnEvent?: Phaser.Time.TimerEvent;
  private tickEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super('Game');
  }

  create() {
    this.score = 0;
    this.timeLeft = 30;

    addGradientBackground(this, '#1a2c52', '#0a0e1c');
    applyVignette(this.cameras.main);

    this.scoreText = this.add.text(16, 56, 'Score: 0', {
      fontFamily: 'Arial Black',
      fontSize: 28,
      color: '#ffd166',
    });
    this.timerText = this.add
      .text(0, 56, '0:30', {
        fontFamily: 'Arial Black',
        fontSize: 28,
        color: '#ffffff',
      })
      .setOrigin(1, 0);

    this.spawnEvent = this.time.addEvent({
      delay: 600,
      loop: true,
      callback: this.spawnStar,
      callbackScope: this,
    });
    this.tickEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.tick,
      callbackScope: this,
    });

    this.layout();
    this.scale.on('resize', this.layout, this);

    EventBus.emit(GameEvents.SceneReady, this);
  }

  private spawnStar() {
    const { width } = this.scale;
    const x = Phaser.Math.Between(40, width - 40);
    const star = this.add
      .image(x, -20, 'star')
      .setInteractive({ useHandCursor: true })
      .setScale(Phaser.Math.FloatBetween(0.8, 1.6));

    star.once('pointerdown', () => {
      this.score += 10;
      this.scoreText.setText(`Score: ${this.score}`);
      // Juicy glow burst on collect.
      const burst = this.add.pointlight(star.x, star.y, 0xffe066, 70, 1.2);
      this.tweens.add({
        targets: burst,
        radius: 170,
        intensity: 0,
        duration: 280,
        onComplete: () => burst.destroy(),
      });
      this.tweens.add({
        targets: star,
        scale: 0,
        duration: 120,
        onComplete: () => star.destroy(),
      });
    });

    this.tweens.add({
      targets: star,
      y: this.scale.height + 40,
      angle: Phaser.Math.Between(-180, 180),
      duration: Phaser.Math.Between(2200, 3600),
      onComplete: () => star.destroy(),
    });
  }

  private tick() {
    this.timeLeft -= 1;
    const m = Math.floor(this.timeLeft / 60);
    const s = (this.timeLeft % 60).toString().padStart(2, '0');
    this.timerText.setText(`${m}:${s}`);
    if (this.timeLeft <= 0) this.endGame();
  }

  private endGame() {
    this.spawnEvent?.remove();
    this.tickEvent?.remove();
    // Report the score to the React shell, which submits it to the server.
    EventBus.emit(GameEvents.Score, { score: this.score });
    this.scene.start('GameOver', { score: this.score });
  }

  private layout() {
    const { width } = this.scale;
    this.timerText.setPosition(width - 16, 56);
  }

  shutdown() {
    this.scale.off('resize', this.layout, this);
    this.spawnEvent?.remove();
    this.tickEvent?.remove();
  }
}
