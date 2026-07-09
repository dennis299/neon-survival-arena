// All tuning lives here: palette, enemy/boss stats, difficulty curve,
// upgrade pool, characters. Balance changes should not require touching systems.

import type {
  CharacterDef,
  DailyModDef,
  EliteMod,
  EnemyKind,
  EvolutionDef,
  PermUpgradeDef,
  PickupKind,
  PlayerStats,
  RunMods,
  UpgradeDef,
} from './types'

export const PALETTE = {
  bg: '#07070f',
  grid: 'rgba(80, 100, 255, 0.07)',
  player: '#4dd8ff',
  playerCore: '#eaffff',
  xp: '#38ffb0',
  coin: '#ffd23e',
  hp: '#ff3d6e',
  bullet: '#8ef6ff',
  fire: '#ff8a3d',
  ice: '#9ad9ff',
  lightning: '#e6d0ff',
  explosion: '#ff9a3d',
  text: '#dfe6ff',
} as const

export const ENEMY_COLORS: Record<EnemyKind, string> = {
  bug: '#ff5db1',
  tank: '#b464ff',
  sniper: '#ffe14d',
  drone: '#64ffda',
  boomer: '#ff7a45',
  ninja: '#c8cdff',
  shield: '#7c9bff',
}

export interface EnemyDef {
  hp: number
  speed: number
  radius: number
  damage: number
  xp: number
  /** seconds into the run before this kind can spawn */
  unlockAt: number
  /** relative spawn weight once unlocked */
  weight: number
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  bug: { hp: 8, speed: 95, radius: 9, damage: 6, xp: 1, unlockAt: 0, weight: 100 },
  tank: { hp: 60, speed: 34, radius: 20, damage: 14, xp: 4, unlockAt: 45, weight: 35 },
  sniper: { hp: 20, speed: 55, radius: 11, damage: 10, xp: 3, unlockAt: 110, weight: 28 },
  drone: { hp: 14, speed: 120, radius: 10, damage: 8, xp: 2, unlockAt: 170, weight: 40 },
  boomer: { hp: 26, speed: 80, radius: 13, damage: 22, xp: 4, unlockAt: 240, weight: 26 },
  ninja: { hp: 30, speed: 90, radius: 11, damage: 12, xp: 5, unlockAt: 330, weight: 20 },
  shield: { hp: 45, speed: 55, radius: 14, damage: 12, xp: 6, unlockAt: 420, weight: 22 },
}

export const DASH = {
  /** seconds of burst movement */
  duration: 0.16,
  /** move-speed multiplier while dashing */
  speedMult: 3.4,
  cooldown: 2.6,
  /** i-frames granted on dash start (covers the burst + a grace beat) */
  iframes: 0.26,
} as const

export const COMBO = {
  /** seconds between kills before the streak breaks */
  window: 2.0,
  /** streak thresholds and the XP/coin multiplier each grants */
  tiers: [
    { at: 40, mult: 3 },
    { at: 20, mult: 2 },
    { at: 10, mult: 1.5 },
    { at: 5, mult: 1.25 },
  ],
} as const

export function comboMultiplier(combo: number): number {
  for (const t of COMBO.tiers) if (combo >= t.at) return t.mult
  return 1
}

export const DIFFICULTY = {
  /** spawn interval: start → floor, eased over rampTime seconds */
  spawnStart: 1.1,
  spawnFloor: 0.16,
  rampTime: 780,
  /** enemy hp/speed multipliers per minute elapsed (gentle curve, not a spike) */
  hpPerMin: 0.32,
  speedPerMin: 0.045,
  speedCap: 1.6,
  /** extra burst spawns per minute */
  packChancePerMin: 0.02,
  bossInterval: 180,
} as const

export const BOSS_DEFS = {
  robot: { name: 'GIANT ROBOT', hp: 950, speed: 42, radius: 42, damage: 25 },
  worm: { name: 'CYBER WORM', hp: 1150, speed: 150, radius: 30, damage: 22 },
  queen: { name: 'ALIEN QUEEN', hp: 1400, speed: 36, radius: 38, damage: 20 },
} as const

/** hp multiplier each time the boss cycle repeats */
export const BOSS_CYCLE_HP_MULT = 1.9

export function xpForLevel(level: number): number {
  return Math.round(5 + (level - 1) * 3.2 + Math.pow(level - 1, 1.65))
}

