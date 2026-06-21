import { Scene } from 'phaser';
import { createTextures } from '../lib/textures';

// Boot generates all textures (with normal maps for lighting) so the template
// ships with zero binary assets. See game/lib/textures.ts to swap in real art.
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  create() {
    createTextures(this);
    this.scene.start('Preloader');
  }
}
