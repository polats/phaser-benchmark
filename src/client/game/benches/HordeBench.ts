import * as Phaser from 'phaser';
import type { GameObjects, Physics } from 'phaser';
import { BenchScene } from './BenchScene';
import { addGradientBackground, applyCinematicFX } from '../lib/look';
import { ensureRetroFont, RETRO_FONT_KEY } from '../lib/retroFont';
import { type Upgrade, type ApplyHost, type GameState, buildChoices } from '../upgrades';
import { type Weapon, type WeaponHost, createWeapon } from '../weapons';
import { RibbonTrail } from '../lib/trail';

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

type Jewel = { sprite: GameObjects.Image; light: GameObjects.Light | null; trail: RibbonTrail };

// Icons for the on-screen loadout strip (one per equipped weapon).
const WEAPON_ICONS: Record<string, { tex: string; tint: number }> = {
  bolt: { tex: 'glow', tint: 0xffe066 },
  orbit: { tex: 'ball', tint: 0x66ffee },
  nova: { tex: 'ring', tint: 0x88ccff },
  ricochet: { tex: 'ring', tint: 0x66ffaa },
  singularity: { tex: 'glow', tint: 0x9a44ff },
};

// Arena edge-light palettes. The run cycles through these on level up so the
// lighting keeps changing (and reads differently from the Spiders benchmark);
// all are kept around the same brightness. Four colours = the four edge lights.
const LIGHT_PALETTES: number[][] = [
  [0x8844bb, 0x4466cc, 0xcc4488, 0xffaa66], // arcane: purple / blue / magenta / warm
  [0x2299cc, 0x4455dd, 0x33bbcc, 0x8866ff], // frost: teal / blue / cyan / indigo
  [0xff7744, 0xcc3366, 0xff5599, 0xaa44cc], // ember: orange / crimson / pink / violet
  [0xcc55dd, 0x6644cc, 0xff88aa, 0xffcc66], // dusk: violet / indigo / rose / gold
];

// Named foes so elites/bosses read as special.
const ELITE_NAMES = ['Venomfang', 'Broodmother', 'Lurker', 'Shadowspun', 'Gravecrawler', 'Dreadmite'];
const BOSS_NAMES = ['THE WIDOW', 'ARACHNOS', 'SILKREND', 'THE DEVOURER', 'NIGHTWEAVER'];

type Special = {
  sprite: ArcadeImage;
  label: GameObjects.Text;
  bar: GameObjects.Graphics;
  aura: GameObjects.Image;
  maxHp: number;
  isBoss: boolean;
  w: number;
};

// Enemy archetypes. `face`: how it turns to the player — top-down sprites rotate,
// side-view ones flip, blobs do neither. Animated kinds play a walk spritesheet;
// the rest get the scuttle squash. The mix unlocks with the difficulty tier.
type Behavior = 'swarm' | 'charger' | 'brute' | 'splitter' | 'ranged';
type EnemyKind = {
  key: string;
  tex: string;
  anim?: string;
  face: 'rotate' | 'flip' | 'none';
  scale: number;
  tint?: number;
  hpBase: number;
  hpTier: number;
  speedMin: number;
  speedMax: number;
  speedTier: number;
  behavior: Behavior;
  minTier: number;
  weight: number;
  split?: boolean;
};
// minTier is 0 for every kind, so the full variety spawns from the start; the
// tier still scales each kind's HP/speed over time.
const ENEMY_KINDS: EnemyKind[] = [
  // Spider — the basic swarmer (normal-mapped, top-down).
  { key: 'spider', tex: 'spider', face: 'rotate', scale: 0.11, hpBase: 2, hpTier: 1, speedMin: 35, speedMax: 80, speedTier: 6, behavior: 'swarm', minTier: 0, weight: 42 },
  // Alien — animated, fast charger.
  { key: 'alien', tex: 'alien', anim: 'alien-walk', face: 'flip', scale: 0.7, hpBase: 2, hpTier: 1, speedMin: 70, speedMax: 110, speedTier: 7, behavior: 'charger', minTier: 0, weight: 20 },
  // Slime — splits into two minis on death.
  { key: 'slime', tex: 'slime', face: 'none', scale: 0.6, tint: 0xbbffaa, hpBase: 3, hpTier: 1, speedMin: 30, speedMax: 55, speedTier: 4, behavior: 'splitter', minTier: 0, weight: 16, split: true },
  // Mummy — animated, slow brute with a fat HP pool.
  { key: 'mummy', tex: 'mummy', anim: 'mummy-walk', face: 'flip', scale: 0.7, hpBase: 6, hpTier: 2, speedMin: 25, speedMax: 45, speedTier: 3, behavior: 'brute', minTier: 0, weight: 12 },
  // Spitter — keeps its distance and lobs glowing projectiles at the player.
  { key: 'spitter', tex: 'alien', anim: 'alien-walk', face: 'flip', scale: 0.62, tint: 0xcc77ff, hpBase: 3, hpTier: 1, speedMin: 40, speedMax: 65, speedTier: 3, behavior: 'ranged', minTier: 0, weight: 12 },
];

