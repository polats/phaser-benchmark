import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';
import { preloadHoloCards, createHoloCard, HOLO_CARD_SLUGS, type HoloCard } from '../lib/holoCard';

// Holographic trading cards in Phaser 4 — the 2D companion to the Three.js holo
// bench. Each card is a normal-mapped, Light2D-lit art layer (real emboss that
// shifts under a pointer-following light) plus an additive foil pass. A gentle
// ramp fills a responsive fan of cards that all tilt toward the cursor.
export class HoloCardsBench extends BenchScene {
  protected readonly benchId = 'holo-cards';
  private cards: HoloCard[] = [];
  private mouseLight!: Phaser.GameObjects.Light;
  private slugs = HOLO_CARD_SLUGS;

  constructor() {
    super({ key: 'HoloCardsBench' });
    this.targetFps = 55;
    this.stepSize = 3; // seed a fan immediately, then ramp; cards shrink to fit
    this.maxCount = 60;
  }

  preload() {
    preloadHoloCards(this, this.slugs);
  }

  protected setup() {
    addGradientBackground(this, '#0a0c16', '#04050b');
    const { width, height } = this.scale;

    this.lights.enable();
    this.lights.setAmbientColor(0x3a3a46);
    // warm key light, plus a cool pointer light so the emboss tracks the cursor
    this.lights.addLight(width * 0.28, height * 0.26, 700, 0xfff0e0, 1.3);
    this.mouseLight = this.lights.addLight(width / 2, height / 2, 520, 0xbfc8ff, 2.2).setZNormal(0.55);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.mouseLight.x = p.x;
      this.mouseLight.y = p.y;
    });
  }

  protected addObjects(n: number) {
    for (let i = 0; i < n; i++) {
      const slug = this.slugs[this.cards.length % this.slugs.length]!;
      this.cards.push(createHoloCard(this, slug));
    }
    this.layout();
  }

  private layout() {
    const { width, height } = this.scale;
    const n = this.cards.length;
    if (!n) return;
    const availW = width * 0.96;
    const availH = height * 0.92;
    const aspect = 336 / 240;
    // pick the column count that maximizes card size while fitting all n on screen,
    // so the grid simply shrinks (zooms out) as more cards are added.
    let best = { size: 0, cols: 1 };
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const size = Math.min(availW / cols, availH / rows / aspect) * 0.9;
      if (size > best.size) best = { size, cols };
    }
    const cols = best.cols;
    const rows = Math.ceil(n / cols);
    const scale = best.size / 240;
    const gapX = availW / cols;
    const gapY = availH / rows;
    const startX = width / 2 - (gapX * (cols - 1)) / 2;
    const startY = height / 2 - (gapY * (rows - 1)) / 2;
    this.cards.forEach((c, i) => {
      c.place(startX + (i % cols) * gapX, startY + Math.floor(i / cols) * gapY, scale);
    });
  }

  protected override onUpdate() {
    const t = this.time.now;
    const p = this.input.activePointer;
    const { width, height } = this.scale;
    for (const c of this.cards) {
      const dx = Phaser.Math.Clamp(((p.x - c.container.x) / width) * 2.4, -1, 1);
      const dy = Phaser.Math.Clamp(((p.y - c.container.y) / height) * 2.4, -1, 1);
      c.setTilt(dx, dy);
      c.update(t);
    }
  }

  override shutdown() {
    super.shutdown();
    this.cards = [];
  }
}
