import type { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { GameEvents } from '../events';

// Demos are official Phaser showcase scenes (not the ramping BenchScene harness).
// They run at a fixed, large load; this reports live FPS to the React HUD so they
// double as fixed-load benchmarks ("does this device hold 60fps at N sprites?").
export function startBenchReadout(scene: Scene, benchId: string, count: number) {
  EventBus.emit(GameEvents.SceneReady, scene);
  const tick = () => {
    EventBus.emit(GameEvents.BenchPerf, {
      bench: benchId,
      count,
      fps: Math.round(scene.game.loop.actualFps),
    });
  };
  tick();
  scene.time.addEvent({ delay: 1000, loop: true, callback: tick });
}
