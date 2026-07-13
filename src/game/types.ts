// Shared game types. The whole sim lives in one mutable GameState owned by the
// canvas loop; React only ever sees snapshots pushed through GameCallbacks.

export interface Vec2 {
  x: number
  y: number
}

export type EnemyKind =
  | 'bug'
  | 'tank'
  | 'sniper'
  | 'drone'
  | 'boomer'
  | 'ninja'
  | 'shield'

export type BossKind = 'robot' | 'worm' | 'queen'

export type EliteMod = 'swift' | 'regenerating' | 'splitting' | 'vampiric'

export interface Enemy {
  id: number
  kind: EnemyKind
  /** rare buffed variant; drops a treasure chest */
  elite?: EliteMod
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  speed: number
  radius: number
  damage: number
  xp: number
  /** seconds of ice slow remaining */
  slow: number
  /** seconds of burn remaining */
  burn: number
  burnDps: number
  hitFlash: number
  /** generic per-kind AI timer */
  t: number
  phase: number
  /** facing angle — shield enemies block damage from this direction */
  angle: number
  /** per-enemy cooldown before an orbiting shield orb can hit it again */
  orbHitT: number
  dead: boolean
}

export interface Boss {
  kind: BossKind
  name: string
  x: number
  y: number
  vx: number
  vy: number
  hp: number
  maxHp: number
  radius: number
  damage: number
  speed: number
  t: number
  attackT: number
  phase: number
  angle: number
  /** worm: burrowed underground (untargetable) */
  hidden: boolean
  hitFlash: number
  dead: boolean
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  life: number
  pierce: number
  ricochet: number
  chain: number
  /** explosion radius, 0 = none */
  explosive: number
  fire: boolean
  ice: boolean
  fromDrone: boolean
  /** ricochets taken so far — Bullet Hell stops decrementing, so cap here */
  bounces: number
  hitIds: Set<number>
}

export interface EnemyBullet {
  x: number
  y: number
  vx: number
  vy: number
  damage: number
  radius: number
  life: number
  /** what to blame on the death screen if this projectile lands the kill */
  source: string
}

export interface Gem {
  x: number
  y: number
  vx: number
  vy: number
  value: number
  radius: number
  isCoin: boolean
  t: number
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  /** additive glow blob vs plain square spark */
  glow: boolean
}

export interface FloatingText {
  x: number
  y: number
  vy: number
  life: number
  text: string
  color: string
  size: number
}

/** A continuously-drifting background particle (embers/snow/spores/stars) that
 * sells an environment's atmosphere. Never expires — it wraps around the
 * player instead of fading, unlike combat Particles. */
export interface AmbientParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  twinklePhase: number
}

export interface Drone {
  angle: number
  fireT: number
}

export type PickupKind = 'health' | 'magnet' | 'nuke' | 'overdrive' | 'chest'

/** Ground power-up. Chests never expire; the rest fade out near end of life. */
export interface Pickup {
  x: number
  y: number
  kind: PickupKind
  t: number
  /** seconds until despawn (Infinity for chests) */
  life: number
  /** chest only: reward count rolled when opened */
  rewards: number
}

/** Burning ground left behind by Meteor Storm explosions. */
export interface BurnPatch {
  x: number
  y: number
  radius: number
  life: number
  maxLife: number
}

/** All stackable player stats. Upgrades mutate this. */
export interface PlayerStats {
  damage: number
  /** shots per second */
  fireRate: number
  bulletSpeed: number
  bulletCount: number
  spreadDeg: number
  maxHp: number
  regen: number
  speed: number
  magnet: number
  pierce: number
  ricochet: number
  chain: number
  explosive: number
  explosiveMult: number
  fireLevel: number
  iceLevel: number
  drones: number
  novaLevel: number
  /** orbiting melee orbs (Orbiting Shield upgrade) */
  shieldOrbs: number
  /** XP multiplier (Neural Link upgrade), 1 = none */
  xpMult: number
  /** coin gain multiplier (Coin Doubler perm upgrade / Rich Rush daily), 1 = none */
  coinMult: number
  // --- weapon evolution flags ---
  /** Meteor Storm: explosions leave burning ground */
  burningGround: boolean
  /** Static Field: periodic auto arc-storm that zaps + slows */
  staticField: boolean
  /** Bullet Hell: ricochets no longer decrement */
  bulletHell: boolean
  /** Orbital Array: drones fire 2x, novas add a radial bullet ring */
  orbitalArray: boolean
}

export interface Player extends PlayerStats {
  x: number
  y: number
  hp: number
  aim: number
  fireT: number
  regenT: number
  hurtFlash: number
  /** invulnerability seconds after taking a hit */
  iframes: number
  novaT: number
  triggerNova: boolean
  /** seconds of dash burst remaining (0 = not dashing) */
  dashT: number
  /** seconds until the dash is ready again */
  dashCd: number
  dashDirX: number
  dashDirY: number
  /** seconds of 2x fire rate remaining (overdrive pickup) */
  overdriveT: number
  /** Static Field evolution: countdown to the next arc storm */
  staticT: number
  triggerStatic: boolean
}

export interface UpgradeDef {
  id: string
  name: string
  desc: string
  icon: string
  maxLevel: number
  /** later-game exotic picks are weighted in after minLevel */
  minPlayerLevel: number
  color: string
  apply: (s: PlayerStats, level: number) => void
}

/** Weapon evolution: unlocked by maxing both prerequisite upgrade lines.
 * Guaranteed to appear in the next level-up roll once eligible. */