export function basePlayerStats(): PlayerStats {
  return {
    damage: 10,
    fireRate: 2.4,
    bulletSpeed: 460,
    bulletCount: 1,
    spreadDeg: 9,
    maxHp: 100,
    regen: 0,
    speed: 200,
    magnet: 70,
    pierce: 0,
    ricochet: 0,
    chain: 0,
    explosive: 0,
    explosiveMult: 1,
    fireLevel: 0,
    iceLevel: 0,
    drones: 0,
    novaLevel: 0,
    shieldOrbs: 0,
    xpMult: 1,
    coinMult: 1,
    burningGround: false,
    staticField: false,
    bulletHell: false,
    orbitalArray: false,
  }
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'damage', name: 'Overclock', icon: '⚡', maxLevel: 5, minPlayerLevel: 0,
    color: '#8ef6ff', desc: '+25% bullet damage',
    apply: (s) => { s.damage *= 1.25 },
  },
  {
    id: 'firerate', name: 'Double Fire Rate', icon: '🔫', maxLevel: 5, minPlayerLevel: 0,
    color: '#8ef6ff', desc: '+30% fire rate',
    apply: (s) => { s.fireRate *= 1.3 },
  },
  {
    id: 'speed', name: 'Faster Movement', icon: '👟', maxLevel: 4, minPlayerLevel: 0,
    color: '#38ffb0', desc: '+12% move speed',
    apply: (s) => { s.speed *= 1.12 },
  },
  {
    id: 'maxhp', name: 'Reinforced Hull', icon: '🛡️', maxLevel: 4, minPlayerLevel: 0,
    color: '#38ffb0', desc: '+25 max HP',
    apply: (s) => { s.maxHp += 25 },
  },
  {
    id: 'regen', name: 'Health Regen', icon: '💚', maxLevel: 4, minPlayerLevel: 0,
    color: '#38ffb0', desc: '+1.2 HP per second',
    apply: (s) => { s.regen += 1.2 },
  },
  {
    id: 'magnet', name: 'Gem Magnet', icon: '🧲', maxLevel: 3, minPlayerLevel: 0,
    color: '#ffd23e', desc: '+70% pickup radius',
    apply: (s) => { s.magnet *= 1.7 },
  },
  {
    id: 'triple', name: 'Triple Shot', icon: '🔱', maxLevel: 3, minPlayerLevel: 2,
    color: '#8ef6ff', desc: '+1 bullet per shot, slight spread',
    apply: (s) => { s.bulletCount += 1; s.spreadDeg += 4 },
  },
  {
    id: 'pierce', name: 'Railgun Rounds', icon: '📌', maxLevel: 3, minPlayerLevel: 2,
    color: '#e6d0ff', desc: 'Bullets pierce +1 enemy',
    apply: (s) => { s.pierce += 1 },
  },
  {
    id: 'fire', name: 'Fire Bullets', icon: '🔥', maxLevel: 3, minPlayerLevel: 3,
    color: '#ff8a3d', desc: 'Hits ignite enemies — burn damage over time',
    apply: (s) => { s.fireLevel += 1 },
  },
  {
    id: 'ice', name: 'Ice Bullets', icon: '❄️', maxLevel: 3, minPlayerLevel: 3,
    color: '#9ad9ff', desc: 'Hits slow enemies by 40%',
    apply: (s) => { s.iceLevel += 1 },
  },
  {
    id: 'chain', name: 'Lightning Chain', icon: '🌩️', maxLevel: 3, minPlayerLevel: 4,
    color: '#e6d0ff', desc: 'Hits arc to +2 nearby enemies',
    apply: (s) => { s.chain += 2 },
  },
  {
    id: 'explosive', name: 'Explosive Rounds', icon: '💥', maxLevel: 3, minPlayerLevel: 4,
    color: '#ff9a3d', desc: 'Bullets explode on impact',
    apply: (s, lv) => { s.explosive = 46 + lv * 12 },
  },
  {
    id: 'bigboom', name: 'Bigger Explosions', icon: '🧨', maxLevel: 3, minPlayerLevel: 6,
    color: '#ff9a3d', desc: '+35% explosion radius (needs Explosive)',
    apply: (s) => { s.explosiveMult *= 1.35 },
  },
  {
    id: 'ricochet', name: 'Ricochet', icon: '🎱', maxLevel: 3, minPlayerLevel: 5,
    color: '#ffd23e', desc: 'Bullets bounce to +1 extra target',
    apply: (s) => { s.ricochet += 1 },
  },
  {
    id: 'drone', name: 'Drone Companion', icon: '🛸', maxLevel: 3, minPlayerLevel: 3,
    color: '#64ffda', desc: 'Orbiting drone that auto-fires',
    apply: (s) => { s.drones += 1 },
  },
  {
    id: 'nova', name: 'Nova Pulse', icon: '💥', maxLevel: 3, minPlayerLevel: 5,
    color: '#ff5db1', desc: 'Emits a damaging shockwave every 4.5s (faster per level)',
    apply: (s) => { s.novaLevel += 1 },
  },
  {
    id: 'shield', name: 'Orbiting Shield', icon: '🔮', maxLevel: 3, minPlayerLevel: 4,
    color: '#7c9bff', desc: 'Orbiting energy orb that batters enemies on contact',
    apply: (s) => { s.shieldOrbs += 1 },
  },
  {
    id: 'xpgain', name: 'Neural Link', icon: '🧠', maxLevel: 3, minPlayerLevel: 2,
    color: '#38ffb0', desc: '+20% XP from gems',
    apply: (s) => { s.xpMult += 0.2 },
  },
]

