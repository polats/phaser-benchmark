import { AUTO, Game, Scale, type Types } from 'phaser';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { MainMenu } from './scenes/MainMenu';
import { GameScene } from './scenes/Game';
import { GameOver } from './scenes/GameOver';
import { ArcadeBench } from './benches/ArcadeBench';
import { MatterBench } from './benches/MatterBench';
import { Box2dBench } from './benches/Box2dBench';
import { GpuSpritesBench } from './benches/GpuSpritesBench';
import { FiltersBench } from './benches/FiltersBench';
import { LightingBench } from './benches/LightingBench';
import { TextBench } from './benches/TextBench';
import { HordeBench } from './benches/HordeBench';
import { BigForestScene } from './demos/bigForest';
import { CreepyCrawlyDemo } from './demos/CreepyCrawlyDemo';
import { GpuAnimatedDemo } from './demos/GpuAnimatedDemo';
import { BunnyBounceDemo } from './demos/BunnyBounceDemo';
import { ShaderDemo } from './demos/ShaderDemo';

// The scene the "Home" button returns to (the title screen).
export const HOME_SCENE_KEY = 'HordeBench';

// Base design resolution. Scale.RESIZE keeps the canvas filling the Reddit
// webview (which has a variable size on mobile vs desktop) while scenes lay
// themselves out relative to this reference via the scale manager's resize event.
const config: Types.Core.GameConfig = {
  type: AUTO,
  backgroundColor: '#0b1020',
  scale: {
    mode: Scale.RESIZE,
    autoCenter: Scale.CENTER_BOTH,
    width: 1024,
    height: 768,
  },
  // Enable Phaser 4 lighting: allow many simultaneous lights and self-shadows.
  render: {
    maxLights: 64,
    selfShadow: true,
  },
  // Physics systems are enabled per-scene (see each Bench*.ts) so scenes that
  // don't need physics pay nothing for it.
  scene: [
    Boot,
    Preloader,
    MainMenu,
    GameScene,
    GameOver,
    GpuSpritesBench,
    FiltersBench,
    LightingBench,
    TextBench,
    ArcadeBench,
    MatterBench,
    Box2dBench,
    HordeBench,
    BigForestScene,
    CreepyCrawlyDemo,
    GpuAnimatedDemo,
    BunnyBounceDemo,
    ShaderDemo,
  ],
};

export function StartGame(parent: string): Game {
  const game = new Game({ ...config, parent });
  // Expose for debugging in the browser console (e.g. inspect the active scene).
  (globalThis as unknown as { redditPhaserGame?: Game }).redditPhaserGame = game;
  return game;
}
