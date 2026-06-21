import * as Phaser from 'phaser';

// Data-driven upgrade pool for the Horde roguelite level-up loop. Each upgrade
// mutates the player's stat fields (UpgradeTarget) when chosen. Rarity drives the
// card's edition shader + frame colour + draw weight.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** The mutable player stats an upgrade can change (HordeBench implements this). */
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

export type Upgrade = {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  icon: { tex: string; tint: number };
  apply: (t: UpgradeTarget) => void;
};

export const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x9aa7b8,
  rare: 0x4aa3ff,
  epic: 0xb060ff,
  legendary: 0xffd000,
};

// Edition shader mode per rarity (-1 = none). See cardShaders.ts EDITION_FRAG.
export const RARITY_EDITION: Record<Rarity, number> = {
  common: -1,
  rare: 0, // foil
  epic: 1, // holographic
  legendary: 2, // polychrome
};

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 60,
  rare: 25,
  epic: 12,
  legendary: 4,
};

export const UPGRADES: Upgrade[] = [
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
    id: 'extra-bolt',
    name: 'Split Shot',
    desc: '+1 projectile',
    rarity: 'rare',
    icon: { tex: 'glow', tint: 0x9b8cff },
    apply: (t) => {
      t.projectiles += 1;
      t.maxBolts += 8;
    },
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
  {
    id: 'swarmslayer',
    name: 'Swarm Slayer',
    desc: '+2 projectiles, +10% crit',
    rarity: 'legendary',
    icon: { tex: 'star', tint: 0xff66cc },
    apply: (t) => {
      t.projectiles += 2;
      t.maxBolts += 16;
      t.critChance = Math.min(1, t.critChance + 0.1);
    },
  },
];

/** Draw `n` distinct upgrades, weighted by rarity. */
export function pickUpgrades(n: number): Upgrade[] {
  const pool = UPGRADES.slice();
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
