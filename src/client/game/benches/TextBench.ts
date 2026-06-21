import * as Phaser from 'phaser';
import { BenchScene } from './BenchScene';
import { EventBus } from '../EventBus';
import { GameEvents, type TextModeConfigPayload } from '../events';
import { ensureRetroFont, RETRO_FONT_KEY } from '../lib/retroFont';

// Text-rendering stress test. Phaser's canvas `Text` rasterizes to a hidden
// canvas and uploads a texture per object (and re-uploads on every change),
// while `BitmapText` draws batched quads from one shared atlas. This bench ramps
// the number of on-screen text objects until FPS drops, and lets the React HUD
// switch between rendering modes so the cost of each technique is comparable on
// the same device.
//
// Research notes that informed the modes:
//   https://docs.phaser.io/phaser/concepts/gameobjects/text
//   https://docs.phaser.io/phaser/concepts/gameobjects/bitmap-text
//   https://phaser.io/news/2026/05/phaser-4-filter-system

type Dynamic = { setText: (value: string) => unknown };

type TextMode = {
  name: string;
  /** Objects added per ramp step (heavier modes use smaller steps). */
  step: number;
  /** When true, every object's text is rewritten each frame (re-rasterize cost). */
  dynamic?: boolean;
  make: (scene: TextBench, x: number, y: number) => Phaser.GameObjects.GameObject;
};

const FONT_PX = 16;
const SAMPLE = 'Phaser4';

const baseStyle = {
  fontFamily: 'Arial, sans-serif',
  fontSize: FONT_PX,
  color: '#dfe9ff',
} as const;

export const TEXT_MODES: TextMode[] = [
  {
    // Cheap to draw once, but each object owns its own texture → poor batching.
    name: 'Plain Text',
    step: 60,
    make: (s, x, y) => s.add.text(x, y, SAMPLE, baseStyle).setOrigin(0.5),
  },
  {
    // Stroke + shadow add extra canvas passes (shadow blur is the costly one).
    name: 'Stroke+Shadow',
    step: 40,
    make: (s, x, y) => {
      const t = s.add.text(x, y, SAMPLE, baseStyle).setOrigin(0.5);
      t.setStroke('#0a0a1a', 3);
      t.setShadow(2, 2, '#000000', 4, true, true);
      return t;
    },
  },
  {
    // Gradient fill built from the Text's own canvas context.
    name: 'Gradient',
    step: 40,
    make: (s, x, y) => {
      const t = s.add.text(x, y, SAMPLE, baseStyle).setOrigin(0.5);
      const grad = t.context.createLinearGradient(0, 0, 0, t.height);
      grad.addColorStop(0, '#ffd166');
      grad.addColorStop(1, '#ef476f');
      t.setFill(grad);
      return t;
    },
  },
  {
    // The headline "why Text is expensive" mode: re-rasterize + GPU upload every
    // frame for every object.
    name: 'Dynamic Text',
    step: 40,
    dynamic: true,
    make: (s, x, y) => s.add.text(x, y, '000', baseStyle).setOrigin(0.5),
  },
  {
    // Shared atlas, batched: scales far past canvas Text.
    name: 'BitmapText',
    step: 200,
    make: (s, x, y) => s.add.bitmapText(x, y, RETRO_FONT_KEY, SAMPLE, FONT_PX).setOrigin(0.5),
  },
  {
    // Updating BitmapText only rebuilds quad geometry — no re-rasterize. The
    // direct contrast to Dynamic Text.
    name: 'BitmapText Dyn',
    step: 200,
    dynamic: true,
    make: (s, x, y) => s.add.bitmapText(x, y, RETRO_FONT_KEY, '000', FONT_PX).setOrigin(0.5),
  },
  {
    // Per-object Filters each get their own framebuffer passes — the most
    // GPU-bound mode; drops fastest.
    name: 'Glow Filter',
    step: 15,
    make: (s, x, y) => {
      const t = s.add.text(x, y, SAMPLE, baseStyle).setOrigin(0.5);
      t.enableFilters();
      t.filters!.internal.addGlow(0xffd166, 4, 0, 1);
      return t;
    },
  },
  {
    name: 'Blur Filter',
    step: 15,
    make: (s, x, y) => {
      const t = s.add.text(x, y, SAMPLE, baseStyle).setOrigin(0.5);
      t.enableFilters();
      t.filters!.internal.addBlur();
      return t;
    },
  },
];

/** Mode names exposed to the React HUD for the mode picker. */
export const TEXT_MODE_NAMES = TEXT_MODES.map((m) => m.name);

export class TextBench extends BenchScene {
  protected readonly benchId = 'text';

  private mode: TextMode = TEXT_MODES[0]!;
  private spawned: Phaser.GameObjects.GameObject[] = [];
  private dynamics: Dynamic[] = [];
  private dynTick = 0;

  constructor() {
    super({ key: 'TextBench' });
    this.targetFps = 50;
    this.stepSize = TEXT_MODES[0]!.step;
    this.maxCount = 200_000;
  }

  override create() {
    // Build the runtime bitmap font before any BitmapText mode needs it.
    ensureRetroFont(this);
    super.create();
    EventBus.on(GameEvents.TextMode, this.onMode, this);
  }

  protected setup() {
    const { width } = this.scale;
    this.add
      .text(width / 2, 28, 'TEXT', {
        fontFamily: 'Arial Black',
        fontSize: 40,
        color: '#ffd166',
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(9000);
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Between(20, width - 20);
      const y = Phaser.Math.Between(64, height - 30);
      const obj = this.mode.make(this, x, y);
      this.spawned.push(obj);
      if (this.mode.dynamic) this.dynamics.push(obj as unknown as Dynamic);
    }
  }

  protected override onUpdate() {
    if (this.dynamics.length === 0) return;
    this.dynTick++;
    // A value that changes every frame, so Text genuinely re-rasterizes (setText
    // skips work if the string is unchanged).
    const label = (this.dynTick % 1000).toString().padStart(3, '0');
    for (const d of this.dynamics) d.setText(label);
  }

  // React picked a different rendering mode: clear the world and ramp again from
  // scratch with the new mode's step size.
  private onMode(payload: TextModeConfigPayload) {
    const next = TEXT_MODES[payload.index];
    if (!next) return;
    this.clearSpawned();
    this.mode = next;
    this.stepSize = next.step;
    this.restartRamp();
  }

  private clearSpawned() {
    for (const o of this.spawned) o.destroy();
    this.spawned = [];
    this.dynamics = [];
  }

  override shutdown() {
    super.shutdown();
    EventBus.off(GameEvents.TextMode, this.onMode, this);
    this.clearSpawned();
  }
}
