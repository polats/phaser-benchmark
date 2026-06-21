import type { Scene } from 'phaser';

// Generates the template's textures in code — including mathematically-correct
// NORMAL MAPS so Phaser 4's lighting has real surface detail to shade. A sphere's
// normals are analytic (a hemisphere), which gives cleaner lighting than most
// hand-painted maps. Diffuse textures are kept near-white so they tint cleanly.
//
// To use authored art instead: load a `{ key }` + `{ key }_n` atlas in Preloader
// and skip the matching generator here — the rest of the game is unchanged.

type Ctx = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; size: number };

function makeCanvas(size: number): Ctx {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  return { canvas, ctx, size };
}

function register(scene: Scene, key: string, diffuse: HTMLCanvasElement, normal?: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, diffuse);
  if (normal) scene.textures.get(key).setDataSource(normal);
}

// Encode a normal (components in -1..1) into an RGB byte triple. Y is flipped so
// the map matches texture space (screen Y points down).
function encodeNormal(data: Uint8ClampedArray, i: number, nx: number, ny: number, nz: number) {
  data[i] = Math.round((nx * 0.5 + 0.5) * 255);
  data[i + 1] = Math.round((-ny * 0.5 + 0.5) * 255);
  data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  data[i + 3] = 255;
}

function sphere(scene: Scene, key: string, radius: number) {
  const D = radius * 2;
  const { canvas: dc, ctx } = makeCanvas(D);
  const g = ctx.createRadialGradient(radius, radius * 0.78, radius * 0.1, radius, radius, radius);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.7, '#ededed');
  g.addColorStop(1, '#d2d2d2');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(radius, radius, radius, 0, Math.PI * 2);
  ctx.fill();

  const { canvas: nc, ctx: nctx } = makeCanvas(D);
  const img = nctx.createImageData(D, D);
  for (let y = 0; y < D; y++) {
    for (let x = 0; x < D; x++) {
      const i = (y * D + x) * 4;
      const nx = (x - radius + 0.5) / radius;
      const ny = (y - radius + 0.5) / radius;
      const len2 = nx * nx + ny * ny;
      if (len2 <= 1) encodeNormal(img.data, i, nx, ny, Math.sqrt(1 - len2));
      else img.data[i + 3] = 0;
    }
  }
  nctx.putImageData(img, 0, 0);
  register(scene, key, dc, nc);
}

function roundedBox(scene: Scene, key: string, size: number, bevel: number, corner: number) {
  const { canvas: dc, ctx } = makeCanvas(size);
  ctx.fillStyle = '#f0f0f0';
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, size - 1, size - 1, corner);
  ctx.fill();

  const { canvas: nc, ctx: nctx } = makeCanvas(size);
  const img = nctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let nx = 0;
      let ny = 0;
      const left = x;
      const right = size - 1 - x;
      const top = y;
      const bottom = size - 1 - y;
      if (left < bevel) nx = -(1 - left / bevel);
      else if (right < bevel) nx = 1 - right / bevel;
      if (top < bevel) ny = -(1 - top / bevel);
      else if (bottom < bevel) ny = 1 - bottom / bevel;
      const nz = Math.sqrt(Math.max(0.0001, 1 - nx * nx - ny * ny));
      encodeNormal(img.data, i, nx, ny, nz);
    }
  }
  nctx.putImageData(img, 0, 0);
  register(scene, key, dc, nc);
}

// Soft additive glow (white core fading to transparent). No normal map.
function glow(scene: Scene, key: string, radius: number) {
  const D = radius * 2;
  const { canvas: dc, ctx } = makeCanvas(D);
  const g = ctx.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, D, D);
  register(scene, key, dc);
}

// Soft tintable blob used for the GPU "forest" foliage. No normal map.
function leaf(scene: Scene, key: string, w: number, h: number) {
  const size = Math.max(w, h);
  const { canvas: dc, ctx } = makeCanvas(size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.scale(w / size, h / size);
  ctx.beginPath();
  ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  register(scene, key, dc);
}

function star(scene: Scene, key: string, radius: number) {
  const D = radius * 2;
  const { canvas: dc, ctx } = makeCanvas(D);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? radius : radius * 0.5;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const px = radius + Math.cos(a) * r;
    const py = radius + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  register(scene, key, dc);
}

/** Generate every texture the template uses. Call once in Boot. */
export function createTextures(scene: Scene) {
  sphere(scene, 'ball', 24);
  sphere(scene, 'dot', 10);
  roundedBox(scene, 'box', 40, 8, 8);
  glow(scene, 'glow', 64);
  leaf(scene, 'leaf', 22, 30);
  star(scene, 'star', 18);
}
