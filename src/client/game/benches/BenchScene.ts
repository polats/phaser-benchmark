import type * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GameEvents } from '../events';

// Shared stress-test harness. A bench subclass implements `setup()` (build the
// world) and `addObjects(n)` (spawn n more stressed objects). The base ramps the
// object count once per second: while the smoothed FPS holds at/above the target
// it spawns another batch; once FPS drops it records the capacity and stops.
//
// This turns every bench into a comparable "how many X until 60→target fps on
// this device" benchmark, reported to the server via the React shell.
export abstract class BenchScene extends Scene {
  /** Stable id used for server reporting (see registry.ts). */
  protected abstract readonly benchId: string;

  /** FPS the device must hold to keep ramping. */
  protected targetFps = 50;
  /** How many objects to add each ramp step. */
  protected stepSize = 250;
  /** Safety ceiling so a very fast device doesn't ramp forever. */
  protected maxCount = 2_000_000;

  protected count = 0;
  private ticks = 0;
  private finished = false;
  private evalEvent?: Phaser.Time.TimerEvent;
  private label?: Phaser.GameObjects.Text;

  protected abstract setup(): void;
  protected abstract addObjects(n: number): void;
  /** Optional per-frame work (e.g. stepping an external physics world). */
  protected onUpdate(_delta: number): void {}

  create() {
    this.finished = false;
    this.count = 0;
    this.ticks = 0;

    this.setup();
    this.addObjects(this.stepSize);
    this.count += this.stepSize;

    // Minimal in-canvas label; the React PerfHud shows the live numbers.
    this.label = this.add
      .text(8, this.scale.height - 24, '', {
        fontFamily: 'ui-monospace, monospace',
        fontSize: 14,
        color: '#9fe7ff',
      })
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(10_000);

    this.evalEvent = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: this.evaluate,
      callbackScope: this,
    });

    EventBus.emit(GameEvents.SceneReady, this);
  }

  override update(_time: number, delta: number) {
    this.onUpdate(delta);
  }

  /**
   * Discards progress and restarts the ramp from zero, reusing the existing
   * world. Subclasses call this when a live config change (e.g. the user picks a
   * different filter set) should restart the measurement without a full rebuild.
   */
  protected restartRamp() {
    this.finished = false;
    this.count = 0;
    this.ticks = 0;
    this.addObjects(this.stepSize);
    this.count += this.stepSize;
  }

  private evaluate() {
    if (this.finished) return;
    this.ticks += 1;

    const fps = Math.round(this.game.loop.actualFps);
    this.label?.setText(`${this.benchId}  fps:${fps}  n:${this.count.toLocaleString()}`);
    EventBus.emit(GameEvents.BenchPerf, { bench: this.benchId, count: this.count, fps });

    // Skip the first tick — the scene is still warming up.
    if (this.ticks < 2) return;

    if (fps >= this.targetFps && this.count < this.maxCount) {
      this.addObjects(this.stepSize);
      this.count += this.stepSize;
    } else {
      this.finished = true;
      this.evalEvent?.remove();
      EventBus.emit(GameEvents.BenchDone, { bench: this.benchId, capacity: this.count, fps });
    }
  }

  shutdown() {
    this.evalEvent?.remove();
  }
}
