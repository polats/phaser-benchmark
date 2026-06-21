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
  /** React -> FiltersBench: restrict the stacked filters to a chosen set. */
  FiltersConfig: 'filters-config',
  /** React -> TextBench: switch the text rendering mode by index. */
  TextMode: 'text-mode',
  /** React -> ShaderDemo: switch to a specific shader by index. */
  ShaderSelect: 'shader-select',
  /** ShaderDemo -> React: the active shader changed (tap or selection). */
  ShaderChanged: 'shader-changed',
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

export type FiltersConfigPayload = {
  /** Names of the filter types to stack, in cycle order. Empty = all of them. */
  filters: string[];
};

export type TextModeConfigPayload = {
  /** Index into the TextBench mode list. */
  index: number;
};

export type ShaderSelectPayload = {
  /** Index into the ShaderDemo shader list. */
  index: number;
};

export type ShaderChangedPayload = {
  index: number;
  name: string;
};