export class HordeBench extends BenchScene implements WeaponHost, ApplyHost, GameState {
  protected readonly benchId = 'horde';

  // Public for the weapon system (WeaponHost).
  player!: GameObjects.Image;
  enemies!: Physics.Arcade.Group;
  hitBurst!: GameObjects.Particles.ParticleEmitter;

  private playerLight!: GameObjects.PointLight;
  private mouseLight!: GameObjects.Light;
  private edgeLights: GameObjects.Light[] = [];
  private gems: Jewel[] = [];
  private jewelLights = 0;

  // Difficulty ramp + named elites/bosses.
  private runTime = 0;
  private specials: Special[] = [];
  private spawnAccum = 0; // fps-independent swarm top-up timer
  private introActive = false; // a boss/elite entrance cinematic is playing
  private enemyShots!: Physics.Arcade.Group; // Spitter projectiles

  // UpgradeTarget — mutable player stats, changed by chosen upgrade cards.
  damage = 1;
  fireDelayMs = 150;
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
  private shockwave?: Phaser.Filters.Barrel;
  private grade?: Phaser.Filters.ColorMatrix;
  private loadoutBox: GameObjects.Container | undefined;
  private xpBar?: GameObjects.Graphics;
  private levelText?: GameObjects.Text;

  private aura!: GameObjects.Particles.ParticleEmitter;

  constructor() {
    super({ key: 'HordeBench', physics: { arcade: { debug: false } } });
    this.targetFps = 50;
    this.stepSize = 10; // gentle: the swarm is capped (swarmCap), topped up in onUpdate
    this.maxCount = 20_000;
  }

  preload() {
    // Normal-mapped spider (diffuse + _n) so the lights actually shade them.
    this.load.image('spider', ['assets/normal-maps/spider.png', 'assets/normal-maps/spider_n.png']);
    // Normal-mapped stone floor for a lit, textured arena.
    this.load.image('stones', ['assets/normal-maps/stones.png', 'assets/normal-maps/stones_n_standard.png']);
    // Extra enemy types (Phaser examples assets): animated alien + mummy, slime.
    this.load.spritesheet('alien', 'assets/sprites/metalslug_monster39x40.png', { frameWidth: 39, frameHeight: 40 });
    this.load.spritesheet('mummy', 'assets/sprites/metalslug_mummy37x45.png', { frameWidth: 37, frameHeight: 45 });
    this.load.image('slime', 'assets/sprites/slime.png');
  }

