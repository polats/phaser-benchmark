import type * as Phaser from 'phaser';
import { GameObjects, type Scene } from 'phaser';

// Shared "art direction" helpers so every scene gets a cohesive, designed look
// instead of a flat fill: a vertical gradient backdrop and a subtle camera
// vignette. Pair with lighting (this.lights) for depth.

function ensureGradientTexture(scene: Scene, key: string, top: string, bottom: string) {
  if (scene.textures.exists(key)) return;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, h);
  scene.textures.addCanvas(key, canvas);
}

/**
 * Add a full-screen vertical gradient background that tracks the camera and
 * resizes with the view. Returns the image so the caller can tint/move it
 * (e.g. for a day/night cycle). Sits at depth -1000.
 */
export function addGradientBackground(
  scene: Scene,
  top = '#21386b',
  bottom = '#0a0e1c'
): GameObjects.Image {
  const key = `grad:${top}:${bottom}`;
  ensureGradientTexture(scene, key, top, bottom);

  const { width, height } = scene.scale;
  const bg = scene.add
    .image(0, 0, key)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(-1000)
    .setDisplaySize(width, height);

  const resize = (size: Phaser.Structs.Size) => bg.setDisplaySize(size.width, size.height);
  scene.scale.on('resize', resize);
  bg.once(GameObjects.Events.DESTROY, () => scene.scale.off('resize', resize));
  return bg;
}

/** Apply a tasteful vignette to a camera for a cohesive, finished frame. */
export function applyVignette(camera: Phaser.Cameras.Scene2D.Camera) {
  camera.filters.internal.addVignette();
}

/**
 * Cinematic post-processing stack for the game camera: a colour grade (punchier
 * saturation + contrast), a soft bloom on bright areas (Glow), and a vignette.
 * One call ties all the additive glow/particles/lighting together.
 */
export function applyCinematicFX(camera: Phaser.Cameras.Scene2D.Camera) {
  const f = camera.filters.internal;
  const cm = f.addColorMatrix();
  cm.colorMatrix.saturate(0.2, true).contrast(0.1, true);
  f.addGlow(0xffffff, 3, 0, 1); // bloom-like radiance on bright pixels
  f.addVignette(0.5, 0.5, 0.78, 0.5);
}
