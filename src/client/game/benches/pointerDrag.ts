import type { Scene, Input } from 'phaser';

// Generic "grab the nearest object under the pointer and drag it" helper, shared
// by the Arcade and Box2D physics benches (Matter uses its own native
// pointerConstraint). Finds the closest item within grabRadius on pointerdown,
// moves it to the pointer while dragging, and hands back a fling velocity on
// release so you can throw objects.
export type Draggable = { x: number; y: number };

export function enablePointerDrag<T extends Draggable>(opts: {
  scene: Scene;
  grabRadius: number;
  items: () => T[];
  onGrab?: (item: T) => void;
  onMove: (item: T, x: number, y: number) => void;
  onRelease?: (item: T, vx: number, vy: number) => void;
}) {
  const { scene, grabRadius } = opts;
  let grabbed: T | null = null;
  let lastX = 0;
  let lastY = 0;
  let vx = 0;
  let vy = 0;

  scene.input.on('pointerdown', (p: Input.Pointer) => {
    const px = p.worldX;
    const py = p.worldY;
    let best: T | null = null;
    let bestD = grabRadius * grabRadius;
    for (const it of opts.items()) {
      const dx = it.x - px;
      const dy = it.y - py;
      const d = dx * dx + dy * dy;
      if (d <= bestD) {
        bestD = d;
        best = it;
      }
    }
    grabbed = best;
    lastX = px;
    lastY = py;
    vx = 0;
    vy = 0;
    if (grabbed) opts.onGrab?.(grabbed);
  });

  scene.input.on('pointermove', (p: Input.Pointer) => {
    if (!grabbed) return;
    const px = p.worldX;
    const py = p.worldY;
    vx = px - lastX;
    vy = py - lastY;
    lastX = px;
    lastY = py;
    opts.onMove(grabbed, px, py);
  });

  const release = () => {
    if (!grabbed) return;
    opts.onRelease?.(grabbed, vx, vy);
    grabbed = null;
  };
  scene.input.on('pointerup', release);
  scene.input.on('pointerupoutside', release);
}
