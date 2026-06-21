import * as Phaser from 'phaser';
import type { GameObjects, Physics } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground } from '../lib/look';

// "Horde" — a Vampire-Survivors-style bullet-heaven, used as a benchmark for what
// horde games lean on hardest, all at once: many moving sprites, Arcade physics
// (overlap hit-detection across the swarm), dynamic lighting on normal-mapped
// sprites, AND continuous particle effects.
//
// Spiders (normal-mapped, lit) swarm the player from the dark; auto-fired bolts
// fly straight and are tested against the swarm by Arcade `overlap`, bursting into
// additive particles on contact. A point light follows the mouse (as in the
// Creepy Crawly demo), so you can light up the swarm by moving the cursor.
//
// (Vampire Survivors itself was originally built in Phaser.)
type ArcadeImage = Physics.Arcade.Image;

const SWARM_RADIUS = 60;
const MAX_BOLTS = 16;
const BOLT_SPEED = 540;
// XP jewels are normal-mapped + lit (like the spiders) AND carry their own
// light, so they sparkle and illuminate the swarm as they fly to the player.
const JEWEL_COLORS = [0x66ffcc, 0xff66cc, 0xffd166, 0x88aaff, 0xff7755];
const MAX_JEWEL_LIGHTS = 16; // cap real lights; extra jewels still glow (lit sprite)

type Jewel = { sprite: GameObjects.Image; light: GameObjects.Light | null };

export class HordeBench extends BenchScene {
  protected readonly benchId = 'horde';

  private player!: GameObjects.Image;
  private playerLight!: GameObjects.PointLight;
  private mouseLight!: GameObjects.Light;
  private enemies!: Physics.Arcade.Group;
  private bolts!: Physics.Arcade.Group;
  private gems: Jewel[] = [];
  private jewelLights = 0;

  private hitBurst!: GameObjects.Particles.ParticleEmitter;
  private trail!: GameObjects.Particles.ParticleEmitter;
  private aura!: GameObjects.Particles.ParticleEmitter;
  private fireEvent?: Phaser.Time.TimerEvent;

  constructor() {
    super({ key: 'HordeBench', physics: { arcade: { debug: false } } });
    this.targetFps = 50;
    this.stepSize = 40;
    this.maxCount = 20_000;
  }

  preload() {
    // Normal-mapped spider (diffuse + _n) so the lights actually shade them.
    this.load.image('spider', ['assets/normal-maps/spider.png', 'assets/normal-maps/spider_n.png']);
  }

  protected setup() {
    const { width, height } = this.scale;
    this.gems = [];
    this.jewelLights = 0;

    addGradientBackground(this, '#1a0f2e', '#06040c');

    // Low ambient so spiders read as silhouettes in the dark, then light up
    // dramatically under the player + mouse lights.
    this.lights.enable();
    this.lights.setAmbientColor(0x2a2735);

    // Player: a bright orb with a self-illuminating glow + a real light that
    // shades nearby spiders.
    this.player = this.add.image(width / 2, height / 2, 'ball').setTint(0x66ddff).setScale(1.1).setDepth(18);
    this.playerLight = this.add.pointlight(width / 2, height / 2, 0x55ccff, 150, 0.5).setDepth(4);
    this.tweens.add({ targets: this.playerLight, intensity: 0.3, duration: 700, yoyo: true, repeat: -1 });
    this.lights.addLight(width / 2, height / 2, 380, 0xffdca8, 2);

    // Light that follows the cursor (lifted off the surface for nicer shading).
    this.mouseLight = this.lights.addLight(width / 2, height / 2, 300, 0xbbccff, 3).setZNormal(0.5);

    // Cyan aura swirling off the player.
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

    // Additive bolt trails (shared pooled emitter, fed per frame).
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

    // Fiery impact burst.
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

    this.enemies = this.physics.add.group();
    this.bolts = this.physics.add.group();

    // Physics decides what got hit: any bolt overlapping any spider.
    this.physics.add.overlap(this.bolts, this.enemies, (boltObj, enemyObj) => {
      const e = enemyObj as ArcadeImage;
      const b = boltObj as ArcadeImage;
      if (!e.active || !b.active) return;
      this.hitBurst.explode(14, e.x, e.y);
      if (Math.random() < 0.3) this.spawnJewel(e.x, e.y);
      e.destroy();
      b.destroy();
    });

    this.fireEvent = this.time.addEvent({ delay: 85, loop: true, callback: this.fire, callbackScope: this });
  }

