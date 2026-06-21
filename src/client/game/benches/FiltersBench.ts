import * as Phaser from 'phaser';
import type { Cameras } from 'phaser';
import { BenchScene } from './BenchScene';

// Phaser 4's unified filter system: any number of filters can be stacked on a
// camera. Each filter is a full-screen pass, so this bench measures fragment
// fillrate — usually the first wall you hit on mobile. We stack one more filter
// per second (cycling through the built-ins) until FPS drops.
//
// Docs: https://phaser.io/news/2026/05/phaser-4-filter-system
const FILTER_CYCLE: ((list: Cameras.Scene2D.Camera['filters']['internal']) => void)[] = [
  (f) => void f.addBlur(),
  (f) => void f.addGlow(),
  (f) => void f.addVignette(),
  (f) => void f.addBarrel(),
  (f) => void f.addColorMatrix(),
  (f) => void f.addBokeh(),
  (f) => void f.addTiltShift(),
  (f) => void f.addPixelate(),
];

export class FiltersBench extends BenchScene {
  protected readonly benchId = 'filters';

  constructor() {
    super({ key: 'FiltersBench' });
    this.targetFps = 50;
    // "count" here = number of stacked filter passes.
    this.stepSize = 1;
    this.maxCount = 64;
  }

  protected setup() {
    const { width, height } = this.scale;

    // Give the filters something lively to chew on.
    for (let i = 0; i < 140; i++) {
      const star = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 'star')
        .setScale(Phaser.Math.FloatBetween(0.6, 1.8));
      this.tweens.add({
        targets: star,
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        angle: 360,
        duration: Phaser.Math.Between(1800, 4200),
        yoyo: true,
        repeat: -1,
      });
    }

    this.add
      .text(width / 2, height / 2, 'FILTERS', {
        fontFamily: 'Arial Black',
        fontSize: 72,
        color: '#ffd166',
      })
      .setOrigin(0.5);
  }

  protected addObjects(n: number) {
    const internal = this.cameras.main.filters.internal;
    for (let i = 0; i < n; i++) {
      const add = FILTER_CYCLE[this.count % FILTER_CYCLE.length]!;
      add(internal);
    }
  }
}
