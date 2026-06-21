import * as Phaser from 'phaser';
import type { GameObjects, Physics } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground, applyCinematicFX } from '../lib/look';
import { ensureRetroFont, RETRO_FONT_KEY } from '../lib/retroFont';
import { type Upgrade, type ApplyHost, type GameState, buildChoices } from '../upgrades';
import { type Weapon, type WeaponHost, createWeapon } from '../weapons';

// Floating damage numbers tween from white to gold as they rise.
const DMG_WHITE = new Phaser.Display.Color(255, 255, 255);
const DMG_GOLD = new Phaser.Display.Color(255, 208, 0);

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
// XP jewels are normal-mapped + lit (like the spiders) AND carry their own
// light, so they sparkle and illuminate the swarm as they fly to the player.
const JEWEL_COLORS = [0x66ffcc, 0xff66cc, 0xffd166, 0x88aaff, 0xff7755];
const MAX_JEWEL_LIGHTS = 16; // cap real lights; extra jewels still glow (lit sprite)

type Jewel = { sprite: GameObjects.Image; light: GameObjects.Light | null };

export class HordeBench extends BenchScene implements WeaponHost, ApplyHost, GameState {
  protected readonly benchId = 'horde';

  // Public for the weapon system (WeaponHost).
  player!: GameObjects.Image;
  enemies!: Physics.Arcade.Group;
  hitBurst!: GameObjects.Particles.ParticleEmitter;

  private playerLight!: GameObjects.PointLight;
  private mouseLight!: GameObjects.Light;
  private gems: Jewel[] = [];
  private jewelLights = 0;

  // UpgradeTarget — mutable player stats, changed by chosen upgrade cards.
  damage = 1;
  fireDelayMs = 85;
  maxBolts = 16;
  projectiles = 1;
  critChance = 0.12;
  jewelChance = 0.3;
  boltSpeed = 540;
  burstCount = 14;

  // Weapons + synergies
  private weapons: Weapon[] = [];
  private synergies = new Set<string>();

  // Leveling
  private xp = 0;
  private level = 1;
  private xpToNext = 4;
  private leveling = false;
  private slowScale = 1;
  private hitstopT = 0;
  private xpBar?: GameObjects.Graphics;
  private levelText?: GameObjects.Text;