/** Weapon evolutions: maxing both prerequisite lines guarantees the offer on
 * the next level-up. Each can be owned once. */
export const EVOLUTIONS: EvolutionDef[] = [
  {
    id: 'meteor', name: 'Meteor Storm', icon: '☄️', color: '#ff8a3d',
    requires: ['fire', 'explosive'],
    desc: 'Explosions leave burning ground that roasts everything standing in it',
    apply: (s) => { s.burningGround = true },
  },
  {
    id: 'staticfield', name: 'Static Field', icon: '🌀', color: '#e6d0ff',
    requires: ['ice', 'chain'],
    desc: 'Every 2.5s an automatic arc storm zaps and slows up to 6 nearby enemies',
    apply: (s) => { s.staticField = true },
  },
  {
    id: 'bullethell', name: 'Bullet Hell', icon: '🎇', color: '#ffd23e',
    requires: ['triple', 'ricochet'],
    desc: '+2 bullets per shot and ricochets bounce endlessly',
    apply: (s) => { s.bulletCount += 2; s.bulletHell = true },
  },
  {
    id: 'orbital', name: 'Orbital Array', icon: '🛰️', color: '#64ffda',
    requires: ['drone', 'nova'],
    desc: 'Drones fire twice as fast and every nova launches a radial bullet ring',
    apply: (s) => { s.orbitalArray = true },
  },
]

export const STATIC_FIELD = {
  interval: 2.5,
  radius: 240,
  targets: 6,
  /** fraction of player damage per zap */
  damageMult: 0.8,
  /** seconds of slow applied */
  slow: 1.6,
} as const

export const BURN_PATCH = {
  life: 3,
  /** patch radius as a fraction of the explosion radius */
  radiusMult: 0.8,
  /** damage per second as a fraction of player damage */
  dpsMult: 0.6,
  /** max simultaneous patches (perf guard) */
  cap: 24,
} as const

/** Bullet Hell never decrements ricochet — hard bounce cap instead */
export const MAX_RICOCHET_BOUNCES = 6

export const SHIELD_ORB = {
  orbit: 64,
  radius: 9,
  /** radians per second the orb ring spins */
  spin: 1.6,
  damageMult: 1.2,
  /** per-enemy seconds between orb hits */
  cooldown: 0.5,
  knockback: 46,
} as const

export const ELITE = {
  /** ~1-in-40 spawns after unlockAt seconds */
  chance: 0.025,
  unlockAt: 90,
  radiusMult: 1.6,
  hpMult: 6,
  damageMult: 1.5,
  xpMult: 1.5,
  swiftSpeedMult: 1.6,
  /** fraction of maxHp healed per second (regenerating) */
  regenFrac: 0.04,
  splitCount: 4,
  coins: 3,
} as const

export const ELITE_COLORS: Record<EliteMod, string> = {
  swift: '#4dd8ff',
  regenerating: '#38ffb0',
  splitting: '#ff5db1',
  vampiric: '#ff3d6e',
}

export const PICKUPS = {
  /** drop chance per normal (non-elite) kill */
  dropChance: 0.015,
  /** max non-chest pickups on the field */
  fieldCap: 3,
  life: 12,
  /** fade out over the last seconds of life */
  fadeTime: 3,
  radius: 18,
  /** health: fraction of maxHp restored */
  healFrac: 0.3,
  nukeDamage: 200,
  /** magnet: velocity slammed onto every gem/coin */
  magnetSpeed: 1500,
  overdriveTime: 10,
  overdriveMult: 2,
} as const

