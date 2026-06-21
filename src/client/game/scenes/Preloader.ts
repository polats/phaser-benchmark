import { Scene } from 'phaser';

// Loads real game assets. Empty by default (the template uses textures generated
// in Boot). Drop files in /public/assets and load them here, e.g.:
//   this.load.image('logo', 'assets/logo.png');
export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  preload() {
    this.load.setPath('assets');
    // this.load.image('logo', 'logo.png');
  }

  create() {
    this.scene.start('MainMenu');
  }
}
