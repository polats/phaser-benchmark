import * as Phaser from 'phaser';

// A lightweight additive ribbon trail: keeps a short history of points and
// redraws a tapering, fading polyline through them each frame (newest = bright +
// wide, oldest = dim + thin). Cheap enough for orbs, projectiles, and pickups.
export class RibbonTrail {
  private gfx: Phaser.GameObjects.Graphics;
  private pts: number[] = []; // flat [x0,y0,x1,y1,...]
  private max: number;

  constructor(
    scene: Phaser.Scene,
    private tint: number,
    private width: number,
    length: number,
    depth: number
  ) {
    this.max = length;
    this.gfx = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
  }

  push(x: number, y: number) {
    this.pts.push(x, y);
    const cap = this.max * 2;
    if (this.pts.length > cap) this.pts.splice(0, this.pts.length - cap);
    this.redraw();
  }

  private redraw() {
    const g = this.gfx;
    g.clear();
    const n = this.pts.length / 2;
    if (n < 2) return;
    for (let i = 1; i < n; i++) {
      const f = i / (n - 1); // 0 at the tail, 1 at the head
      g.lineStyle(this.width * f + 0.5, this.tint, f);
      g.lineBetween(this.pts[(i - 1) * 2]!, this.pts[(i - 1) * 2 + 1]!, this.pts[i * 2]!, this.pts[i * 2 + 1]!);
    }
  }

  setTint(t: number) {
    this.tint = t;
  }
  setWidth(w: number) {
    this.width = w;
  }
  destroy() {
    this.gfx.destroy();
    this.pts = [];
  }
}

// Colour tiers a weapon cycles through as it levels (cool -> hot -> gold).
export function tierColor(tiers: number[], level: number): number {
  return tiers[Math.min(level - 1, tiers.length - 1)] ?? tiers[0]!;
}
