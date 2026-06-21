import * as Phaser from 'phaser';
import type { GameObjects, Physics } from 'phaser';
import { RibbonTrail, tierColor } from './lib/trail';

// Modular weapon system for the Horde roguelite. Each weapon owns its visuals,
// cooldown, and hit logic, and reads shared player stats from the host scene.
// Graphics-forward: additive glow, ribbon trails, expanding shockwaves. Weapons
// also EVOLVE visually as they level (size + colour tier, see *_TIERS).
export type Enemy = Physics.Arcade.Image;

// Colour the weapon shifts through as it levels: cool → hot → gold.
const BOLT_TIERS = [0xffee66, 0xffd166, 0xff9944, 0xff66cc];
const ORBIT_TIERS = [0x66ffee, 0x88ddff, 0xbb99ff, 0xffe066];
const NOVA_TIERS = [0x88ccff, 0x66ffee, 0xbb99ff, 0xffd166];
const SING_TIERS = [0x9a44ff, 0xc488ff, 0xff66cc, 0xffd166];
const RICO_TIERS = [0x66ffaa, 0x99ffcc, 0xffee66, 0xff88aa];

// The slice of HordeBench a weapon needs. (It's a Phaser.Scene, so add/time/
// physics/tweens are all available too.)
export type WeaponHost = Phaser.Scene & {
  player: GameObjects.Image;
  enemies: Physics.Arcade.Group;
  hitBurst: GameObjects.Particles.ParticleEmitter;
  damage: number;
  critChance: number;
  boltSpeed: number;
  maxBolts: number;
  projectiles: number;
  fireDelayMs: number;
  // Resolve a hit; (fromX, fromY) is the impact origin used for knockback.
  hitEnemy: (e: Enemy, fromX?: number, fromY?: number) => void;
  hasSynergy: (id: string) => boolean;
  // Screen shake + light flash (+ hitstop on big) at a point — impact feel.
  juice: (x: number, y: number, big: boolean) => void;
};

export abstract class Weapon {
  level = 1;
  abstract readonly id: string;
  constructor(protected host: WeaponHost) {}
  abstract update(delta: number): void;
  levelUp() {
    this.level += 1;
  }
  destroy() {}
  protected enemyList(): Enemy[] {
    return this.host.enemies.getChildren() as Enemy[];
  }
}

// ── Plasma Bolt ──────────────────────────────────────────────────────────────
// Straight homing-aimed bolts; physics overlap resolves the hit. Level adds
// projectiles; the Rapid Fire passive (host.fireDelayMs) speeds the cadence.
export class BoltWeapon extends Weapon {
  readonly id = 'bolt';
  private bolts: Physics.Arcade.Group;
  private trail: GameObjects.Particles.ParticleEmitter;
  private cd = 0;

  constructor(host: WeaponHost) {
    super(host);
    this.bolts = host.physics.add.group();
    this.trail = host.add
      .particles(0, 0, 'glow', {
        lifespan: 240,
        scale: { start: 0.16, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xffee88,
        blendMode: 'ADD',
        emitting: false,
      })
      .setDepth(15);
    host.physics.add.overlap(this.bolts, host.enemies, (b, e) => {
      const bb = b as Enemy;
      const ee = e as Enemy;
      if (!bb.active || !ee.active) return;
      host.hitEnemy(ee, bb.x, bb.y);
      bb.destroy();
    });
  }

  override update(delta: number) {
    this.cd -= delta;
    for (const b of this.bolts.getChildren() as Enemy[]) this.trail.emitParticleAt(b.x, b.y, 1);
    if (this.cd > 0) return;
    const kids = this.enemyList();
    if (kids.length === 0) return;
    this.cd = this.host.fireDelayMs;

    const px = this.host.player.x;
    const py = this.host.player.y;
    const shots = this.host.projectiles + (this.level - 1);
    for (let n = 0; n < shots; n++) {
      if (this.bolts.getLength() >= this.host.maxBolts + this.level * 4) break;
      let target = kids[0]!;
      if (n === 0) {
        let best = Infinity;
        for (const e of kids) {
          const dd = (e.x - px) * (e.x - px) + (e.y - py) * (e.y - py);
          if (dd < best) {
            best = dd;
            target = e;
          }
        }
      } else {
        target = kids[Phaser.Math.Between(0, kids.length - 1)]!;
      }
      const b = this.bolts.create(px, py, 'glow') as Enemy;
      b.setTint(tierColor(BOLT_TIERS, this.level))
        .setScale(0.38 + this.level * 0.05)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(16);
      this.host.physics.moveToObject(b, target, this.host.boltSpeed);
      this.host.time.delayedCall(1300, () => {
        if (b.active) b.destroy();
      });
    }
    this.host.hitBurst.explode(4, px, py);
  }

  override destroy() {
    this.bolts.destroy(true);
    this.trail.destroy();
  }
}

// ── Orbit ────────────────────────────────────────────────────────────────────
// Glowing orbs circling the player, damaging anything they touch. Level adds
// orbs. With the Orbital-Nova synergy each orb periodically erupts.
export class OrbitWeapon extends Weapon {
  readonly id = 'orbit';
  private orbs: GameObjects.Image[] = [];
  private trails: RibbonTrail[] = [];
  private angle = 0;
  private synCd = 0;

