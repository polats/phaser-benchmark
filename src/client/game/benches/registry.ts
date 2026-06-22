// Catalog of stress-test / showcase scenes. The `sceneKey` must match the key a
// scene registers with (see each Bench*.ts and main.ts). React renders this list
// as the sidebar; main.ts registers the matching scene classes.
export type BenchGroup = 'render' | 'physics' | 'game' | 'demo';

export type BenchInfo = {
  sceneKey: string;
  /** Stable id reported to the server leaderboard. */
  benchId: string;
  label: string;
  description: string;
  group: BenchGroup;
};

export const BENCHES: BenchInfo[] = [
  {
    sceneKey: 'GpuSpritesBench',
    benchId: 'gpu-sprites',
    label: 'GPU Sprites',
    description: 'Ramp SpriteGPULayer members until FPS drops — the 1M-sprite showcase.',
    group: 'render',
  },
  {
    sceneKey: 'FiltersBench',
    benchId: 'filters',
    label: 'Filters',
    description: 'Stack Phaser 4 unified filters on the camera until fillrate gives out.',
    group: 'render',
  },
  {
    sceneKey: 'LightingBench',
    benchId: 'lighting',
    label: 'Lighting',
    description: 'Dynamic lights + normal maps + self-shadows over a field of lit sprites.',
    group: 'render',
  },
  {
    sceneKey: 'TextBench',
    benchId: 'text',
    label: 'Text',
    description:
      'Ramp text objects until FPS drops; switch modes to compare canvas Text (stroke/shadow/gradient/dynamic/filters) vs batched BitmapText.',
    group: 'render',
  },
  {
    sceneKey: 'TweensBench',
    benchId: 'tweens',
    label: 'Tweens',
    description: 'Ramp infinite yoyo tweens — pure TweenManager (CPU engine) throughput.',
    group: 'render',
  },
  {
    sceneKey: 'GraphicsBench',
    benchId: 'graphics',
    label: 'Graphics',
    description: 'One Graphics object re-tessellating N rotating filled+stroked stars each frame.',
    group: 'render',
  },
  {
    sceneKey: 'ParticlesBench',
    benchId: 'particles',
    label: 'Particles',
    description: 'A field of additive particle fountains — ramp the emitter count.',
    group: 'render',
  },
  {
    sceneKey: 'RopeBench',
    benchId: 'rope',
    label: 'Rope',
    description: 'Sine-deforming textured Rope strips (Phaser 4 geometry) — ramp the rope count.',
    group: 'render',
  },
  {
    sceneKey: 'TilemapBench',
    benchId: 'tilemap',
    label: 'Tilemap',
    description: 'Phaser 4 GPU tilemap layers (one shader quad each) — ramp stacked parallax layers.',
    group: 'render',
  },
  {
    sceneKey: 'ShaderDemo',
    benchId: 'demo-shader',
    label: '✨ Shader',
    description: 'Hand-written GLSL fragment shader (animated plasma) — fillrate probe.',
    group: 'render',
  },
  {
    sceneKey: 'ArcadeBench',
    benchId: 'arcade',
    label: 'Arcade',
    description: 'Thousands of Arcade bodies (drag any of them) — CPU broadphase stress.',
    group: 'physics',
  },
  {
    sceneKey: 'MatterBench',
    benchId: 'matter',
    label: 'Matter',
    description: 'Matter.js rigid bodies — drag & fling them with the pointer.',
    group: 'physics',
  },
  {
    sceneKey: 'Box2dBench',
    benchId: 'box2d',
    label: 'Box2D',
    description: 'Phaser Box2D v3 dynamic bodies — drag them; deterministic physics.',
    group: 'physics',
  },
  {
    sceneKey: 'HordeBench',
    benchId: 'horde',
    label: '🧛 Horde',
    description:
      'Vampire-Survivors-style swarm: ramps enemies while auto-bolts explode in additive particle bursts.',
    group: 'game',
  },
  // Official PhotonStorm Phaser demos, vendored as fixed-load benchmarks.
  {
    sceneKey: 'BigForest',
    benchId: 'demo-forest',
    label: '🌲 Big Forest',
    description: 'SpriteGPULayer parallax forest — drag to scroll, pinch/wheel to zoom. Heavy.',
    group: 'demo',
  },
  {
    sceneKey: 'CreepyCrawlyDemo',
    benchId: 'demo-spiders',
    label: '🕷 Spiders',
    description: '~8k lit, normal-mapped spiders on one GPU layer.',
    group: 'demo',
  },
  {
    sceneKey: 'GpuAnimatedDemo',
    benchId: 'demo-anim',
    label: '🫧 Bubbles',
    description: '4k frame-animated GPU sprites drifting across the screen.',
    group: 'demo',
  },
  {
    sceneKey: 'BunnyBounceDemo',
    benchId: 'demo-bunny',
    label: '🐰 Bunnies',
    description: '1k multi-property GPU-animated bunnies.',
    group: 'demo',
  },
];