export const PICKUP_DEFS: Record<Exclude<PickupKind, 'chest'>, { color: string; glyph: string }> = {
  health: { color: '#38ffb0', glyph: '✚' },
  magnet: { color: '#ffd23e', glyph: '∩' },
  nuke: { color: '#ff3d6e', glyph: '☠' },
  overdrive: { color: '#4dd8ff', glyph: '⚡' },
}

export const CHEST = {
  eliteRewardsMin: 1,
  eliteRewardsMax: 2,
  bossRewards: 3,
  /** payout per reward when every relevant upgrade is maxed */
  coinFallback: 25,
} as const

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'vanguard', name: 'Vanguard', color: '#4dd8ff', cost: 0,
    desc: 'Balanced all-rounder. The classic glowing blue orb.',
    mod: () => {},
  },
  {
    id: 'blaze', name: 'Blaze', color: '#ff8a3d', cost: 400,
    desc: 'Starts with Fire Bullets. +15% damage, -20 max HP.',
    mod: (s) => { s.fireLevel = 1; s.damage *= 1.15; s.maxHp -= 20 },
  },
  {
    id: 'tempest', name: 'Tempest', color: '#e6d0ff', cost: 900,
    desc: 'Starts with Lightning Chain. +10% move speed, -15% damage.',
    mod: (s) => { s.chain = 2; s.speed *= 1.1; s.damage *= 0.85 },
  },
  {
    id: 'aegis', name: 'Aegis', color: '#38ffb0', cost: 1600,
    desc: 'Tank build: +50 max HP, +1 HP/s regen, -10% move speed.',
    mod: (s) => { s.maxHp += 50; s.regen += 1; s.speed *= 0.9 },
  },
]

/** Permanent coin-bought upgrades applied to every run's starting stats.
 * Cost of the next rank = baseCost * (rank + 1). Head Start is special-cased
 * by the loop (grants starting XP, not a stat). */
export const PERM_UPGRADES: PermUpgradeDef[] = [
  {
    id: 'hull', name: 'Hull Plating', icon: '🛡️', maxRank: 5, baseCost: 200,
    desc: '+10 max HP per rank',
    apply: (s, rank) => { s.maxHp += 10 * rank },
  },
  {
    id: 'damage', name: 'Damage Core', icon: '💠', maxRank: 5, baseCost: 250,
    desc: '+5% damage per rank',
    apply: (s, rank) => { s.damage *= 1 + 0.05 * rank },
  },
  {
    id: 'magnet', name: 'Magnet Coil', icon: '🧲', maxRank: 3, baseCost: 150,
    desc: '+15% gem magnet per rank',
    apply: (s, rank) => { s.magnet *= 1 + 0.15 * rank },
  },
  {
    id: 'coin', name: 'Coin Doubler', icon: '🪙', maxRank: 3, baseCost: 400,
    desc: '+20% coin gain per rank',
    apply: (s, rank) => { s.coinMult += 0.2 * rank },
  },
  {
    id: 'headstart', name: 'Head Start', icon: '🚀', maxRank: 2, baseCost: 500,
    desc: 'Start each run at +1 level per rank (free picks)',
    apply: () => {},
  },
  {
    id: 'speed', name: 'Fourth Gear', icon: '👟', maxRank: 3, baseCost: 300,
    desc: '+4% move speed per rank',
    apply: (s, rank) => { s.speed *= 1 + 0.04 * rank },
  },
]

export function permUpgradeCost(def: PermUpgradeDef, rank: number): number {
  return def.baseCost * (rank + 1)
}

export function applyPermUpgrades(stats: PlayerStats, ranks: Record<string, number>) {
  for (const def of PERM_UPGRADES) {
    const rank = Math.min(def.maxRank, ranks[def.id] ?? 0)
    if (rank > 0) def.apply(stats, rank)
  }
}

export function defaultRunMods(): RunMods {
  return {
    spawnRateMult: 1,
    spawnFloorMult: 1,
    weightMult: {},
    enemySpeedMult: 1,
    eliteChance: null,
  }
}

