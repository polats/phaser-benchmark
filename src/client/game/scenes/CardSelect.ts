import * as Phaser from 'phaser';
import { Scene, GameObjects } from 'phaser';
import { type Upgrade, RARITY_COLOR } from '../upgrades';
import { SWIRL_FRAG } from '../lib/cardShaders';
import { preloadHoloCards, HOLO_CARD_SLUGS } from '../lib/holoCard';

// The level-up overlay. The game keeps running underneath in bullet-time (not
// paused); this draws a swirl-backed card tray along the BOTTOM of the screen,
// sized responsively so it fits phones. Cards have rarity edition shaders
// (foil/holo/polychrome), an idle sway, a fake-3D tilt toward the cursor, a
// spring-in on draw, and a sparkle + pop on pick. Calls back onPick, then stops.
type CardSelectData = { choices: Upgrade[]; onPick: (u: Upgrade) => void };

type Card = {
  upgrade: Upgrade;
  root: GameObjects.Container;
  foil: GameObjects.Image; // additive holo-mask pass; hue/strength shift with tilt
  baseX: number;
  baseY: number;
  scale: number;
  phase: number;
  hover: number;
  ready: boolean;
  wasOver: boolean;
};

// Each upgrade maps to the themed holo card art that fits it.
const UPGRADE_ART: Record<string, string> = {
  'w-bolt': 'plasma-bolt',
  'w-orbit': 'orbit',
  'w-nova': 'nova-blast',
  'w-ricochet': 'ricochet',
  'w-singularity': 'singularity',
  'syn-orbital-nova': 'orbital-nova',
  fangs: 'power-core',
  overcharge: 'power-core',
  glasscannon: 'power-core',
  bigbang: 'nova-blast',
  rapid: 'overclock',
  velocity: 'overclock',
  crit: 'critical-eye',
  greed: 'plunder',
};

function slugFor(up: Upgrade): string {
  if (UPGRADE_ART[up.id]) return UPGRADE_ART[up.id]!;
  let h = 0;
  for (let i = 0; i < up.id.length; i++) h = (h * 31 + up.id.charCodeAt(i)) | 0;
  return HOLO_CARD_SLUGS[Math.abs(h) % HOLO_CARD_SLUGS.length]!;
}

const CARD_W = 188;
const CARD_H = 240;

export class CardSelect extends Scene {
  private payload!: CardSelectData;
  private cards: Card[] = [];
  private bg!: GameObjects.Shader;
  private sparkle!: GameObjects.Particles.ParticleEmitter;
  private picked = false;
  private cardLight!: GameObjects.Light;

  constructor() {
    super('CardSelect');
  }

  preload() {
    preloadHoloCards(this);
  }

  init(data: CardSelectData) {
    this.payload = data;
    this.picked = false;
    this.cards = [];
  }

  create() {
    const { width, height } = this.scale;
    const n = this.payload.choices.length;

    // Light2D so the holo card art shows real normal-mapped emboss; a single
    // light tracks the cursor so the relief shifts as you hover the tray.
    this.lights.enable();
    this.lights.setAmbientColor(0x6e6e78);
    this.cardLight = this.lights.addLight(width / 2, height * 0.72, 560, 0xffffff, 1.5).setZNormal(0.5);

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

    // holo card face: normal-mapped art (lit by the cursor light) + additive foil
    const slug = slugFor(up);
    const art = this.add.image(0, 0, `holo:${slug}`).setDisplaySize(CARD_W, CARD_H);
    art.setLighting(true);
    const foil = this.add
      .image(0, 0, `holomask:${slug}`)
      .setDisplaySize(CARD_W, CARD_H)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);

    const frame = this.add.graphics();
    frame.lineStyle(3, color, 1);
    frame.strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 12);

    // readable tray for the upgrade name + description, over the lower third
    const trayH = CARD_H * 0.34;
    const trayY = CARD_H / 2 - trayH / 2 - 7;
    const tray = this.add.graphics();
    tray.fillStyle(0x0a0810, 0.82);
    tray.fillRoundedRect(-CARD_W / 2 + 8, trayY - trayH / 2, CARD_W - 16, trayH, 8);

    const rarityLabel = this.add
      .text(0, -CARD_H / 2 + 12, up.rarity.toUpperCase(), {
        fontFamily: 'Arial Black',
        fontSize: 11,
        color: Phaser.Display.Color.IntegerToColor(color).rgba,
        stroke: '#000',
        strokeThickness: 3,
      })
      .setOrigin(0.5);

    const name = this.add
      .text(0, trayY - trayH / 2 + 16, up.name, {
        fontFamily: 'Arial Black',
        fontSize: 15,
        color: '#ffffff',
        align: 'center',
        stroke: '#000',
        strokeThickness: 3,
        wordWrap: { width: CARD_W - 28 },
      })
      .setOrigin(0.5, 0.5);

    const desc = this.add
      .text(0, trayY + 4, up.desc, {
        fontFamily: 'Arial',
        fontSize: 12,
        color: '#cfd6e0',
        align: 'center',
        wordWrap: { width: CARD_W - 30 },
      })
      .setOrigin(0.5, 0);

    root.add([shadow, ...extras, art, foil, frame, tray, rarityLabel, name, desc]);

    root.setInteractive(
      new Phaser.Geom.Rectangle(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H),
      Phaser.Geom.Rectangle.Contains
    );
    const card: Card = {
      upgrade: up,
      root,
      foil,
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
    this.cardLight.x = p.x;
    this.cardLight.y = p.y;

    for (const card of this.cards) {
      if (!card.ready) continue;

      const halfW = (CARD_W * card.scale) / 2;
      const halfH = (CARD_H * card.scale) / 2;
      const over = Math.abs(p.x - card.baseX) < halfW && Math.abs(p.y - card.baseY) < halfH;
      card.hover = Phaser.Math.Linear(card.hover, over ? 1 : 0, 0.18);

      let tiltX = 0;
      if (over) {
        tiltX = Phaser.Math.Clamp((p.x - card.baseX) / halfW, -1, 1);
        if (!card.wasOver) this.sparkle.explode(8, card.baseX, card.baseY);
      }
      card.wasOver = over;

      const idle = Math.sin(t + card.phase) * 0.03 * (1 - card.hover);
      card.root.rotation = idle + tiltX * 0.12 * card.hover;
      card.root.setScale(card.scale * (1 + 0.1 * card.hover));
      card.root.y = card.baseY - 22 * card.hover;

      // foil shimmer — hue drifts with time + tilt, brighter on hover
      const hue = (t * 0.05 + tiltX * 0.22 + 0.5 + card.phase * 0.05) % 1;
      const col = Phaser.Display.Color.HSVToRGB(hue, 0.65, 1) as Phaser.Types.Display.ColorObject;
      card.foil.setTint(col.color ?? Phaser.Display.Color.GetColor(col.r, col.g, col.b));
      card.foil.setAlpha(0.16 + 0.5 * card.hover + 0.1 * Math.sin(t * 2 + card.phase));
    }
  }
}