  protected setup() {
    const { width, height } = this.scale;
    this.gems = [];
    this.jewelLights = 0;
    ensureRetroFont(this); // bitmap font for the floating damage numbers

    // Walk animations for the spritesheet enemy types (created once, global).
    if (!this.anims.exists('alien-walk')) {
      this.anims.create({
        key: 'alien-walk',
        frames: this.anims.generateFrameNumbers('alien', { start: 0, end: 15 }),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('mummy-walk')) {
      this.anims.create({
        key: 'mummy-walk',
        frames: this.anims.generateFrameNumbers('mummy', { start: 0, end: 17 }),
        frameRate: 10,
        repeat: -1,
      });
    }

    addGradientBackground(this, '#1a0f2e', '#06040c');
    // Lit, normal-mapped stone floor — gives the arena real surface depth under
    // the player + mouse lights instead of a flat gradient.
    this.add
      .tileSprite(width / 2, height / 2, width, height, 'stones')
      .setLighting(true)
      .setDepth(-900); // natural brown stone, lit by the coloured edge lights

    // Cinematic post-FX: colour grade + bloom + vignette over the whole scene.
    this.loadoutBox = undefined;
    this.cameras.main.filters.internal.clear();
    this.grade = applyCinematicFX(this.cameras.main);
    // Barrel distortion held at rest (1 = none); pulsed as a screen-warp
    // shockwave when a Nova / Singularity goes off.
    this.shockwave = this.cameras.main.filters.internal.addBarrel(1);

    // Big coloured lights off each edge light the normal-mapped stone floor.
    // The palette cycles on level up (LIGHT_PALETTES); low ambient lets it read.
    this.lights.enable();
    this.lights.setAmbientColor(0x232330);
    const big = Math.max(width, height) * 2.6;
    const pal = LIGHT_PALETTES[0]!;
    this.edgeLights = [
      this.lights.addLight(-width * 0.3, -height * 0.3, big, pal[0]!, 1),
      this.lights.addLight(width * 0.6, -height * 0.6, big, pal[1]!, 1),
      this.lights.addLight(width * 1.3, height * 0.45, big, pal[2]!, 1),
      this.lights.addLight(width * 0.3, height * 1.3, big, pal[3]!, 1.3),
    ];

    // Player: a softly glowing orb (toned down so the bloom doesn't blow it out).
    this.player = this.add.image(width / 2, height / 2, 'ball').setTint(0x55c0e0).setScale(0.82).setDepth(18);
    this.playerLight = this.add.pointlight(width / 2, height / 2, 0x4fb4dc, 150, 0.42).setDepth(4);
    this.tweens.add({ targets: this.playerLight, intensity: 0.24, duration: 700, yoyo: true, repeat: -1 });

    // Light that follows the cursor (lifted off the surface for nicer shading).
    this.mouseLight = this.lights.addLight(width / 2, height / 2, 320, 0xddeeff, 3).setZNormal(0.5);

    // Cyan aura swirling off the player.
    this.aura = this.add
      .particles(0, 0, 'glow', {
        lifespan: 650,
        speed: { min: 8, max: 38 },
        scale: { start: 0.16, end: 0 },
        alpha: { start: 0.3, end: 0 },
        tint: 0x55c0e0,
        blendMode: 'ADD',
        frequency: 55,
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

    // Spitter projectiles. The player gets a body so shots can "hit" it — for now
    // that's a visual fizzle + flash (no player HP yet).
    this.enemyShots = this.physics.add.group();
    this.physics.add.existing(this.player);
    this.physics.add.overlap(this.enemyShots, this.player, (p) => {
      const pp = p as Physics.Arcade.Image;
      this.hitBurst.explode(8, pp.x, pp.y);
      this.cameras.main.flash(70, 120, 40, 80);
      pp.destroy();
    });

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

    // Difficulty ramp + named foes. Elites arrive periodically, bosses rarely;
    // both scale with elapsed run time.
    this.runTime = 0;
    this.spawnAccum = 0;
    this.introActive = false;
    this.specials = [];
    this.time.addEvent({ delay: 17000, loop: true, callback: () => this.spawnElite() });
    this.time.addEvent({ delay: 58000, loop: true, callback: () => this.spawnBoss() });
  }

  // Difficulty tier rises with elapsed run time (every ~22s).
  private tier() {
    return Math.floor(this.runTime / 22000);
  }

  // Live swarm cap: modest at the start, grows slowly with the tier. Keeps the
  // game from being overwhelmed (the bench harness would otherwise spawn forever).
  private swarmCap() {
    return Math.min(100, 38 + this.tier() * 6);
  }

  // Weighted pick among the enemy kinds unlocked at the current tier.
  private pickKind(): EnemyKind {
    const t = this.tier();
    const pool = ENEMY_KINDS.filter((k) => t >= k.minTier);
    let total = 0;
    for (const k of pool) total += k.weight;
    let r = Phaser.Math.FloatBetween(0, total);
    for (const k of pool) {
      r -= k.weight;
      if (r <= 0) return k;
    }
    return pool[0]!;
  }

  // Spawn one enemy of a tier-appropriate kind at the edge ring.
  private spawnEnemy() {
    const { width, height } = this.scale;
    const ring = Math.hypot(width, height) / 2 + 40;
    const t = this.tier();
    const k = this.pickKind();
    const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const e = this.enemies.create(width / 2 + Math.cos(a) * ring, height / 2 + Math.sin(a) * ring, k.tex) as Physics.Arcade.Sprite;
    const sc = k.scale * Phaser.Math.FloatBetween(0.85, 1.15);
    e.setScale(sc).setDepth(10);
    e.setLighting(true);
    if (k.tex === 'spider') e.setSelfShadow(true); // only the normal-mapped one
    if (k.tint !== undefined) e.setTint(k.tint);
    if (k.anim) e.play(k.anim);
    e.setData('speed', Phaser.Math.Between(k.speedMin, k.speedMax) + t * k.speedTier);
    e.setData('hp', k.hpBase + t * k.hpTier);
    e.setData('bs', sc);
    e.setData('ph', Phaser.Math.FloatBetween(0, 6.28));
    e.setData('behavior', k.behavior);
    e.setData('face', k.face);
    e.setData('animated', k.anim ? 1 : 0);
    if (k.split) e.setData('split', 1);
  }

  // Top up the swarm toward the cap (never past it), so the count stays sane.
  protected addObjects(n: number) {
    const room = this.swarmCap() - this.enemies.getLength();
    const k = Math.max(0, Math.min(n, room));
    for (let i = 0; i < k; i++) this.spawnEnemy();
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
      const heavy = (e.getData('heavy') as number) ?? 0; // bosses barely flinch
      const kb = heavy ? 40 : 240;
      e.setVelocity((dx / d) * kb, (dy / d) * kb);
      e.setData('knock', heavy ? 70 : 180); // window where steering is suppressed
    }

    const hp = ((e.getData('hp') as number) ?? 1) - dmg;
    if (hp <= 0) {
      if (e.getData('special')) this.onSpecialKilled(e);
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
    if (e.getData('split')) this.splitSlime(e);
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

  // Spitter fires a glowing orb toward the player's current position.
  private enemyShoot(e: ArcadeImage) {
    const p = this.enemyShots.create(e.x, e.y, 'glow') as Physics.Arcade.Image;
    p.setTint(0xcc66ff).setScale(0.5).setBlendMode(Phaser.BlendModes.ADD).setDepth(16);
    this.physics.moveTo(p, this.player.x, this.player.y, 240);
    this.time.delayedCall(3200, () => {
      if (p.active) p.destroy();
    });
  }

  // A dying slime bursts into two smaller, weaker slimes (which don't split).
  private splitSlime(e: ArcadeImage) {
    const t = this.tier();
    for (let i = 0; i < 2; i++) {
      const m = this.enemies.create(
        e.x + Phaser.Math.Between(-14, 14),
        e.y + Phaser.Math.Between(-14, 14),
        'slime'
      ) as Physics.Arcade.Sprite;
      const sc = 0.32 * Phaser.Math.FloatBetween(0.85, 1.15);
      m.setScale(sc).setDepth(10).setTint(0x99ee88);
      m.setLighting(true);
      m.setData('speed', Phaser.Math.Between(55, 85) + t * 4);
      m.setData('hp', 1 + Math.floor(t / 2));
      m.setData('bs', sc);
      m.setData('ph', Phaser.Math.FloatBetween(0, 6.28));
      m.setData('behavior', 'swarm');
      m.setData('face', 'none');
    }
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
      if (this.shockwave) {
        this.tweens.add({ targets: this.shockwave, amount: 1.16, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
      }
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
    this.rebuildLoadout();
  }

  // On-screen loadout strip: an icon + level for each equipped weapon.
  private rebuildLoadout() {
    const { width, height } = this.scale;
    if (!this.loadoutBox) this.loadoutBox = this.add.container(0, 0).setScrollFactor(0).setDepth(42);
    this.loadoutBox.removeAll(true);
    const n = this.weapons.length;
    const startX = width / 2 - ((n - 1) * 46) / 2;
    const y = height - 26;
    this.weapons.forEach((w, i) => {
      const ic = WEAPON_ICONS[w.id] ?? { tex: 'glow', tint: 0xffffff };
      const x = startX + i * 46;
      const bg = this.add.circle(x, y, 17, 0x000000, 0.5);
      const icon = this.add.image(x, y, ic.tex).setTint(ic.tint).setScale(0.65).setBlendMode(Phaser.BlendModes.ADD);
      const lvl = this.add
        .text(x + 13, y + 8, String(w.level), {
          fontFamily: 'Arial Black',
          fontSize: 12,
          color: '#ffffff',
          stroke: '#000',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      this.loadoutBox!.add([bg, icon, lvl]);
    });
  }

  // Dynamic colour grade: more saturation/contrast + a warm hue push as the run
  // escalates with level, so the palette intensifies over time.
  private regrade() {
    if (!this.grade) return;
    const lv = Math.min(this.level, 14);
    this.grade.colorMatrix.reset();
    this.grade.colorMatrix
      .saturate(0.2 + lv * 0.03, true)
      .contrast(0.1 + lv * 0.012, true)
      .hue(-lv * 2, true);
  }

  // A "LEVEL N" banner that pops + fades on level up.
  private showLevelBanner() {
    const { width, height } = this.scale;
    const banner = this.add
      .text(width / 2, height * 0.3, 'LEVEL ' + this.level, {
        fontFamily: 'Arial Black',
        fontSize: 46,
        color: '#ffd166',
        stroke: '#000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(60)
      .setScale(0.4)
      .setAlpha(0);
    this.tweens.add({ targets: banner, scale: 1.1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    this.tweens.add({ targets: banner, alpha: 0, scale: 1.4, delay: 500, duration: 400, onComplete: () => banner.destroy() });
    this.hitBurst.explode(24, width / 2, height * 0.3);
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
    this.regrade();
    this.recolorLights();
    this.showLevelBanner();
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

  // Cycle the arena edge lights to the next palette so the lighting keeps
  // changing as you level (kept at the same intensities = same brightness).
  private recolorLights() {
    const pal = LIGHT_PALETTES[this.level % LIGHT_PALETTES.length]!;
    this.edgeLights.forEach((l, i) => l.setColor(pal[i % pal.length]!));
  }

  // Spawn a named special foe (elite or boss): a big, tinted, glowing spider with
  // a floating name + health bar. It joins the swarm and steers like the rest.
  private spawnSpecial(opts: {
    name: string;
    scale: number;
    hp: number;
    speed: number;
    color: number;
    isBoss: boolean;
  }) {
    const { width, height } = this.scale;
    const ring = Math.min(width, height) / 2 + 50; // just off the nearest edge
    const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const x = width / 2 + Math.cos(a) * ring;
    const y = height / 2 + Math.sin(a) * ring;

    const e = this.enemies.create(x, y, 'spider') as ArcadeImage;
    e.setScale(opts.scale).setDepth(11).setTint(opts.color);
    e.setLighting(true);
    e.setSelfShadow(true);
    e.setData('speed', opts.speed);
    e.setData('hp', opts.hp);
    e.setData('bs', opts.scale);
    e.setData('ph', Phaser.Math.FloatBetween(0, 6.28));
    e.setData('special', opts.isBoss ? 'boss' : 'elite');
    e.setData('heavy', opts.isBoss ? 1 : 0);

    const aura = this.add
      .image(x, y, 'glow')
      .setTint(opts.color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(opts.scale * 7)
      .setAlpha(0.45)
      .setDepth(9);
    this.tweens.add({ targets: aura, alpha: 0.18, duration: 700, yoyo: true, repeat: -1 });

    const label = this.add
      .text(x, y, opts.name, {
        fontFamily: 'Arial Black',
        fontSize: opts.isBoss ? 18 : 13,
        color: opts.isBoss ? '#ff5577' : '#ffcc66',
        stroke: '#000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(33);
    const bar = this.add.graphics().setDepth(33);

    this.specials.push({ sprite: e, label, bar, aura, maxHp: opts.hp, isBoss: opts.isBoss, w: opts.isBoss ? 90 : 50 });
    if (opts.isBoss) this.announceBoss(opts.name);
    this.specialIntro(e, opts.isBoss);
  }

  // Entrance cinematic: dim the arena to a dramatic low, spotlight the foe, and
  // pan + zoom the camera onto it, then ease everything back.
  private specialIntro(e: ArcadeImage, isBoss: boolean) {
    if (this.introActive) return; // don't stack cinematics
    this.introActive = true;
    const { width, height } = this.scale;
    const cam = this.cameras.main;
    this.dimLights(true);
    const spot = this.add
      .pointlight(e.x, e.y, isBoss ? 0xff3366 : 0xff7744, isBoss ? 240 : 170, isBoss ? 2.4 : 1.7)
      .setDepth(8);
    cam.pan(e.x, e.y, 300, 'Sine.easeInOut');
    cam.zoomTo(isBoss ? 1.6 : 1.35, 300, 'Sine.easeInOut');
    this.time.delayedCall(300 + (isBoss ? 850 : 480), () => {
      cam.pan(width / 2, height / 2, 340, 'Sine.easeInOut');
      cam.zoomTo(1, 340, 'Sine.easeInOut');
      this.dimLights(false);
      this.tweens.add({ targets: spot, intensity: 0, duration: 340, onComplete: () => spot.destroy() });
      this.time.delayedCall(360, () => (this.introActive = false));
    });
  }

  // Tween the arena edge lights down to a dramatic low (on) or back to normal.
  private dimLights(on: boolean) {
    this.edgeLights.forEach((l, i) => {
      const base = i === 3 ? 1.3 : 1;
      this.tweens.add({ targets: l, intensity: on ? base * 0.18 : base, duration: 280 });
    });
  }

  private spawnElite() {
    const t = this.tier();
    this.spawnSpecial({
      name: ELITE_NAMES[Phaser.Math.Between(0, ELITE_NAMES.length - 1)]!,
      scale: 0.24,
      hp: 22 + t * 12,
      speed: 30 + t * 3,
      color: 0xff5a44,
      isBoss: false,
    });
  }

  private spawnBoss() {
    const t = this.tier();
    this.spawnSpecial({
      name: BOSS_NAMES[Phaser.Math.Between(0, BOSS_NAMES.length - 1)]!,
      scale: 0.44,
      hp: 120 + t * 70,
      speed: 22 + t * 2,
      color: 0xb050ff,
      isBoss: true,
    });
  }

  // Killing a special is a payday: big juice + a shower of XP jewels.
  private onSpecialKilled(e: ArcadeImage) {
    this.juice(e.x, e.y, true);
    const n = e.getData('special') === 'boss' ? 16 : 6;
    for (let k = 0; k < n; k++) {
      this.spawnJewel(e.x + Phaser.Math.Between(-32, 32), e.y + Phaser.Math.Between(-32, 32));
    }
  }

  // Warn the player when a boss enters.
  private announceBoss(name: string) {
    const { width, height } = this.scale;
    const t = this.add
      .text(width / 2, height * 0.22, name + ' APPROACHES', {
        fontFamily: 'Arial Black',
        fontSize: 30,
        color: '#ff4466',
        stroke: '#000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(61)
      .setScale(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: height * 0.18, delay: 1300, duration: 500, onComplete: () => t.destroy() });
    this.cameras.main.shake(300, 0.006);
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
    this.gems.push({ sprite, light, trail: new RibbonTrail(this, col, 5, 9, 11) });
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
    this.runTime += delta; // drives the difficulty ramp
    // Top the swarm up toward the cap independent of FPS (the bench ramp stops
    // adding once FPS dips; the game should keep a steady swarm regardless).
    this.spawnAccum += delta;
    if (this.spawnAccum >= 550) {
      this.spawnAccum = 0;
      this.addObjects(5);
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
      const behavior = (e.getData('behavior') as string) ?? 'swarm';
      if (behavior === 'ranged') {
        // Spitter: hold a preferred distance (back off / close in / strafe) and
        // shoot on a cooldown.
        const range = 250;
        if (d < range * 0.8) e.setVelocity((-dx / d) * sp, (-dy / d) * sp);
        else if (d > range * 1.2) e.setVelocity((dx / d) * sp, (dy / d) * sp);
        else e.setVelocity((-dy / d) * sp * 0.7, (dx / d) * sp * 0.7);
        let cd = ((e.getData('shootCd') as number) ?? 1200) - delta;
        if (cd <= 0) {
          cd = 1700 + Math.random() * 700;
          this.enemyShoot(e);
        }
        e.setData('shootCd', cd);
      } else if (d > SWARM_RADIUS || behavior === 'brute') {
        // brutes plod straight in; others swirl when close to avoid piling up
        e.setVelocity((dx / d) * sp, (dy / d) * sp);
      } else {
        e.setVelocity((-dy / d) * sp * 0.9, (dx / d) * sp * 0.9);
      }
      // Face the player: top-down sprites rotate, side-view sprites flip.
      const face = (e.getData('face') as string) ?? 'rotate';
      if (face === 'rotate') e.rotation = Math.atan2(dy, dx) - Math.PI / 2;
      else if (face === 'flip') e.setFlipX(dx < 0); // art faces right by default
      // Scuttle squash for non-animated kinds (animated ones play a walk anim).
      if (!e.getData('animated')) {
        const bs = (e.getData('bs') as number) ?? 0.1;
        const ph = (e.getData('ph') as number) ?? 0;
        const s = Math.sin(nowSec * 14 + ph);
        e.setScale(bs * (1 + 0.14 * s), bs * (1 - 0.1 * s));
      }
    }

    // Elites/bosses: follow with a name label, health bar, and glow aura.
    for (let i = this.specials.length - 1; i >= 0; i--) {
      const sp = this.specials[i]!;
      const e = sp.sprite;
      if (!e.active) {
        sp.label.destroy();
        sp.bar.destroy();
        sp.aura.destroy();
        this.specials.splice(i, 1);
        continue;
      }
      sp.aura.setPosition(e.x, e.y);
      const topY = e.y - e.displayHeight / 2 - 12;
      sp.label.setPosition(e.x, topY);
      const hp = Math.max(0, (e.getData('hp') as number) ?? 0);
      const frac = sp.maxHp > 0 ? hp / sp.maxHp : 0;
      const w = sp.w;
      sp.bar.clear();
      sp.bar.fillStyle(0x000000, 0.6).fillRect(e.x - w / 2, topY + 2, w, 5);
      sp.bar.fillStyle(sp.isBoss ? 0xff3366 : 0xffaa33, 1).fillRect(e.x - w / 2, topY + 2, w * frac, 5);
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
      g.trail.push(s.x, s.y);
      if (g.light) {
        g.light.x = s.x;
        g.light.y = s.y;
      }
      if (d < 24) {
        this.hitBurst.explode(6, s.x, s.y);
        s.destroy();
        g.trail.destroy();
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
    for (const sp of this.specials) {
      sp.label.destroy();
      sp.bar.destroy();
      sp.aura.destroy();
    }
    this.specials = [];
    this.enemyShots?.destroy(true);
    for (const g of this.gems) {
      if (g.light) this.lights.removeLight(g.light);
      g.trail.destroy();
    }
    this.gems = [];
    this.jewelLights = 0;
  }
}
