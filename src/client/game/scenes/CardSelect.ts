import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { type Upgrade, RARITY_COLOR, RARITY_EDITION } from '../upgrades';
import { SWIRL_FRAG, EDITION_FRAG } from '../lib/cardShaders';

// The level-up overlay. The game keeps running underneath in bullet-time (not
// paused); this draws a swirl-backed card tray along the BOTTOM of the screen,
// sized responsively so it fits phones. Cards have rarity edition shaders
// (foil/holo/polychrome), an idle sway, a fake-3D tilt toward the cursor, a
// spring-in on draw, and a sparkle + pop on pick. Calls back onPick, then stops.
type CardSelectData = { choices: Upgrade[]; onPick: (u: Upgrade) => void };

type Card = {
  upgrade: Upgrade;
  root: GameObjects.Container;
  edition: GameObjects.Shader | null;
  baseX: number;
  baseY: number;
  scale: number;
  phase: number;
  hover: number;
  ready: boolean;
  wasOver: boolean;
};

const CARD_W = 188;
const CARD_H = 240;

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
    const n = this.payload.choices.length;

    // Responsive bottom tray: scale cards so `n` fit the width and the tray height.
    const bandH = Math.min(height * 0.46, CARD_H + 64);
    const cardScale = Math.min(
      1,
      ((width * 0.94) / n - 14) / CARD_W,
      (bandH - 34) / CARD_H
    );
    const bandTop = height - bandH;
    const cy = height - 8 - (CARD_H * cardScale) / 2;
    const gap = (width * 0.94) / n;
    const startX = width / 2 - (gap * (n - 1)) / 2;

    // Full-screen swirl shader behind the whole level-up screen. It outputs a
    // sub-1 alpha so the slowed game keeps showing through — showcasing the
    // shader across the background while you choose.
    this.bg = this.add
      .shader(
        {
          name: 'card-swirl',
          fragmentSource: SWIRL_FRAG,
          initialUniforms: { uTime: 0, uResolution: [width, height], uAlpha: 0.55 },
        },
        width / 2,
        height / 2,
        width,
        height
      )
      .setDepth(-10);
    // Darker panel just behind the card tray so the cards stay readable.
    this.add.rectangle(width / 2, bandTop + bandH / 2, width, bandH, 0x000000, 0.45).setDepth(-9);
    this.add.rectangle(width / 2, bandTop, width, 2, 0xffd166, 0.6).setDepth(-9);

    this.add
      .text(width / 2, bandTop + 8, 'LEVEL UP — choose an upgrade', {
        fontFamily: 'Arial Black',
        fontSize: 18,
        color: '#ffd166',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0)
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

    this.payload.choices.forEach((up, i) => {
      const x = startX + gap * i;
      const card = this.buildCard(up, x, cy, cardScale);
      this.cards.push(card);
      // spring-in, staggered (update() leaves the card alone until `ready`)
      card.root.setScale(cardScale * 0.6).setAlpha(0).setY(cy + 70);
      this.tweens.add({
        targets: card.root,
        scale: cardScale,
        alpha: 1,
        y: cy,
        ease: 'Back.easeOut',
        duration: 440,
        delay: 80 * i,
        onComplete: () => (card.ready = true),
      });
    });
  }

  private buildCard(up: Upgrade, x: number, y: number, cardScale: number): Card {
    const color = RARITY_COLOR[up.rarity];
    const root = this.add.container(x, y).setDepth(1);

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.45);
    shadow.fillRoundedRect(-CARD_W / 2 + 6, -CARD_H / 2 + 14, CARD_W, CARD_H, 14);

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

    const panel = this.add.graphics();
    panel.fillStyle(0x141018, 0.96);
    panel.fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);
    panel.lineStyle(3, color, 1);
    panel.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);

    const rarityLabel = this.add
      .text(0, -CARD_H / 2 + 14, up.rarity.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: 12,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
      })
      .setOrigin(0.5);

    const iconObjs = this.buildIcon(up, -CARD_H * 0.22);

    const name = this.add
      .text(0, CARD_H * 0.04, up.name, {
        fontFamily: 'Arial Black',
        fontSize: 18,
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: CARD_W - 24 },
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(0, CARD_H * 0.24, up.desc, {
        fontFamily: 'Arial',
        fontSize: 14,
        color: '#cfd6e0',
        align: 'center',
        wordWrap: { width: CARD_W - 28 },
      })
      .setOrigin(0.5);

    root.add([shadow, ...extras, panel, ...iconObjs, rarityLabel, name, desc]);

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
    const card: Card = {
      upgrade: up,
      root,
      edition,
      baseX: x,
      baseY: y,
      scale: cardScale,
      phase: Math.random() * 6.28,
      hover: 0,
      ready: false,
      wasOver: false,
    };
    root.on('pointerdown', () => this.pick(card));
    return card;
  }

  // Which animated icon a card shows (weapons preview their effect).
  private fxKind(up: Upgrade): string {
    const map: Record<string, string> = {
      'w-bolt': 'bolt',
      'w-orbit': 'orbit',
      'w-nova': 'nova',
      'w-singularity': 'singularity',
      'w-ricochet': 'ricochet',
      'syn-orbital-nova': 'orbit',
    };
    return map[up.id] ?? (up.icon.tex === 'star' ? 'spin' : 'pulse');
  }

  // Build a small ANIMATED icon for a card: weapons preview their motion (orbiting
  // orbs, an expanding nova ring, a collapsing singularity, a bouncing ricochet,
  // a firing bolt); passives spin or pulse. Returns the objects to add to the card.
  private buildIcon(up: Upgrade, iy: number): GameObjects.GameObject[] {
    const tint = up.icon.tint;
    const ADD = Phaser.BlendModes.ADD;
    const objs: GameObjects.GameObject[] = [];

    const glow = this.add.image(0, iy, 'glow').setTint(tint).setBlendMode(ADD).setScale(1.1).setAlpha(0.55);
    this.tweens.add({ targets: glow, scale: 1.45, alpha: 0.28, duration: 1000, yoyo: true, repeat: -1 });
    objs.push(glow);

    switch (this.fxKind(up)) {
      case 'orbit': {
        objs.push(this.add.image(0, iy, 'ball').setTint(tint).setBlendMode(ADD).setScale(0.7));
        const orbs = [0, 1, 2].map(() => this.add.image(0, iy, 'dot').setTint(tint).setBlendMode(ADD).setScale(0.7));
        objs.push(...orbs);
        this.tweens.addCounter({
          from: 0,
          to: Math.PI * 2,
          duration: 1700,
          repeat: -1,
          onUpdate: (t) => {
            const a = t.getValue() ?? 0;
            orbs.forEach((o, i) => o.setPosition(Math.cos(a + i * 2.094) * 18, iy + Math.sin(a + i * 2.094) * 18));
          },
        });
        break;
      }
      case 'nova': {
        objs.push(this.add.image(0, iy, 'glow').setTint(tint).setBlendMode(ADD).setScale(0.45));
        const r = this.add.image(0, iy, 'ring').setTint(tint).setBlendMode(ADD).setScale(0.2);
        objs.push(r);
        this.tweens.add({
          targets: r,
          scale: 1.3,
          alpha: { from: 1, to: 0 },
          duration: 1100,
          repeat: -1,
          onRepeat: () => r.setScale(0.2).setAlpha(1),
        });
        break;
      }
      case 'singularity': {
        const r = this.add.image(0, iy, 'ring').setTint(tint).setBlendMode(ADD).setScale(1.3);
        const core = this.add.image(0, iy, 'glow').setTint(tint).setBlendMode(ADD).setScale(0.4);
        objs.push(r, core);
        this.tweens.add({
          targets: r,
          scale: 0.3,
          angle: 360,
          alpha: { from: 0.3, to: 1 },
          duration: 1200,
          repeat: -1,
          onRepeat: () => r.setScale(1.3).setAngle(0).setAlpha(0.3),
        });
        this.tweens.add({ targets: core, scale: 0.7, duration: 700, yoyo: true, repeat: -1 });
        break;
      }
      case 'ricochet': {
        const dot = this.add.image(0, iy, 'ring').setTint(tint).setBlendMode(ADD).setScale(0.55);
        objs.push(dot);
        this.tweens.add({ targets: dot, x: 20, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: dot, y: iy - 14, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        break;
      }
      case 'bolt': {
        objs.push(this.add.image(0, iy, up.icon.tex).setTint(tint).setBlendMode(ADD).setScale(1.3));
        const shot = this.add.image(0, iy, 'dot').setTint(0xffffff).setBlendMode(ADD).setScale(0.6);
        objs.push(shot);
        this.tweens.add({
          targets: shot,
          y: iy - 26,
          alpha: { from: 1, to: 0 },
          duration: 460,
          repeat: -1,
          onRepeat: () => shot.setPosition(0, iy).setAlpha(1),
        });
        break;
      }
      case 'spin': {
        const core = this.add.image(0, iy, up.icon.tex).setTint(tint).setScale(1.5);
        objs.push(core);
        this.tweens.add({ targets: core, angle: 360, duration: 2600, repeat: -1 });
        break;
      }
      default: {
        const core = this.add.image(0, iy, up.icon.tex).setTint(tint).setScale(1.4);
        objs.push(core);
        this.tweens.add({ targets: core, scale: 1.65, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }
    return objs;
  }

  private pick(card: Card) {
    if (this.picked) return;
    this.picked = true;
    this.sparkle.explode(28, card.baseX, card.baseY);
    this.cameras.main.flash(180, 255, 230, 180);
    this.tweens.add({ targets: card.root, scale: card.scale * 1.25, duration: 160, ease: 'Quad.easeOut' });
    for (const c of this.cards) {
      if (c !== card) this.tweens.add({ targets: c.root, alpha: 0.15, scale: c.scale * 0.9, duration: 160 });
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
      if (card.edition) {
        card.edition.setUniform('uTime', t);
      }
      if (!card.ready) continue;

      const halfW = (CARD_W * card.scale) / 2;
      const halfH = (CARD_H * card.scale) / 2;
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

      const idle = Math.sin(t + card.phase) * 0.03 * (1 - card.hover);
      card.root.rotation = idle + tiltX * 0.12 * card.hover;
      card.root.setScale(card.scale * (1 + 0.1 * card.hover));
      card.root.y = card.baseY - 22 * card.hover;

      if (card.edition) {
        card.edition.setUniform('uTilt', [tiltX, tiltY]);
        card.edition.setPosition(card.root.x, card.root.y);
        card.edition.rotation = card.root.rotation;
        card.edition.setScale(card.root.scaleX);
      }
    }
  }
}
