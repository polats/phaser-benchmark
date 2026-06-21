import type { Scene } from 'phaser';

// Typed contract for everything that crosses the React <-> Phaser boundary via
// the EventBus. Payload types live here so both sides import the same shapes.

export const GameEvents = {
  /** A scene finished `create()` and is now the active scene. */
  SceneReady: 'current-scene-ready',
  /** A bench scene's per-second performance sample. */
  BenchPerf: 'bench-perf',
  /** A bench scene reached its capacity (FPS fell below target) and stopped ramping. */
  BenchDone: 'bench-done',
  /** The core gameplay demo reported a score. */
  Score: 'game-score',
} as const;

export type SceneReadyPayload = Scene;

export type BenchPerfPayload = {
  bench: string;
  /** Current number of stressed objects (sprites, bodies, lights…). */
  count: number;
  /** Smoothed FPS at this count. */
  fps: number;
};

export type BenchDonePayload = {
  bench: string;
  /** Highest count that held the target FPS. */
  capacity: number;
  fps: number;
};

export type ScorePayload = {
  score: number;
};