  private aura!: GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: 'HordeBench', physics: { arcade: { debug: false } } });
    this.targetFps = 50;
    this.stepSize = 40;
    this.maxCount = 20_000;
  }

  preload() {
    // Normal-mapped spider (diffuse + _n) so the lights actually shade them.
    this.load.image('spider', ['assets/normal-maps/spider.png', 'assets/normal-maps/spider_n.png']);
    // Normal-mapped stone floor for a lit, textured arena.
    this.load.image('stones', ['assets/normal-maps/stones.png', 'assets/normal-maps/stones_n_standard.png']);
  }

  protected setup() {
    const { width, height } = this.scale;
    this.gems = [];
    this.jewelLights = 0;
    ensureRetroFont(this); // bitmap font for the floating damage numbers

    addGradientBackground(this, '#1a0f2e', '#06040c');
    // Lit, normal-mapped stone floor — gives the arena real surface depth under
    // the player + mouse lights instead of a flat gradient.
    this.add
      .tileSprite(width / 2, height / 2, width, height, 'stones')
      .setLighting(true)
      .setTint(0x6b6480)
      .setAlpha(0.92)
      .setDepth(-900);

    // Cinematic post-FX: colour grade + bloom + vignette over the whole scene.
    this.cameras.main.filters.internal.clear();
    applyCinematicFX(this.cameras.main);

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
    // World bounds give the Ricochet bolts walls to bounce off. Spiders spawn
    // outside the bounds and don't collide with them (collideWorldBounds stays
    // off), so they still stream in from the dark.
    this.physics.world.setBounds(0, 0, width, height);
    // Spiders physically jostle each other — the swarm is a real crowd.
    this.physics.add.collider(this.enemies, this.enemies);

    // Weapons: start with the Plasma Bolt; upgrades add/level more.
    this.weapons = [];
    this.synergies.clear();
    this.addOrLevelWeapon('bolt');
    this.setSlow(1);

    // Leveling state + XP bar.
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 4;
    this.leveling = false;
    this.xpBar = this.add.graphics().setScrollFactor(0).setDepth(40);
    this.levelText = this.add
      .text(width / 2, 12, 'LV 1', { fontFamily: 'Arial Black', fontSize: 16, color: '#ffd166' })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(40);
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
      const sc = Phaser.Math.FloatBetween(0.08, 0.14);
      e.setScale(sc).setDepth(10);
      e.setLighting(true);
      e.setSelfShadow(true);
      e.setData('speed', Phaser.Math.Between(35, 80));
      e.setData('hp', 2);
      e.setData('bs', sc);
      e.setData('ph', Phaser.Math.FloatBetween(0, 6.28));
    }
  }

  // Resolve a hit on a spider (WeaponHost): damage number, physics knockback
  // away from the impact, HP, and a burst + jewel on the killing blow.
  hitEnemy(e: ArcadeImage, fromX?: number, fromY?: number) {
    if (!e.active) return;
    const crit = Math.random() < this.critChance;
    const dmg = crit ? this.damage * 3 : this.damage;
    this.spawnDamageText(e.x, e.y, dmg, crit);

    if (fromX !== undefined && fromY !== undefined) {
      const dx = e.x - fromX;
      const dy = e.y - fromY;
      const d = Math.hypot(dx, dy) || 1;
      e.setVelocity((dx / d) * 240, (dy / d) * 240);
      e.setData('knock', 180); // brief window where steering is suppressed
    }

    const hp = ((e.getData('hp') as number) ?? 1) - dmg;
    if (hp <= 0) {
      this.dissolveEnemy(e);
    } else {
      e.setData('hp', hp);
      this.hitBurst.explode(4, e.x, e.y); // small non-lethal spark
    }
  }

  // Death "dissolve": detach from physics, then spin + shrink + fade out (plus
  // the burst + jewel) instead of vanishing instantly.
  private dissolveEnemy(e: ArcadeImage) {
    this.hitBurst.explode(this.burstCount, e.x, e.y);
    if (Math.random() < this.jewelChance) this.spawnJewel(e.x, e.y);
    this.enemies.remove(e);
    const body = e.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    this.tweens.add({
      targets: e,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      angle: e.angle + 160,
      duration: 220,
      ease: 'Quad.easeIn',
      onComplete: () => e.destroy(),
    });
  }

  // Impact feel (WeaponHost.juice): screen shake + a fading light flash, plus a
  // brief hitstop + zoom punch on big hits (Nova / Singularity).
  juice(x: number, y: number, big: boolean) {
    this.cameras.main.shake(big ? 180 : 70, big ? 0.008 : 0.0035);
    const pl = this.add.pointlight(x, y, 0xffffff, big ? 150 : 80, big ? 1.3 : 0.7).setDepth(25);
    this.tweens.add({
      targets: pl,
      radius: big ? 340 : 170,
      intensity: 0,
      duration: big ? 260 : 150,
      onComplete: () => pl.destroy(),
    });
    if (big) {
      this.hitstopT = 55;
      this.tweens.add({ targets: this.cameras.main, zoom: 1.04, duration: 70, yoyo: true });
    }
  }

  // Bullet-time: slow the sim instead of pausing (Arcade timeScale is inverse;
  // tween/time scales are direct). `s` in (0,1], 1 = normal.
  private setSlow(s: number) {
    this.slowScale = s;
    this.physics.world.timeScale = 1 / s;
    this.tweens.timeScale = s;
    this.time.timeScale = s;
  }

  // ── ApplyHost / GameState (used by the upgrade cards) ──
  addOrLevelWeapon(id: string) {
    const existing = this.weapons.find((w) => w.id === id);
    if (existing) existing.levelUp();
    else this.weapons.push(createWeapon(id, this));
  }
  setSynergy(id: string) {
    this.synergies.add(id);
  }
  ownsWeapon(id: string) {
    return this.weapons.some((w) => w.id === id);
  }
  weaponLevel(id: string) {
    return this.weapons.find((w) => w.id === id)?.level ?? 0;
  }
  weaponCount() {
    return this.weapons.length;
  }
  hasSynergy(id: string) {
    return this.synergies.has(id);
  }

  private gainXp(n: number) {
    // Just bank XP; the actual level-up is triggered from onUpdate so it never
    // fires while the (single-instance) card scene is mid-teardown.
    this.xp += n;
  }

  // Slow the game to bullet-time (not paused) and show the upgrade cards at the
  // bottom. On pick, apply, restore speed; onUpdate picks up any further level.
  private levelUp() {
    this.leveling = true;
    this.xp -= this.xpToNext;
    this.level += 1;
    this.xpToNext = Math.ceil(this.xpToNext * 1.4) + 2;
    this.cameras.main.flash(160, 255, 240, 180);
    this.setSlow(0.3);
    this.scene.launch('CardSelect', {
      choices: buildChoices(3, this),
      onPick: (u: Upgrade) => {
        u.apply(this);
        this.setSlow(1);
        this.leveling = false;
      },
    });
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

  // Floating combat text: rises, glows white -> gold, then shrinks and fades.
  // Uses batched BitmapText so hundreds can be on screen cheaply.
  private spawnDamageText(x: number, y: number, amount: number, crit: boolean) {
    const base = crit ? 1.5 : 1;
    const txt = this.add
      .bitmapText(x, y, RETRO_FONT_KEY, String(amount), crit ? 26 : 18)
      .setOrigin(0.5)
      .setTint(0xffffff)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(30);
    this.tweens.add({ targets: txt, y: y - 52, duration: 620, ease: 'Quad.easeOut' });
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 620,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const c = Phaser.Display.Color.Interpolate.ColorWithColor(
          DMG_WHITE,
          DMG_GOLD,
          100,
          Math.round(t * 100)
        );
        txt.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
        txt.setScale(base * (t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4) * 0.5)); // shrink late
        txt.setAlpha(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
      },
      onComplete: () => txt.destroy(),
    });
  }

  private redrawXpBar() {
    if (!this.xpBar) return;
    const w = this.scale.width;
    const frac = Phaser.Math.Clamp(this.xp / this.xpToNext, 0, 1);
    this.xpBar.clear();
    this.xpBar.fillStyle(0x000000, 0.5).fillRect(0, 0, w, 6);
    this.xpBar.fillStyle(0x66ddff, 1).fillRect(0, 0, w * frac, 6);
    this.levelText?.setText('LV ' + this.level);
  }

  protected override onUpdate(delta: number) {
    // Hitstop: freeze the sim for a few ms on big impacts (camera tweens still run).
    if (this.hitstopT > 0) {
      this.hitstopT -= delta;
      if (this.hitstopT > 0) return;
    }
    const dt = (delta / 1000) * this.slowScale;
    const nowSec = this.time.now / 1000;
    const px = this.player.x;
    const py = this.player.y;

    // Trigger a pending level-up (runs each frame; `leveling` guards re-entry) so
    // the card scene fully tears down before the next one launches.
    if (!this.leveling && this.xp >= this.xpToNext) this.levelUp();

    // Update all weapons; bullet-time scales their firing cadence.
    const wdelta = delta * this.slowScale;
    for (const w of this.weapons) w.update(wdelta);

    this.redrawXpBar();

    // Mouse-follow light (in world space).
    const p = this.input.activePointer;
    this.mouseLight.x = p.worldX;
    this.mouseLight.y = p.worldY;

    // Spiders steer toward the player (CPU cost scales with the swarm) and face
    // their direction of travel — the sprite art points "down", a quarter turn
    // above standard, so subtract PI/2.
    const kids = this.enemies.getChildren() as ArcadeImage[];
    for (const e of kids) {
      // While knocked back or pulled by a well, ride the physics velocity instead
      // of steering toward the player.
      const kt = (e.getData('knock') as number) ?? 0;
      if (kt > 0) {
        e.setData('knock', kt - delta);
        continue;
      }
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
      // Scuttle: subtle squash/stretch fakes crawling legs (no spritesheet needed).
      const bs = (e.getData('bs') as number) ?? 0.1;
      const ph = (e.getData('ph') as number) ?? 0;
      const s = Math.sin(nowSec * 14 + ph);
      e.setScale(bs * (1 + 0.14 * s), bs * (1 - 0.1 * s));
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
        this.gainXp(1); // jewels are XP
      }
    }
  }

  override shutdown() {
    super.shutdown();
    for (const w of this.weapons) w.destroy();
    this.weapons = [];
    for (const g of this.gems) {
      if (g.light) this.lights.removeLight(g.light);
    }
    this.gems = [];
    this.jewelLights = 0;
  }
}