  protected addObjects(n: number) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    const ring = Math.hypot(width, height) / 2 + 40;
    for (let i = 0; i < n; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const e = this.enemies.create(
        cx + Math.cos(a) * ring,
        cy + Math.sin(a) * ring,
        'spider'
      ) as ArcadeImage;
      e.setScale(Phaser.Math.FloatBetween(0.08, 0.14)).setDepth(10);
      e.setLighting(true);
      e.setSelfShadow(true);
      e.setData('speed', Phaser.Math.Between(35, 80));
    }
  }

  private fire() {
    const kids = this.enemies.getChildren() as ArcadeImage[];
    if (kids.length === 0 || this.bolts.getLength() >= MAX_BOLTS) return;

    // Aim at the nearest spider's CURRENT position, then fly straight (no homing).
    const px = this.player.x;
    const py = this.player.y;
    let target = kids[0]!;
    let best = Infinity;
    for (const e of kids) {
      const dd = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py);
      if (dd < best) {
        best = dd;
        target = e;
      }
    }

    const b = this.bolts.create(px, py, 'glow') as ArcadeImage;
    b.setTint(0xffee66).setScale(0.4).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.physics.moveToObject(b, target, BOLT_SPEED);
    this.time.delayedCall(1300, () => {
      if (b.active) b.destroy();
    });
    this.hitBurst.explode(4, px, py); // muzzle flash
  }

  // An XP jewel: a normal-mapped, lit gem sprite that ALSO carries its own light
  // (capped), so it sparkles under the scene lights and lights up the spiders it
  // drifts past — showcasing the same lighting the spiders use.
  private spawnJewel(x: number, y: number) {
    const col = JEWEL_COLORS[Phaser.Math.Between(0, JEWEL_COLORS.length - 1)]!;
    const sprite = this.add.image(x, y, 'jewel').setTint(col).setScale(0.6).setDepth(12);
    sprite.setLighting(true);
    sprite.setSelfShadow(true);
    let light: GameObjects.Light | null = null;
    if (this.jewelLights < MAX_JEWEL_LIGHTS) {
      light = this.lights.addLight(x, y, 110, col, 2.2);
      this.jewelLights++;
    }
    this.gems.push({ sprite, light });
  }

  protected override onUpdate(delta: number) {
    const dt = delta / 1000;
    const px = this.player.x;
    const py = this.player.y;

    // Mouse-follow light (in world space).
    const p = this.input.activePointer;
    this.mouseLight.x = p.worldX;
    this.mouseLight.y = p.worldY;

    // Spiders steer toward the player (CPU cost scales with the swarm) and face
    // their direction of travel — the sprite art points "down", a quarter turn
    // above standard, so subtract PI/2.
    const kids = this.enemies.getChildren() as ArcadeImage[];
    for (const e of kids) {
      const dx = px - e.x;
      const dy = py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = (e.getData('speed') as number) ?? 60;
      if (d > SWARM_RADIUS) {
        e.setVelocity((dx / d) * sp, (dy / d) * sp);
      } else {
        // swirl around the player instead of piling on top of it
        e.setVelocity((-dy / d) * sp * 0.9, (dx / d) * sp * 0.9);
      }
      e.rotation = Math.atan2(dy, dx) - Math.PI / 2;
    }

    // Bolt trails.
    for (const b of this.bolts.getChildren() as ArcadeImage[]) {
      this.trail.emitParticleAt(b.x, b.y, 1);
    }

    // XP jewels drift to the player (their light rides along), spinning so the
    // facets sparkle, and pop on pickup.
    const gemSpeed = 380 * dt;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i]!;
      const s = g.sprite;
      const dx = px - s.x;
      const dy = py - s.y;
      const d = Math.hypot(dx, dy) || 1;
      s.x += (dx / d) * gemSpeed;
      s.y += (dy / d) * gemSpeed;
      s.rotation += dt * 2;
      if (g.light) {
        g.light.x = s.x;
        g.light.y = s.y;
      }
      if (d < 24) {
        this.hitBurst.explode(6, s.x, s.y);
        s.destroy();
        if (g.light) {
          this.lights.removeLight(g.light);
          this.jewelLights--;
        }
        this.gems.splice(i, 1);
      }
    }
  }

  override shutdown() {
    super.shutdown();
    this.fireEvent?.remove();
    for (const g of this.gems) {
      if (g.light) this.lights.removeLight(g.light);
    }
    this.gems = [];
    this.jewelLights = 0;
  }
}