  override update(delta: number) {
    const tint = tierColor(ORBIT_TIERS, this.level);
    const orbScale = 0.45 + this.level * 0.05;
    const trailW = 4 + this.level;
    const want = 2 + this.level;
    while (this.orbs.length < want) {
      this.orbs.push(this.host.add.image(0, 0, 'ball').setBlendMode(Phaser.BlendModes.ADD).setDepth(17));
      this.trails.push(new RibbonTrail(this.host, tint, trailW, 10, 16));
    }

    const dt = delta / 1000;
    this.angle += dt * 2.4;
    const px = this.host.player.x;
    const py = this.host.player.y;
    const radius = 86 + this.level * 6;
    const step = (Math.PI * 2) / this.orbs.length;
    const hitR2 = 30 * 30;
    const enemies = this.enemyList();

    this.orbs.forEach((o, i) => {
      const a = this.angle + step * i;
      o.x = px + Math.cos(a) * radius;
      o.y = py + Math.sin(a) * radius;
      o.setTint(tint).setScale(orbScale + 0.06 * Math.sin(this.angle * 4 + i));
      const tr = this.trails[i];
      if (tr) {
        tr.setTint(tint);
        tr.setWidth(trailW);
        tr.push(o.x, o.y);
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = e.x - o.x;
        const dy = e.y - o.y;
        if (dx * dx + dy * dy < hitR2) this.host.hitEnemy(e, o.x, o.y);
      }
    });

    // Synergy: orbs periodically blast a small additive nova.
    if (this.host.hasSynergy('orbital-nova')) {
      this.synCd -= delta;
      if (this.synCd <= 0 && this.orbs.length > 0) {
        this.synCd = 900;
        const o = this.orbs[Phaser.Math.Between(0, this.orbs.length - 1)]!;
        this.host.hitBurst.explode(16, o.x, o.y);
        for (const e of enemies) {
          if (!e.active) continue;
          const dx = e.x - o.x;
          const dy = e.y - o.y;
          if (dx * dx + dy * dy < 70 * 70) this.host.hitEnemy(e, o.x, o.y);
        }
      }
    }
  }

  override destroy() {
    for (const o of this.orbs) o.destroy();
    for (const t of this.trails) t.destroy();
    this.orbs = [];
    this.trails = [];
  }
}

// ── Nova ─────────────────────────────────────────────────────────────────────
// Periodic expanding shockwave that clears everything in its radius.
export class NovaWeapon extends Weapon {
  readonly id = 'nova';
  private cd = 0;

  override update(delta: number) {
    this.cd -= delta;
    if (this.cd > 0) return;
    this.cd = Math.max(900, 2600 - (this.level - 1) * 300);

    const px = this.host.player.x;
    const py = this.host.player.y;
    const radius = 120 + (this.level - 1) * 30;

    const ring = this.host.add
      .image(px, py, 'ring')
      .setTint(tierColor(NOVA_TIERS, this.level))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(19)
      .setScale(0.2);
    this.host.tweens.add({
      targets: ring,
      scale: radius / 28,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
    this.host.hitBurst.explode(20, px, py);
    this.host.juice(px, py, true);

    const r2 = radius * radius;
    for (const e of this.enemyList()) {
      if (!e.active) continue;
      const dx = e.x - px;
      const dy = e.y - py;
      if (dx * dx + dy * dy < r2) this.host.hitEnemy(e, px, py); // knock outward
    }
  }
}

// ── Singularity ──────────────────────────────────────────────────────────────
// A gravity well: physically pulls the swarm inward for a moment, then implodes
// for big AoE damage + outward knockback. Showcases attraction physics.
type Well = { x: number; y: number; radius: number; t: number; core: GameObjects.Image; ring: GameObjects.Image };
export class SingularityWeapon extends Weapon {
  readonly id = 'singularity';
  private cd = 0;
  private wells: Well[] = [];

  override update(delta: number) {
    // Pull enemies into each active well; implode when its timer runs out.
    for (let i = this.wells.length - 1; i >= 0; i--) {
      const w = this.wells[i]!;
      w.t -= delta;
      for (const e of this.enemyList()) {
        if (!e.active) continue;
        const dx = w.x - e.x;
        const dy = w.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < w.radius) {
          const pull = 60 + 320 * (1 - d / w.radius);
          e.setVelocity((dx / d) * pull, (dy / d) * pull);
          e.setData('knock', 80); // suppress the steer-to-player while pulled
        }
      }
      if (w.t <= 0) {
        this.host.hitBurst.explode(40, w.x, w.y);
        this.host.juice(w.x, w.y, true);
        for (const e of this.enemyList()) {
          if (!e.active) continue;
          const dx = e.x - w.x;
          const dy = e.y - w.y;
          if (dx * dx + dy * dy < w.radius * w.radius) this.host.hitEnemy(e, w.x, w.y);
        }
        w.core.destroy();
        w.ring.destroy();
        this.wells.splice(i, 1);
      }
    }

    this.cd -= delta;
    if (this.cd > 0) return;
    this.cd = Math.max(2600, 5200 - (this.level - 1) * 600);
    const kids = this.enemyList();
    if (kids.length === 0) return;

    const seed = kids[Phaser.Math.Between(0, kids.length - 1)]!;
    const radius = 150 + this.level * 20;
    const core = this.host.add
      .image(seed.x, seed.y, 'glow')
      .setTint(tierColor(SING_TIERS, this.level))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.6)
      .setDepth(20);
    this.host.tweens.add({ targets: core, scale: 1.4, duration: 1300, ease: 'Sine.easeInOut', yoyo: true });
    const ring = this.host.add
      .image(seed.x, seed.y, 'ring')
      .setTint(tierColor(SING_TIERS, this.level + 1))
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(20)
      .setScale(radius / 28);
    this.host.tweens.add({ targets: ring, angle: 540, scale: radius / 28 * 0.2, duration: 1300, ease: 'Quad.easeIn' });
    this.wells.push({ x: seed.x, y: seed.y, radius, t: 1300, core, ring });
  }

