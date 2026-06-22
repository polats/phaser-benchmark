import * as Phaser from 'phaser';
import { GameObjects, Scene } from 'phaser';

// Reusable holographic trading card for Phaser 4. Mirrors the Three.js holo bench
// in 2D: emboss comes from a real normal map under Phaser's Light2D pipeline (the
// art is lit by a pointer-following light, so the relief shifts as you move), and
// the foil is an additive pass of the holo mask whose hue/strength shift with the
// card's tilt. Used by HoloCardsBench and the Horde level-up cards.

export const HOLO_CARD_SLUGS = [
  'plasma-bolt',
  'orbit',
  'nova-blast',
  'ricochet',
  'singularity',
  'orbital-nova',
  'power-core',
  'overclock',
  'critical-eye',
  'plunder',
];

export function preloadHoloCards(scene: Scene, slugs: string[] = HOLO_CARD_SLUGS) {
  for (const s of slugs) {
    // array form => second file is registered as the texture's normal map
    scene.load.image(`holo:${s}`, [`cards/${s}/albedo.png`, `cards/${s}/normal.png`]);
    scene.load.image(`holomask:${s}`, `cards/${s}/holo.png`);
  }
}

export type HoloCard = {
  container: GameObjects.Container;
  width: number;
  height: number;
  place: (x: number, y: number, scale: number) => void;
  setTilt: (tx: number, ty: number) => void; // -1..1 each axis
  update: (timeMs: number) => void;
  destroy: () => void;
};

const BASE_W = 240;
const BASE_H = 336;

export function createHoloCard(scene: Scene, slug: string, opts?: { foilStrength?: number }): HoloCard {
  const w = BASE_W;
  const h = BASE_H;
  const foilStrength = opts?.foilStrength ?? 1;

  const art = scene.add.image(0, 0, `holo:${slug}`).setDisplaySize(w, h);
  art.setLighting(true); // normal-mapped emboss via the scene's Light2D lights

  // additive foil — the holo mask (white = foil-eligible frame/bg) tinted with a
  // hue that drifts with time + tilt, so the card shimmers as it turns.
  const foil = scene.add.image(0, 0, `holomask:${slug}`).setDisplaySize(w, h).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);

  const frame = scene.add.rectangle(0, 0, w, h).setStrokeStyle(2, 0xffffff, 0.14);

  const container = scene.add.container(0, 0, [art, foil, frame]);
  container.setSize(w, h);

  let baseScale = 1;
  let tiltX = 0;

  return {
    container,
    width: w,
    height: h,
    place(x, y, scale) {
      baseScale = scale;
      container.setPosition(x, y);
      container.setScale(scale);
    },
    setTilt(tx, ty) {
      tiltX = tx;
      container.rotation = tx * 0.045;
      container.setScale(baseScale * (1 - Math.abs(tx) * 0.02), baseScale * (1 - Math.abs(ty) * 0.04));
    },
    update(t) {
      const hue = (t * 0.00009 + tiltX * 0.22 + 0.5) % 1;
      const c = Phaser.Display.Color.HSVToRGB(hue, 0.65, 1) as Phaser.Types.Display.ColorObject;
      foil.setTint(c.color ?? Phaser.Display.Color.GetColor(c.r, c.g, c.b));
      foil.setAlpha(foilStrength * (0.32 + 0.26 * Math.sin(t * 0.002 + tiltX * 3.0)));
    },
    destroy() {
      container.destroy();
    },
  };
}
