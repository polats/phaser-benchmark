import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { type Upgrade, RARITY_COLOR, RARITY_EDITION } from '../upgrades';
import { SWIRL_FRAG, EDITION_FRAG } from '../lib/cardShaders';

// The paused level-up overlay. Renders a Balatro-style swirl background and a row
// of upgrade cards with: rarity edition shaders (foil/holo/polychrome), an idle
// sway, a fake-3D tilt toward the cursor (with the edition highlight tracking the
// tilt), spring-in on draw, and a sparkle + pop on pick. Launched over the paused
// game; calls back `onPick` with the chosen upgrade, then stops itself.
type CardSelectData = { choices: Upgrade[]; onPick: (u: Upgrade) => void };

type Card = {
  upgrade: Upgrade;
  root: GameObjects.Container;
  edition: GameObjects.Shader | null;
  baseX: number;
  baseY: number;
  phase: number;
  hover: number;
  wasOver: boolean;
};

const CARD_W = 190;
const CARD_H = 270;

export class CardSelect extends Scene {
  private payload!: CardSelectData;
  private cards: Card[] = [];
  private bg!: GameObjects.Shader;
  private sparkle!: GameObjects.Particles.ParticleEmitter;
  private picked = false;

  constructor() {
    super('CardSelect');
  }

  init(data: CardSelectData) {
    this.payload = data;
    this.picked = false;
    this.cards = [];
  }

  create() {
    const { width, height } = this.scale;

    // Swirl background + a dim veil so the cards pop.
    this.bg = this.add
      .shader(
        { name: 'card-swirl', fragmentSource: SWIRL_FRAG, initialUniforms: { uTime: 0, uResolution: [width, height] } },
        width / 2,
        height / 2,
        width,
        height
      )
      .setDepth(-10);
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.4).setDepth(-9);

    this.add
      .text(width / 2, height * 0.16, 'LEVEL UP', {
        fontFamily: 'Arial Black',
        fontSize: 44,
        color: '#ffd166',
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(20);
    this.add
      .text(width / 2, height * 0.16 + 42, 'choose an upgrade', {
        fontFamily: 'Arial',
        fontSize: 18,
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(20);

    this.sparkle = this.add
      .particles(0, 0, 'glow', {
        lifespan: 420,
        speed: { min: 40, max: 220 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(30);

    const n = this.payload.choices.length;
    const gap = Math.min(CARD_W + 30, (width * 0.92) / n);
    const startX = width / 2 - (gap * (n - 1)) / 2;
    const cy = height * 0.56;

    this.payload.choices.forEach((up, i) => {
      const x = startX + gap * i;
      const card = this.buildCard(up, x, cy);
      this.cards.push(card);
      // spring-in, staggered
      card.root.setScale(0.6).setAlpha(0).setY(cy + 70);
      this.tweens.add({
        targets: card.root,
        scale: 1,
        alpha: 1,
        y: cy,
        ease: 'Back.easeOut',
        duration: 460,
        delay: 90 * i,
      });
    });
  }

  private buildCard(up: Upgrade, x: number, y: number): Card {
    const color = RARITY_COLOR[up.rarity];
    const root = this.add.container(x, y).setDepth(1);

    // soft shadow
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 16, CARD_W, CARD_H, 14);

    // rarity glow behind the panel (rare+)
    const extras: GameObjects.GameObject[] = [];
    if (up.rarity !== 'common') {
      const glow = this.add
        .image(0, 0, 'glow')
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(CARD_W / 90, CARD_H / 90)
        .setAlpha(0.5);
      this.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
      extras.push(glow);
    }

    // panel
    const panel = this.add.graphics();
    panel.fillStyle(0x141018, 0.96);
    panel.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);
    panel.lineStyle(3, color, 1);
    panel.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);

    const rarityLabel = this.add
      .text(0, -CARD_H / 2 + 16, up.rarity.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: 12,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(0.5);

    const icon = this.add.image(0, -CARD_H * 0.2, up.icon.tex).setTint(up.icon.tint).setScale(1.6);
    const iconGlow = this.add
      .image(0, -CARD_H * 0.2, 'glow')
      .setTint(up.icon.tint)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(1.2)
      .setAlpha(0.6);

    const name = this.add
      .text(0, CARD_H * 0.06, up.name, {
        fontFamily: 'Arial Black',
        fontSize: 19,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(0, CARD_H * 0.24, up.desc, {
        fontFamily: 'Arial',
        fontSize: 15,
        color: '#cfd6e0',
        align: 'center',
        wordWrap: { width: CARD_W - 28 },
      })
      .setOrigin(0.5);

    root.add([shadow, ...extras, panel, iconGlow, icon, rarityLabel, name, desc]);

    // edition shimmer (rare+), an additive shader quad synced to the card.
    let edition: GameObjects.Shader | null = null;
    const mode = RARITY_EDITION[up.rarity];
    if (mode >= 0) {
      edition = this.add
        .shader(
          {
            name: `edition-${up.id}`,
            fragmentSource: EDITION_FRAG,
            initialUniforms: { uTime: 0, uMode: mode, uTilt: [0, 0] },
          },
          x,
          y,
          CARD_W - 14,
          CARD_H - 14
        )
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(2);
    }

    root.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );
    const card: Card = { upgrade: up, root, edition, baseX: x, baseY: y, phase: Math.random() * 6.28, hover: 0, wasOver: false };
    root.on('pointerdown', () => this.pick(card));
    return card;
  }

  private pick(card: Card) {
    if (this.picked) return;
    this.picked = true;
    this.sparkle.explode(28, card.baseX, card.baseY);
    this.cameras.main.flash(180, 255, 230, 180);
    this.tweens.add({ targets: card.root, scale: 1.25, duration: 160, ease: 'Quad.easeOut' });
    for (const c of this.cards) {
      if (c !== card) this.tweens.add({ targets: c.root, alpha: 0.15, scale: 0.9, duration: 160 });
    }
    this.time.delayedCall(230, () => {
      this.payload.onPick(card.upgrade);
      this.scene.stop();
    });
  }

  override update(time: number, _delta: number) {
    const t = time / 1000;
    this.bg.setUniform('uTime', t);
    if (this.picked) return;

    const p = this.input.activePointer;
    for (const card of this.cards) {
      const halfW = CARD_W / 2;
      const halfH = CARD_H / 2;
      const over = Math.abs(p.x - card.baseX) < halfW && Math.abs(p.y - card.baseY) < halfH;
      card.hover = Phaser.Math.Linear(card.hover, over ? 1 : 0, 0.18);

      let tiltX = 0;
      let tiltY = 0;
      if (over) {
        tiltX = Phaser.Math.Clamp((p.x - card.baseX) / halfW, -1, 1);
        tiltY = Phaser.Math.Clamp((p.y - card.baseY) / halfH, -1, 1);
        if (!card.wasOver) this.sparkle.explode(8, card.baseX, card.baseY);
      }
      card.wasOver = over;

      // idle sway when not hovered, tilt toward cursor when hovered
      const idle = Math.sin(t + card.phase) * 0.03 * (1 - card.hover);
      card.root.rotation = idle + tiltX * 0.12 * card.hover;
      card.root.setScale(1 + 0.08 * card.hover);
      card.root.y = card.baseY - 18 * card.hover;

      if (card.edition) {
        card.edition.setUniform('uTime', t);
        card.edition.setUniform('uTilt', [tiltX, tiltY]);
        card.edition.setPosition(card.root.x, card.root.y);
        card.edition.rotation = card.root.rotation;
        card.edition.setScale(card.root.scaleX);
      }
    }
  }
}