  override destroy() {
    for (const w of this.wells) {
      w.core.destroy();
      w.ring.destroy();
    }
    this.wells = [];
  }
}

// ── Ricochet ─────────────────────────────────────────────────────────────────
// A bolt that bounces off the world bounds and pierces the swarm, knocking
// enemies as it ricochets. Showcases bounce physics. (HordeBench sets the world
// bounds so the bolts have walls to bounce off.)
export class RicochetWeapon extends Weapon {
  readonly id = 'ricochet';
  private bolts: Physics.Arcade.Group;
  private cd = 0;
  private shots: { bolt: Enemy; trail: RibbonTrail }[] = [];

  constructor(host: WeaponHost) {
    super(host);
    this.bolts = host.physics.add.group();
    host.physics.add.overlap(this.bolts, host.enemies, (b, e) => {
      const bb = b as Enemy;
      const ee = e as Enemy;
      if (!bb.active || !ee.active) return;
      const next = (bb.getData('next') as number) ?? 0;
      if (host.time.now < next) return; // throttle so one pass = one hit
      bb.setData('next', host.time.now + 90);
      host.hitEnemy(ee, bb.x, bb.y);
    });
  }

  override update(delta: number) {
    // Advance each bolt's ribbon trail; drop trails of expired bolts.
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const sh = this.shots[i]!;
      if (!sh.bolt.active) {
        sh.trail.destroy();
        this.shots.splice(i, 1);
      } else {
        sh.trail.push(sh.bolt.x, sh.bolt.y);
      }
    }

    this.cd -= delta;
    if (this.cd > 0) return;
    this.cd = Math.max(900, 2200 - (this.level - 1) * 220);

    const tint = tierColor(RICO_TIERS, this.level);
    const sc = 0.6 + this.level * 0.06;
    const count = 1 + Math.floor((this.level - 1) / 2);
    for (let i = 0; i < count; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const b = this.bolts.create(this.host.player.x, this.host.player.y, 'ring') as Enemy;
      b.setTint(tint).setScale(sc).setBlendMode(Phaser.BlendModes.ADD).setDepth(17);
      b.setCollideWorldBounds(true);
      b.setBounce(1, 1);
      b.setVelocity(Math.cos(a) * 360, Math.sin(a) * 360);
      this.shots.push({ bolt: b, trail: new RibbonTrail(this.host, tint, 3 + this.level, 12, 16) });
      this.host.time.delayedCall(3200, () => {
        if (b.active) b.destroy();
      });
    }
  }

  override destroy() {
    for (const sh of this.shots) sh.trail.destroy();
    this.shots = [];
    this.bolts.destroy(true);
  }
}

export function createWeapon(id: string, host: WeaponHost): Weapon {
  switch (id) {
    case 'orbit':
      return new OrbitWeapon(host);
    case 'nova':
      return new NovaWeapon(host);
    case 'singularity':
      return new SingularityWeapon(host);
    case 'ricochet':
      return new RicochetWeapon(host);
    default:
      return new BoltWeapon(host);
  }
}
