// Catalog of stress-test / showcase scenes. The `sceneKey` must match the key a
// scene registers with (see each Bench*.ts and main.ts). React renders this list
// as the bench bar; main.ts registers the matching scene classes.
export type BenchInfo = {
  sceneKey: string;
  /** Stable id reported to the server leaderboard. */
  benchId: string;
  label: string;
  description: string;
};

export const BENCHES: BenchInfo[] = [
  {
    sceneKey: 'GpuSpritesBench',
    benchId: 'gpu-sprites',
    label: 'GPU Sprites',
    description: 'Ramp SpriteGPULayer members until FPS drops — the 1M-sprite showcase.',
  },
  {
    sceneKey: 'FiltersBench',
    benchId: 'filters',
    label: 'Filters',
    description: 'Stack Phaser 4 unified filters on the camera until fillrate gives out.',
  },
  {
    sceneKey: 'LightingBench',
    benchId: 'lighting',
    label: 'Lighting',
    description: 'Dynamic lights + normal maps + self-shadows over a field of lit sprites.',
  },
  {
    sceneKey: 'TextBench',
    benchId: 'text',
    label: 'Text',
    description:
      'Ramp text objects until FPS drops; switch modes to compare canvas Text (stroke/shadow/gradient/dynamic/filters) vs batched BitmapText.',
  },
  {
    sceneKey: 'ArcadeBench',
    benchId: 'arcade',
    label: 'Arcade',
    description: 'Thousands of Arcade bodies (drag any of them) — CPU broadphase stress.',
  },
  {
    sceneKey: 'MatterBench',
    benchId: 'matter',
    label: 'Matter',
    description: 'Matter.js rigid bodies — drag & fling them with the pointer.',
  },
  {
    sceneKey: 'Box2dBench',
    benchId: 'box2d',
    label: 'Box2D',
    description: 'Phaser Box2D v3 dynamic bodies — drag them; deterministic physics.',
  },
  // Official PhotonStorm Phaser demos, vendored as fixed-load benchmarks.
  {
    sceneKey: 'BigForest',
    benchId: 'demo-forest',
    label: '🌲 Big Forest',
    description: 'SpriteGPULayer parallax forest — drag to scroll, pinch/wheel to zoom. Heavy.',
  },
  {
    sceneKey: 'CreepyCrawlyDemo',
    benchId: 'demo-spiders',
    label: '🕷 Spiders',
    description: '~8k lit, normal-mapped spiders on one GPU layer.',
  },
  {
    sceneKey: 'GpuAnimatedDemo',
    benchId: 'demo-anim',
    label: '🫧 Bubbles',
    description: '4k frame-animated GPU sprites drifting across the screen.',
  },
  {
    sceneKey: 'BunnyBounceDemo',
    benchId: 'demo-bunny',
    label: '🐰 Bunnies',
    description: '1k multi-property GPU-animated bunnies.',
  },
  {
    sceneKey: 'ShaderDemo',
    benchId: 'demo-shader',
    label: '✨ Shader',
    description: 'Hand-written GLSL fragment shader (animated plasma) — fillrate probe.',
  },
];
