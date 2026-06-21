import * as Phaser from 'phaser';
import type { GameObjects } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

// "Horde" — a Vampire-Survivors-style bullet-heaven, used as a benchmark for the
// thing those games lean on hardest: lots of moving sprites PLUS continuous
// particle effects (additive explosions, bolt trails, pickup sparkles). The ramp
// metric is the live enemy count; enemies accumulate and swarm the player while
// auto-firing homing bolts pop against them with particle bursts.
//
// (Vampire Survivors itself was originally built in Phaser.) Particle docs:
// https://docs.phaser.io/phaser/concepts/gameobjects/particles
type Enemy = GameObjects.Image & { speed?: number };
type Bolt = { sprite: GameObjects.Image; target: Enemy; born: number };

const ENEMY_TINTS = [0xff5566, 0xc060ff, 0xff7733, 0xee4488];
const SWARM_RADIUS = 70;
const MAX_BOLTS = 16;
const HIT_RADIUS = 20;

export class HordeBench extends BenchScene {
  protected readonly benchId = 'horde';

  private player!: GameObjects.Image;
  private playerLight!: GameObjects.PointLight;
  private enemies: Enemy[] = [];
  private bolts: Bolt[] = [];
  private gems: GameObjects.Image[] = [];

  private hitBurst!: GameObjects.Particles.ParticleEmitter;
  private trail!: GameObjects.Particles.ParticleEmitter;
  private aura!: GameObjects.Particles.ParticleEmitter;
  private fireEvent?: Phaser.Time.TimerEvent;
  private clock = 0;

  constructor() {
    super({ key: 'HordeBench' });
    this.targetFps = 50;
    this.stepSize = 60;
    this.maxCount = 30_000;
  }

  protected setup() {
    const { width, height } = this.scale;
    this.enemies = [];
    this.bolts = [];
    this.gems = [];
    this.clock = 0;

    addGradientBackground(this, '#241036', '#080510');

    // Player at centre, with a pulsing point light for atmosphere.
    this.player = this.add.image(width / 2, height / 2, 'ball').setTint(0x66ddff).setScale(1.1).setDepth(18);
    this.playerLight = this.add.pointlight(width / 2, height / 2, 0x55ccff, 160, 0.5).setDepth(4);
    this.tweens.add({ targets: this.playerLight, intensity: 0.3, duration: 700, yoyo: true, repeat: -1 });

    // Cyan aura swirling off the player (additive).
    this.aura = this.add
      .particles(0, 0, 'glow', {
        lifespan: 650,
        speed: { min: 8, max: 38 },
        scale: { start: 0.22, end: 0 },
        alpha: { start: 0.5, end: 0 },
        tint: 0x66ddff,
        blendMode: 'ADD',
        frequency: 45,
      })
      .setDepth(6);
    this.aura.startFollow(this.player);

    // Faint additive bolt trails — one shared, pooled emitter we feed per frame.
    this.trail = this.add
      .particles(0, 0, 'glow', {
        lifespan: 240,
        scale: { start: 0.16, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xffee88,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(15);

    // Fiery explosion burst, exploded on each bolt impact (colour ramp).
    this.hitBurst = this.add
      .particles(0, 0, 'glow', {
        lifespan: 380,
        speed: { min: 40, max: 240 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 1, end: 0 },
        color: [0xffff66, 0xff8833, 0xcc2200],
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(22);

    // Auto-attack: fire homing bolts at random enemies on a fixed cadence.
    this.fireEvent = this.time.addEvent({
      delay: 85,
      loop: true,
      callback: this.fire,
      callbackScope: this,
    });
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const ring = Math.hypot(width, height) / 2 + 40;
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const e = this.add
        .image(cx + Math.cos(a) * ring, cy + Math.sin(a) * ring, 'ball')
        .setScale(Phaser.Math.FloatBetween(0.4, 0.7))
        .setTint(ENEMY_TINTS[i % ENEMY_TINTS.length]!)
        .setDepth(10) as Enemy;
      e.speed = Phaser.Math.Between(35, 80);
      this.enemies.push(e);
    }
  }

  private fire() {
    if (this.enemies.length === 0 || this.bolts.length >= MAX_BOLTS) return;
    const target = this.enemies[Phaser.Math.Between(0, this.enemies.length - 1)]!;
    const sprite = this.add
      .image(this.player.x, this.player.y, 'glow')
      .setTint(0xffee66)
      .setScale(0.4)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(16);
    this.bolts.push({ sprite, target, born: this.clock });
    this.hitBurst.explode(4, this.player.x, this.player.y); // muzzle flash
  }

  protected override onUpdate(delta: number) {
    const dt = delta / 1000;
    this.clock += delta;
    const px = this.player.x;
    const py = this.player.y;

    // Enemies steer toward the player; once close they swirl around it.
    for (const e of this.enemies) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const s = (e.speed ?? 60) * dt;
      if (d > SWARM_RADIUS) {
        e.x += (dx / d) * s;
        e.y += (dy / d) * s;
      } else {
        // tangential swirl + slight inward drift
        e.x += (-dy / d) * s * 0.8 + (dx / d) * s * 0.1;
        e.y += (dx / d) * s * 0.8 + (dy / d) * s * 0.1;
      }
    }

    // Bolts home to their target, trail, and explode on impact.
    const BOLT_SPEED = 520 * dt;
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!;
      const dx = b.target.x - b.sprite.x;
      const dy = b.target.y - b.sprite.y;
      const d = Math.hypot(dx, dy) || 1;
      b.sprite.x += (dx / d) * BOLT_SPEED;
      b.sprite.y += (dy / d) * BOLT_SPEED;
      this.trail.emitParticleAt(b.sprite.x, b.sprite.y, 1);

      if (d < HIT_RADIUS || this.clock - b.born > 1400) {
        if (d < HIT_RADIUS) {
          this.hitBurst.explode(14, b.target.x, b.target.y);
          if (Math.random() < 0.3) {
            this.gems.push(
              this.add.image(b.target.x, b.target.y, 'star').setTint(0x66ffcc).setScale(0.5).setDepth(12)
            );
          }
        }
        b.sprite.destroy();
        this.bolts.splice(i, 1);
      }
    }

    // XP gems drift to the player and sparkle on pickup.
    const GEM_SPEED = 380 * dt;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i]!;
      const dx = px - g.x;
      const dy = py - g.y;
      const d = Math.hypot(dx, dy) || 1;
      g.x += (dx / d) * GEM_SPEED;
      g.y += (dy / d) * GEM_SPEED;
      if (d < 24) {
        this.hitBurst.explode(5, g.x, g.y);
        g.destroy();
        this.gems.splice(i, 1);
      }
    }
  }

  override shutdown() {
    super.shutdown();
    this.fireEvent?.remove();
    this.enemies = [];
    this.bolts = [];
    this.gems = [];
  }
}