export interface EvolutionDef {
  id: string
  name: string
  desc: string
  icon: string
  color: string
  /** both upgrade ids must be at maxLevel */
  requires: [string, string]
  apply: (s: PlayerStats) => void
}

export interface UpgradeChoice {
  def: UpgradeDef | EvolutionDef
  /** level this pick would bring the upgrade to (1-based) */
  nextLevel: number
  isEvolution?: boolean
}

/** One reward inside a treasure chest, already rolled (applied on CLAIM). */
export interface ChestReward {
  name: string
  icon: string
  color: string
  desc: string
  /** level the upgrade reaches; 0 = coin payout */
  level: number
}

export interface CharacterDef {
  id: string
  name: string
  desc: string
  color: string
  cost: number
  mod: (s: PlayerStats) => void
}

/** Run-wide modifier knobs set by the daily challenge; all neutral by default
 * (see defaultRunMods in config). Read by the spawn director. */
export interface RunMods {
  /** divides the spawn interval — 2 = twice the spawn pressure */
  spawnRateMult: number
  /** scales the spawn-interval floor — 0.5 = late-game pressure hits harder */
  spawnFloorMult: number
  /** per-kind spawn weight multiplier; 0 removes the kind entirely */
  weightMult: Partial<Record<EnemyKind, number>>
  /** enemy move-speed multiplier applied at spawn */
  enemySpeedMult: number
  /** overrides ELITE.chance when set */
  eliteChance: number | null
}

/** One daily-challenge modifier; rotates by UTC day-of-week. */
export interface DailyModDef {
  id: string
  name: string
  desc: string
  apply: (s: PlayerStats, mods: RunMods) => void
}

/** Permanent (coin-bought, persists across runs) player upgrade.
 * Cost of the next rank = baseCost * (rank + 1). */
export interface PermUpgradeDef {
  id: string
  name: string
  icon: string
  desc: string
  maxRank: number
  baseCost: number
  apply: (s: PlayerStats, rank: number) => void
}

export interface RunStats {
  time: number
  kills: number
  level: number
  coins: number
  bossesKilled: number
  damageDealt: number
  maxCombo: number
  /** weapon evolutions taken this run */
  evolutions: number
  eliteKills: number
  dashes: number
  nukesUsed: number
  chestsOpened: number
  /** what landed the killing blow, e.g. "GIANT ROBOT" */
  killedBy: string
  upgrades: { name: string; level: number; icon: string; color: string }[]
  newBest: boolean
}

export interface HudSnapshot {
  hp: number
  maxHp: number
  xp: number
  xpNeeded: number
  level: number
  time: number
  kills: number
  coins: number
  bossHp: number
  bossMaxHp: number
  bossName: string
  fps: number
  envId: string
  envName: string
  combo: number
  comboMult: number
  maxCombo: number
  /** weapon evolutions taken so far — live achievement checks */
  evolutions: number
  /** the personal best this run is chasing (0 = none yet) */
  bestTime: number
  /** 0..1 how hairy things are right now — drives the music's intensity */
  danger: number
}

export interface GameCallbacks {
  onHud: (h: HudSnapshot) => void
  onLevelUp: (choices: UpgradeChoice[]) => void
  /** treasure chest touched — sim pauses until controls.claimChest() */
  onChest: (rewards: ChestReward[]) => void
  onGameOver: (stats: RunStats) => void
}

export interface GameState {
  time: number
  kills: number
  level: number
  xp: number
  xpNeeded: number
  coins: number
  damageDealt: number
  bossesKilled: number
  running: boolean
  paused: boolean
  over: boolean
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  enemyBullets: EnemyBullet[]
  gems: Gem[]
  pickups: Pickup[]
  burnPatches: BurnPatch[]
  particles: Particle[]
  texts: FloatingText[]
  droneUnits: Drone[]
  boss: Boss | null
  /** minutes-based boss cycle index */
  bossCycle: number
  bossWarnT: number
  spawnT: number
  shake: number
  nextId: number
  upgradesTaken: Record<string, number>
  ambientParticles: AmbientParticle[]
  /** index into ENVIRONMENTS */
  envIndex: number
  /** seconds remaining before the next environment switch */
  envT: number
  /** seconds remaining to show the "ENTERING <name>" banner */
  envBannerT: number
  /** caps particle/ambient counts for battery/perf on lower-end devices */
  lowEffects: boolean
  /** kill-streak count; decays when the combo window lapses */
  combo: number
  /** seconds left in the combo window */
  comboT: number
  maxCombo: number
  /** seconds of frame-freeze remaining (impact frames) */
  hitStop: number
  /** sim speed, 1 = normal; the death slow-mo ramps this down */
  timeScale: number
  /** death cinematic in progress — sim keeps running slow, input ignored */
  dying: boolean
  deathT: number
  /** camera zoom, eased toward deathZoom during the death cinematic */
  zoom: number
  /** last thing that damaged the player, blamed on the recap screen */
  lastHitBy: string
  /** owned weapon evolution ids */
  evolutions: string[]
  /** reward count of a chest touched this frame; loop opens it (0 = none) */
  chestPendingRewards: number
  /** seconds of full-screen white flash remaining (nuke pickup) */
  flashT: number
  /** daily-challenge modifier knobs; neutral for normal runs */
  mods: RunMods
  // --- per-run achievement counters ---
  eliteKills: number
  dashes: number
  nukesUsed: number
  chestsOpened: number
  /** run time has passed the personal best (fires the banner/sting once) */
  pbBeaten: boolean
  /** seconds remaining on the "NEW RECORD" banner */
  pbBannerT: number
}
