import * as Phaser from 'phaser';
import type { Cameras } from 'phaser';
import { BenchScene } from './BenchScene';
import { EventBus } from '../EventBus';
import { GameEvents, type FiltersConfigPayload } from '../events';

// Phaser 4's unified filter system: any number of filters can be stacked on a
// camera. Each filter is a full-screen pass, so this bench measures fragment
// fillrate — usually the first wall you hit on mobile. We stack one more filter
// per second (cycling through the selected types) until FPS drops.
//
// The set of filter types to stack is configurable from the React HUD (see
// BenchControls). With no selection we cycle through every built-in below.
//
// Docs: https://phaser.io/news/2026/05/phaser-4-filter-system
type FilterInternal = Cameras.Scene2D.Camera['filters']['internal'];
type FilterOption = { name: string; apply: (f: FilterInternal) => void };

// Each entry is one full-screen pass. Several built-ins are visual no-ops at
// their defaults (barrel amount 1 = no distortion, ColorMatrix = identity), so
// we pass explicit parameters so each filter visibly takes effect.
//
// Notes on the awkward ones:
//   - Pixelate's block size is `2 + amount` in *framebuffer* pixels, so a fixed
//     amount is nearly invisible on a high-DPR mobile webview. We scale it by
//     devicePixelRatio for a consistent on-screen block size.
//   - Bokeh and TiltShift share a shader that outputs alpha 0 in Phaser 4.2.0
//     (they render a fully transparent pass — effectively invisible), so they're
//     omitted here in favour of Shadow and Threshold, which work and are visually
//     distinct.
export const FILTER_OPTIONS: FilterOption[] = [
  { name: 'Blur', apply: (f) => void f.addBlur(1, 2, 2, 1) },
  { name: 'Glow', apply: (f) => void f.addGlow(0x66ccff, 6, 0, 1) },
  { name: 'Vignette', apply: (f) => void f.addVignette() },
  { name: 'Barrel', apply: (f) => void f.addBarrel(0.6) },
  { name: 'ColorMatrix', apply: (f) => void f.addColorMatrix().colorMatrix.sepia() },
  { name: 'Shadow', apply: (f) => void f.addShadow(8, 8) },
  { name: 'Threshold', apply: (f) => void f.addThreshold(0.5, 0.6) },
  {
    name: 'Pixelate',
    apply: (f) => void f.addPixelate(Math.round(14 * (globalThis.devicePixelRatio || 1))),
  },
];

/** Names exposed to the React HUD so it can render a toggle per filter. */
export const FILTER_NAMES = FILTER_OPTIONS.map((o) => o.name);

export class FiltersBench extends BenchScene {
  protected readonly benchId = 'filters';

  // The filter types this bench cycles through. Defaults to all of them; the
  // React HUD narrows it via the FiltersConfig event.
  private selected: FilterOption[] = FILTER_OPTIONS.slice();

  constructor() {
    super({ key: 'FiltersBench' });
    this.targetFps = 50;
    // "count" here = number of stacked filter passes.
    this.stepSize = 1;
    this.maxCount = 64;
  }

  override create() {
    super.create();
    EventBus.on(GameEvents.FiltersConfig, this.onConfig, this);
  }

  protected setup() {
    const { width, height } = this.scale;

    // Give the filters something lively to chew on.
    for (let i = 0; i < 140; i++) {
      const star = this.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), 'star')
        .setScale(Phaser.Math.FloatBetween(0.6, 1.8));
      this.tweens.add({
        targets: star,
        x: Phaser.Math.Between(0, width),
        y: Phaser.Math.Between(0, height),
        angle: 360,
        duration: Phaser.Math.Between(1800, 4200),
        yoyo: true,
        repeat: -1,
      });
    }

    this.add
      .text(width / 2, height / 2, 'FILTERS', {
        fontFamily: 'Arial Black',
        fontSize: 72,
        color: '#ffd166',
      })
      .setOrigin(0.5);
  }

  protected addObjects(n: number) {
    const internal = this.cameras.main.filters.internal;
    for (let i = 0; i < n; i++) {
      const add = this.selected[this.count % this.selected.length]!;
      add.apply(internal);
    }
  }

  // React picked a new filter set: drop the stacked filters and ramp again from
  // scratch with only the chosen types (an empty pick means "all of them").
  private onConfig(payload: FiltersConfigPayload) {
    const picked = FILTER_OPTIONS.filter((o) => payload.filters.includes(o.name));
    this.selected = picked.length > 0 ? picked : FILTER_OPTIONS.slice();
    this.cameras.main.filters.internal.clear();
    this.restartRamp();
  }

  override shutdown() {
    super.shutdown();
    EventBus.off(GameEvents.FiltersConfig, this.onConfig, this);
  }
}