/** Daily challenge modifiers, indexed by UTC day-of-week (0 = Sunday). */
export const DAILY_MODS: DailyModDef[] = [
  {
    id: 'swarm', name: 'Swarm Day',
    desc: 'Bugs only — at twice the spawn rate',
    apply: (_s, m) => {
      m.spawnRateMult = 2
      m.weightMult = { tank: 0, sniper: 0, drone: 0, boomer: 0, ninja: 0, shield: 0 }
    },
  },
  {
    id: 'glass', name: 'Glass Cannon',
    desc: 'Double damage dealt, half max HP',
    apply: (s) => { s.damage *= 2; s.maxHp = Math.round(s.maxHp * 0.5) },
  },
  {
    id: 'blitz', name: 'Blitz',
    desc: 'Enemies move 40% faster, +50% XP',
    apply: (s, m) => { m.enemySpeedMult = 1.4; s.xpMult += 0.5 },
  },
  {
    id: 'tanks', name: 'Tank Parade',
    desc: 'Tanks and shield guards spawn 3x as often',
    apply: (_s, m) => { m.weightMult = { tank: 3, shield: 3 } },
  },
  {
    id: 'fog', name: 'Fog of War',
    desc: 'Spawn pressure ramps to twice the usual ceiling',
    apply: (_s, m) => { m.spawnFloorMult = 0.5 },
  },
  {
    id: 'rich', name: 'Rich Rush',
    desc: 'Triple coin gain',
    apply: (s) => { s.coinMult *= 3 },
  },
  {
    id: 'elite', name: 'Elite Hour',
    desc: 'Elite spawn chance jumps to 8%',
    apply: (_s, m) => { m.eliteChance = 0.08 },
  },
]

/** 'YYYY-MM-DD' in UTC — the daily challenge rolls over at midnight UTC */
export function dailyKey(now = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** deterministic seed for the day: everyone plays the same run */
export function dailySeed(key = dailyKey()): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0
  return h
}

export function todaysDailyMod(now = new Date()): DailyModDef {
  return DAILY_MODS[now.getUTCDay()]
}

/** daily scores share the normal 'scores' table, tagged via character_id */
export function dailyBoardId(key = dailyKey()): string {
  return 'daily:' + key.replace(/-/g, '')
}

export interface AchievementDef {
  id: string
  name: string
  desc: string
  icon: string
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-blood', name: 'First Blood', desc: 'Kill your first enemy', icon: '🩸' },
  { id: 'survive-5', name: 'Warm-Up', desc: 'Survive 5 minutes', icon: '⏱️' },
  { id: 'survive-10', name: 'Veteran', desc: 'Survive 10 minutes', icon: '🎖️' },
  { id: 'survive-18', name: 'Neon Legend', desc: 'Survive 18 minutes', icon: '👑' },
  { id: 'survive-25', name: 'Immortal', desc: 'Survive 25 minutes', icon: '♾️' },
  { id: 'boss-1', name: 'Giant Slayer', desc: 'Defeat a boss', icon: '🤖' },
  { id: 'boss-3', name: 'Exterminator', desc: 'Defeat 3 bosses in one run', icon: '💀' },
  { id: 'boss-10', name: 'Boss Hunter', desc: 'Defeat 10 bosses (lifetime)', icon: '🏆' },
  { id: 'level-20', name: 'Maxed Out', desc: 'Reach level 20 in one run', icon: '📈' },
  { id: 'level-30', name: 'Ascended', desc: 'Reach level 30 in one run', icon: '🌟' },
  { id: 'kills-1000', name: 'Swarm Breaker', desc: '1,000 total kills (lifetime)', icon: '🐛' },
  { id: 'kills-10000', name: 'Swarm Ender', desc: '10,000 total kills (lifetime)', icon: '🌊' },
  { id: 'combo-25', name: 'Rampage', desc: '25 kill streak in one run', icon: '🔥' },
  { id: 'combo-50', name: 'Unstoppable', desc: '50 kill streak in one run', icon: '⚡' },
  { id: 'evolution-1', name: 'Evolved', desc: 'Take a weapon evolution', icon: '🧬' },
  { id: 'evolution-4', name: 'Apex Form', desc: 'All four evolutions in one run', icon: '👾' },
  { id: 'elite-10', name: 'Elite Slayer', desc: 'Kill 10 elites (lifetime)', icon: '☠️' },
  { id: 'dash-100', name: 'Blur', desc: 'Dash 100 times (lifetime)', icon: '💨' },
  { id: 'nuke-1', name: 'Big Red Button', desc: 'Grab a nuke pickup', icon: '☢️' },
  { id: 'chest-10', name: 'Treasure Hunter', desc: 'Open 10 chests (lifetime)', icon: '🗝️' },
  { id: 'daily-1', name: 'Clocking In', desc: 'Finish a daily challenge', icon: '📅' },
  { id: 'rich', name: 'Crypto Miner', desc: 'Hold 1,000 coins', icon: '💰' },
  { id: 'rich-5000', name: 'Crypto Whale', desc: 'Hold 5,000 coins', icon: '🐋' },
  { id: 'perm-max', name: 'Fully Loaded', desc: 'Max out a permanent upgrade', icon: '🔩' },
]
