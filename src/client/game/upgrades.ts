import * as Phaser from 'phaser';

// Data-driven upgrade pool for the Horde roguelite. Upgrades either tweak the
// player's stat fields (UpgradeTarget), acquire/level a weapon, or unlock a
// synergy. `available(state)` filters what can be offered (e.g. a synergy only
// appears once you own both its weapons). Rarity drives the card's edition
// shader, frame colour, and draw weight.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Mutable player stats an upgrade can change. */
export type UpgradeTarget = {
  damage: number;
  fireDelayMs: number;
  maxBolts: number;
  projectiles: number;
  critChance: number;
  jewelChance: number;
  boltSpeed: number;
  burstCount: number;
};

/** What an upgrade can do to the game (HordeBench implements this). */
export type ApplyHost = UpgradeTarget & {
  addOrLevelWeapon: (id: string) => void;
  setSynergy: (id: string) => void;
};

/** Read-only game state used to filter which upgrades may be offered. */
export type GameState = {
  ownsWeapon: (id: string) => boolean;
  weaponLevel: (id: string) => number;
  weaponCount: () => number;
  hasSynergy: (id: string) => boolean;
};

export type Upgrade = {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: { tex: string; tint: number };
  available?: (s: GameState) => boolean;
  apply: (h: ApplyHost) => void;
};

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9aa7b8,
  rare: 0x4aa3ff,
  epic: 0xb060ff,
  legendary: 0xffd000,
};

export const RARITY_EDITION: Record<Rarity, number> = {
  common: -1,
  rare: 0, // foil
  epic: 1, // holographic
  legendary: 2, // polychrome
};

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 60,
  rare: 26,
  epic: 12,
  legendary: 4,
};

const MAX_WEAPONS = 5;

export const UPGRADES: Upgrade[] = [
  // ── Weapons (acquire if new, otherwise +1 level) ──
  {
    id: 'w-bolt',
    name: 'Plasma Bolt',
    desc: 'Auto-firing bolts — new or +1 level',
    rarity: 'common',
    icon: { tex: 'glow', tint: 0xffe066 },
    apply: (h) => h.addOrLevelWeapon('bolt'),
  },
  {
    id: 'w-orbit',
    name: 'Orbit',
    desc: 'Orbs that circle you — new or +1 level',
    rarity: 'rare',
    icon: { tex: 'ball', tint: 0x66ffee },
    available: (s) => s.ownsWeapon('orbit') || s.weaponCount() < MAX_WEAPONS,
    apply: (h) => h.addOrLevelWeapon('orbit'),
  },
  {
    id: 'w-nova',
    name: 'Nova Blast',
    desc: 'Expanding shockwave — new or +1 level',
    rarity: 'epic',
    icon: { tex: 'ring', tint: 0x88ccff },
    available: (s) => s.ownsWeapon('nova') || s.weaponCount() < MAX_WEAPONS,
    apply: (h) => h.addOrLevelWeapon('nova'),
  },
  {
    id: 'w-ricochet',
    name: 'Ricochet',
    desc: 'A bolt that bounces off the walls — new or +1 level',
    rarity: 'rare',
    icon: { tex: 'ring', tint: 0x66ffaa },
    available: (s) => s.ownsWeapon('ricochet') || s.weaponCount() < MAX_WEAPONS,
    apply: (h) => h.addOrLevelWeapon('ricochet'),
  },
  {
    id: 'w-singularity',
    name: 'Singularity',
    desc: 'A gravity well that pulls the swarm in, then implodes',
    rarity: 'legendary',
    icon: { tex: 'glow', tint: 0x9a44ff },
    available: (s) => s.ownsWeapon('singularity') || s.weaponCount() < MAX_WEAPONS,
    apply: (h) => h.addOrLevelWeapon('singularity'),
  },
  // ── Synergy ──
  {
    id: 'syn-orbital-nova',
    name: 'Orbital Nova',
    desc: 'Your orbs erupt into mini-novas',
    rarity: 'legendary',
    icon: { tex: 'ring', tint: 0xff66cc },
    available: (s) => s.ownsWeapon('orbit') && s.ownsWeapon('nova') && !s.hasSynergy('orbital-nova'),
    apply: (h) => h.setSynergy('orbital-nova'),
  },
  // ── Passive stats ──
  {
    id: 'fangs',
    name: 'Sharper Fangs',
    desc: '+1 damage',
    rarity: 'common',
    icon: { tex: 'box', tint: 0xff5566 },
    apply: (t) => (t.damage += 1),
  },
  {
    id: 'rapid',
    name: 'Rapid Fire',
    desc: '-15% attack cooldown',
    rarity: 'common',
    icon: { tex: 'glow', tint: 0xffe066 },
    apply: (t) => (t.fireDelayMs *= 0.85),
  },
  {
    id: 'greed',
    name: 'Greed',
    desc: '+12% jewel drops',
    rarity: 'common',
    icon: { tex: 'jewel', tint: 0x66ffcc },
    apply: (t) => (t.jewelChance = Math.min(1, t.jewelChance + 0.12)),
  },
  {
    id: 'velocity',
    name: 'Velocity',
    desc: '+120 bolt speed',
    rarity: 'common',
    icon: { tex: 'dot', tint: 0x88ccff },
    apply: (t) => (t.boltSpeed += 120),
  },
  {
    id: 'crit',
    name: 'Critical Eye',
    desc: '+8% crit chance',
    rarity: 'rare',
    icon: { tex: 'star', tint: 0xffd166 },
    apply: (t) => (t.critChance = Math.min(1, t.critChance + 0.08)),
  },
  {
    id: 'overcharge',
    name: 'Overcharge',
    desc: '+3 damage, -10% cooldown',
    rarity: 'epic',
    icon: { tex: 'ball', tint: 0xff8844 },
    apply: (t) => {
      t.damage += 3;
      t.fireDelayMs *= 0.9;
    },
  },
  {
    id: 'bigbang',
    name: 'Big Bang',
    desc: 'Much bigger explosions',
    rarity: 'epic',
    icon: { tex: 'glow', tint: 0xff6633 },
    apply: (t) => (t.burstCount += 8),
  },
  {
    id: 'glasscannon',
    name: 'Glass Cannon',
    desc: 'x2 damage, -20% cooldown',
    rarity: 'legendary',
    icon: { tex: 'box', tint: 0xffd000 },
    apply: (t) => {
      t.damage *= 2;
      t.fireDelayMs *= 0.8;
    },
  },
];

/** Draw `n` distinct upgrades that are currently available, weighted by rarity. */
export function buildChoices(n: number, state: GameState): Upgrade[] {
  const pool = UPGRADES.filter((u) => !u.available || u.available(state));
  const chosen: Upgrade[] = [];
  for (let k = 0; k < n && pool.length > 0; k++) {
    let total = 0;
    for (const u of pool) total += RARITY_WEIGHT[u.rarity];
    let r = Phaser.Math.FloatBetween(0, total);
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      r -= RARITY_WEIGHT[pool[i]!.rarity];
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    chosen.push(pool.splice(idx, 1)[0]!);
  }
  return chosen;
}
