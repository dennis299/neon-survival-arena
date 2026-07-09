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

export interface Enemy {
  id: number
  kind: EnemyKind
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

export interface UpgradeChoice {
  def: UpgradeDef
  /** level this pick would bring the upgrade to (1-based) */
  nextLevel: number
}

export interface CharacterDef {
  id: string
  name: string
  desc: string
  color: string
  cost: number
  mod: (s: PlayerStats) => void
}

export interface RunStats {
  time: number
  kills: number
  level: number
  coins: number
  bossesKilled: number
  damageDealt: number
  maxCombo: number
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
  /** 0..1 how hairy things are right now — drives the music's intensity */
  danger: number
}

export interface GameCallbacks {
  onHud: (h: HudSnapshot) => void
  onLevelUp: (choices: UpgradeChoice[]) => void
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
}
