// Collision + damage resolution: spatial hash broad-phase, bullet effects
// (pierce / ricochet / chain / explosive / fire / ice), contact damage,
// kill sweep with drops. This is the hot path — everything is O(n) with
// small constant lookups.

import {
  BURN_PATCH,
  CHEST,
  COMBO,
  ELITE,
  ELITE_COLORS,
  ENEMY_COLORS,
  MAX_RICOCHET_BOUNCES,
  PALETTE,
  PICKUPS,
  SHIELD_ORB,
  STATIC_FIELD,
  comboMultiplier,
} from '../config'
import { sfx } from '../audio'
import { haptics } from '../haptics'
import { rng } from '../rng'
import { dropCoin, dropGem } from '../entities/gem'
import { createEnemy } from '../entities/enemy'
import { fireRadialRing } from '../entities/bullet'
import { ENEMY_CAP, difficultyMults } from './spawn'
import { dropChest, dropPickup } from './pickup'
import { addText, spawnBurst, spawnExplosionFx } from './particles'
import type { Boss, Bullet, Enemy, EnemyKind, GameState } from '../types'

const CELL = 72
const HURT_IFRAMES = 0.6
const COIN_DROP_CHANCE = 0.08

/** blame labels for the "KILLED BY" line on the recap screen */
export const KILLER_NAMES: Record<EnemyKind, string> = {
  bug: 'A BUG',
  tank: 'A TANK',
  sniper: 'A SNIPER',
  drone: 'A DRONE',
  boomer: 'A BOOMER',
  ninja: 'A NINJA',
  shield: 'A SHIELD GUARD',
}

type Grid = Map<number, Enemy[]>

function cellKey(cx: number, cy: number): number {
  return (cx + 32768) * 65536 + (cy + 32768)
}

function buildGrid(enemies: Enemy[]): Grid {
  const grid: Grid = new Map()
  for (const e of enemies) {
    if (e.dead) continue
    const key = cellKey(Math.floor(e.x / CELL), Math.floor(e.y / CELL))
    const bucket = grid.get(key)
    if (bucket) bucket.push(e)
    else grid.set(key, [e])
  }
  return grid
}

function nearby(grid: Grid, x: number, y: number, r: number, out: Enemy[]): Enemy[] {
  out.length = 0
  const minX = Math.floor((x - r) / CELL)
  const maxX = Math.floor((x + r) / CELL)
  const minY = Math.floor((y - r) / CELL)
  const maxY = Math.floor((y + r) / CELL)
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      const bucket = grid.get(cellKey(cx, cy))
      if (bucket) for (const e of bucket) out.push(e)
    }
  }
  return out
}

/** Apply damage respecting the shield enemy's frontal block. Returns actual damage dealt. */
function damageEnemy(state: GameState, e: Enemy, dmg: number, fromX: number, fromY: number): number {
  if (e.kind === 'shield') {
    const hitAngle = Math.atan2(fromY - e.y, fromX - e.x)
    let diff = Math.abs(hitAngle - e.angle)
    if (diff > Math.PI) diff = Math.PI * 2 - diff
    if (diff < Math.PI / 3) {
      // frontal — blocked
      addText(state, e.x, e.y - e.radius, 'BLOCK', '#7c9bff', 11)
      spawnBurst(state, e.x, e.y, '#7c9bff', 3, 60, 2, 0.25, true)
      return 0
    }
  }
  e.hp -= dmg
  e.hitFlash = 0.1
  state.damageDealt += dmg
  addText(state, e.x, e.y - e.radius - 4, String(Math.round(dmg)), PALETTE.text)
  return dmg
}

function applyStatus(state: GameState, e: Enemy) {
  const p = state.player
  if (p.fireLevel > 0) {
    e.burn = 2
    e.burnDps = p.damage * 0.25 * p.fireLevel
  }
  if (p.iceLevel > 0) {
    e.slow = 0.8 + p.iceLevel * 0.5
  }
}

function chainLightning(state: GameState, grid: Grid, from: Enemy, bullet: Bullet, scratch: Enemy[]) {
  let source = from
  let jumps = bullet.chain
  const hit = new Set<number>([from.id])
  while (jumps > 0) {
    let best: Enemy | null = null
    let bestD = 150 * 150
    for (const e of nearby(grid, source.x, source.y, 150, scratch)) {
      if (e.dead || e.hp <= 0 || hit.has(e.id)) continue
      const d = (e.x - source.x) ** 2 + (e.y - source.y) ** 2
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    if (!best) break
    hit.add(best.id)
    // lightning visual: sparks along the arc
    const steps = 4
    for (let s = 0; s <= steps; s++) {
      const lx = source.x + ((best.x - source.x) * s) / steps
      const ly = source.y + ((best.y - source.y) * s) / steps
      spawnBurst(state, lx, ly, PALETTE.lightning, 2, 40, 2, 0.18, true)
    }
    damageEnemy(state, best, bullet.damage * 0.6, source.x, source.y)
    applyStatus(state, best)
    source = best
    jumps--
  }
}

export function explode(
  state: GameState,
  grid: Grid,
  x: number,
  y: number,
  radius: number,
  damage: number,
  scratch: Enemy[],
) {
  sfx.explosion()
  spawnExplosionFx(state, x, y, radius)
  // Meteor Storm evolution: every explosion scorches the ground
  if (state.player.burningGround && state.burnPatches.length < BURN_PATCH.cap) {
    state.burnPatches.push({
      x,
      y,
      radius: radius * BURN_PATCH.radiusMult,
      life: BURN_PATCH.life,
      maxLife: BURN_PATCH.life,
    })
  }
  for (const e of nearby(grid, x, y, radius, scratch)) {
    if (e.dead) continue
    const d = Math.hypot(e.x - x, e.y - y)
    if (d < radius + e.radius) {
      // explosions ignore shield facing (splash)
      e.hp -= damage
      e.hitFlash = 0.1
      state.damageDealt += damage
    }
  }
  const b = state.boss
  if (b && !b.dead && !b.hidden && Math.hypot(b.x - x, b.y - y) < radius + b.radius) {
    b.hp -= damage
    b.hitFlash = 0.1
    state.damageDealt += damage
  }
}

function retargetRicochet(bullet: Bullet, grid: Grid, scratch: Enemy[], infinite: boolean): boolean {
  let best: Enemy | null = null
  let bestD = 260 * 260
  for (const e of nearby(grid, bullet.x, bullet.y, 260, scratch)) {
    if (e.dead || e.hp <= 0 || bullet.hitIds.has(e.id)) continue
    const d = (e.x - bullet.x) ** 2 + (e.y - bullet.y) ** 2
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  if (!best) return false
  const ang = Math.atan2(best.y - bullet.y, best.x - bullet.x)
  const speed = Math.hypot(bullet.vx, bullet.vy)
  bullet.vx = Math.cos(ang) * speed
  bullet.vy = Math.sin(ang) * speed
  bullet.life = Math.max(bullet.life, 0.8)
  bullet.bounces++
  // Bullet Hell evolution: bounces are free, only the hard cap stops them
  if (!infinite) bullet.ricochet--
  return true
}

function hitBoss(state: GameState, bullet: Bullet, boss: Boss): boolean {
  if (boss.dead || boss.hidden) return false
  const r = boss.radius + bullet.radius
  if ((boss.x - bullet.x) ** 2 + (boss.y - bullet.y) ** 2 > r * r) return false
  boss.hp -= bullet.damage
  boss.hitFlash = 0.08
  state.damageDealt += bullet.damage
  addText(state, bullet.x, bullet.y - 10, String(Math.round(bullet.damage)), PALETTE.text)
  spawnBurst(state, bullet.x, bullet.y, PALETTE.bullet, 4, 100, 2.5, 0.25, true)
  sfx.hit()
  return true
}

export function resolveCollisions(state: GameState, dt: number) {
  const grid = buildGrid(state.enemies)
  const scratch: Enemy[] = []
  const p = state.player

  // --- nova pulse ---
  if (p.triggerNova) {
    p.triggerNova = false
    const radius = 100 + p.novaLevel * 40
    const damage = p.damage * 1.5 * p.novaLevel
    explode(state, grid, p.x, p.y, radius, damage, scratch)

    // extra visual pop for the nova
    for (let i = 0; i < 3; i++) {
      spawnBurst(state, p.x, p.y, '#ff5db1', 12, radius * 1.5, 5, 0.6, true)
    }
    // Orbital Array evolution: nova also launches a radial bullet ring
    if (p.orbitalArray) fireRadialRing(state)
  }

  // --- Static Field evolution: arc storm zaps + slows nearby enemies ---
  if (p.triggerStatic) {
    p.triggerStatic = false
    let zapped = 0
    for (const e of nearby(grid, p.x, p.y, STATIC_FIELD.radius, scratch)) {
      if (e.dead || e.hp <= 0) continue
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > STATIC_FIELD.radius ** 2) continue
      damageEnemy(state, e, p.damage * STATIC_FIELD.damageMult, p.x, p.y)
      e.slow = Math.max(e.slow, STATIC_FIELD.slow)
      // arc visual: sparks along the player→target line
      const steps = 5
      for (let s = 0; s <= steps; s++) {
        const lx = p.x + ((e.x - p.x) * s) / steps
        const ly = p.y + ((e.y - p.y) * s) / steps
        spawnBurst(state, lx, ly, PALETTE.lightning, 2, 40, 2, 0.2, true)
      }
      if (++zapped >= STATIC_FIELD.targets) break
    }
    if (zapped > 0) sfx.staticZap()
  }

  // --- orbiting shield orbs: melee damage + knockback with per-enemy cooldown ---
  if (p.shieldOrbs > 0) {
    for (let i = 0; i < p.shieldOrbs; i++) {
      const a = state.time * SHIELD_ORB.spin + (i / p.shieldOrbs) * Math.PI * 2
      const ox = p.x + Math.cos(a) * SHIELD_ORB.orbit
      const oy = p.y + Math.sin(a) * SHIELD_ORB.orbit
      for (const e of nearby(grid, ox, oy, SHIELD_ORB.radius + 24, scratch)) {
        if (e.dead || e.hp <= 0 || e.orbHitT > 0) continue
        const r = e.radius + SHIELD_ORB.radius
        if ((e.x - ox) ** 2 + (e.y - oy) ** 2 > r * r) continue
        e.orbHitT = SHIELD_ORB.cooldown
        damageEnemy(state, e, p.damage * SHIELD_ORB.damageMult, ox, oy)
        // shove away from the player
        const d = Math.hypot(e.x - p.x, e.y - p.y) || 1
        e.x += ((e.x - p.x) / d) * SHIELD_ORB.knockback
        e.y += ((e.y - p.y) / d) * SHIELD_ORB.knockback
        spawnBurst(state, ox, oy, '#7c9bff', 4, 110, 2.5, 0.25, true)
      }
    }
  }

  // --- burning ground (Meteor Storm) ---
  {
    const patches = state.burnPatches
    for (let i = patches.length - 1; i >= 0; i--) {
      const bp = patches[i]
      bp.life -= dt
      if (bp.life <= 0) {
        patches[i] = patches[patches.length - 1]
        patches.pop()
        continue
      }
      const dps = p.damage * BURN_PATCH.dpsMult
      for (const e of nearby(grid, bp.x, bp.y, bp.radius, scratch)) {
        if (e.dead || e.hp <= 0) continue
        const r = bp.radius + e.radius
        if ((e.x - bp.x) ** 2 + (e.y - bp.y) ** 2 > r * r) continue
        e.hp -= dps * dt
        state.damageDealt += dps * dt
      }
      if (Math.random() < dt * 8) {
        spawnBurst(state, bp.x + (Math.random() - 0.5) * bp.radius, bp.y + (Math.random() - 0.5) * bp.radius, PALETTE.fire, 1, 30, 2.5, 0.4, true)
      }
    }
  }

  // --- player bullets vs enemies & boss ---
  const bullets = state.bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    let consumed = false

    for (const e of nearby(grid, b.x, b.y, b.radius + 24, scratch)) {
      if (e.dead || e.hp <= 0 || b.hitIds.has(e.id)) continue
      const r = e.radius + b.radius
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > r * r) continue

      b.hitIds.add(e.id)
      const dealt = damageEnemy(state, e, b.damage, b.x, b.y)
      if (dealt > 0) {
        applyStatus(state, e)
        sfx.hit()
        spawnBurst(state, b.x, b.y, ENEMY_COLORS[e.kind], 4, 110, 2.5, 0.25, true)
        if (b.chain > 0) chainLightning(state, grid, e, b, scratch)
        if (b.explosive > 0) {
          explode(state, grid, b.x, b.y, b.explosive, b.damage * 0.6, scratch)
          consumed = true
          break
        }
      }

      if (b.pierce > 0) {
        b.pierce--
      } else if (
        b.ricochet > 0 &&
        b.bounces < MAX_RICOCHET_BOUNCES &&
        retargetRicochet(b, grid, scratch, p.bulletHell)
      ) {
        // bounced — keeps flying
      } else {
        consumed = true
      }
      break
    }

    if (!consumed && state.boss && hitBoss(state, b, state.boss)) {
      if (b.chain > 0 || b.explosive > 0) {
        if (b.explosive > 0) explode(state, grid, b.x, b.y, b.explosive, b.damage * 0.6, scratch)
      }
      if (b.pierce > 0) b.pierce--
      else consumed = true
    }

    if (consumed) {
      bullets[i] = bullets[bullets.length - 1]
      bullets.pop()
    }
  }

  // --- kill sweep: drops, combo streak, boomer detonation ---
  for (const e of state.enemies) {
    if (e.dead || e.hp > 0) continue
    e.dead = true
    state.kills++
    bumpCombo(state)
    if (e.kind === 'boomer') {
      // detonates on death regardless of cause
      sfx.explosion()
      spawnExplosionFx(state, e.x, e.y, 70)
      const d = Math.hypot(p.x - e.x, p.y - e.y)
      if (d < 70 + 12 && p.iframes <= 0 && e.phase === 2) {
        hurtPlayer(state, e.damage, 'A BOOMER BLAST')
      }
    } else {
      sfx.enemyDie()
    }
    spawnBurst(state, e.x, e.y, ENEMY_COLORS[e.kind], 10, 150, 3.5, 0.45, true)
    dropGem(state, e.x, e.y, e.xp)
    if (e.elite) {
      // elites are always worth stopping for
      state.eliteKills++
      state.hitStop = Math.max(state.hitStop, 0.1)
      addText(state, e.x, e.y - e.radius - 12, 'ELITE DOWN', ELITE_COLORS[e.elite], 16)
      spawnBurst(state, e.x, e.y, ELITE_COLORS[e.elite], 18, 220, 4.5, 0.6, true)
      dropChest(
        state,
        e.x,
        e.y,
        CHEST.eliteRewardsMin +
          ((rng() * (CHEST.eliteRewardsMax - CHEST.eliteRewardsMin + 1)) | 0),
      )
      for (let i = 0; i < ELITE.coins; i++) dropCoin(state, e.x, e.y, 1)
      if (e.elite === 'splitting') {
        const { hp, speed } = difficultyMults(state.time)
        for (let i = 0; i < ELITE.splitCount && state.enemies.length < ENEMY_CAP; i++) {
          const a = (i / ELITE.splitCount) * Math.PI * 2
          state.enemies.push(
            createEnemy(
              state, 'bug',
              e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20,
              hp, speed * state.mods.enemySpeedMult,
            ),
          )
        }
      }
    } else {
      if (rng() < COIN_DROP_CHANCE) dropCoin(state, e.x, e.y, 1)
      if (rng() < PICKUPS.dropChance) dropPickup(state, e.x, e.y)
    }
  }
  // compact dead enemies
  const alive: Enemy[] = []
  for (const e of state.enemies) if (!e.dead) alive.push(e)
  state.enemies = alive

  // --- boss death ---
  const boss = state.boss
  if (boss && !boss.dead && boss.hp <= 0) {
    boss.dead = true
    state.boss = null
    state.bossesKilled++
    state.kills++
    bumpCombo(state)
    sfx.bossDie()
    haptics.bossDie()
    state.shake += 26
    state.hitStop = Math.max(state.hitStop, 0.22)
    spawnBurst(state, boss.x, boss.y, '#ffd23e', 60, 340, 6, 1, true)
    spawnBurst(state, boss.x, boss.y, '#ff5db1', 40, 260, 5, 0.8, true)
    for (let i = 0; i < 12; i++) dropGem(state, boss.x, boss.y, 5)
    for (let i = 0; i < 8; i++) dropCoin(state, boss.x, boss.y, 5)
    dropChest(state, boss.x, boss.y, CHEST.bossRewards)
  }

  // --- enemy separation (anti-stacking) ---
  for (const e of state.enemies) {
    for (const o of nearby(grid, e.x, e.y, e.radius + 20, scratch)) {
      if (o === e || o.dead) continue
      const dx = e.x - o.x
      const dy = e.y - o.y
      const d = Math.hypot(dx, dy)
      const want = e.radius + o.radius
      if (d > 0.001 && d < want) {
        const push = ((want - d) / d) * 0.5
        e.x += dx * push * 0.5
        e.y += dy * push * 0.5
      }
    }
  }

  // --- contact damage: enemies vs player ---
  if (p.iframes <= 0) {
    for (const e of nearby(grid, p.x, p.y, 60, scratch)) {
      if (e.dead) continue
      const r = e.radius + 12
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < r * r) {
        hurtPlayer(
          state,
          e.damage,
          e.elite ? `AN ELITE ${KILLER_NAMES[e.kind].replace(/^AN? /, '')}` : KILLER_NAMES[e.kind],
        )
        // vampiric elites heal to full off contact damage
        if (e.elite === 'vampiric' && e.hp < e.maxHp) {
          e.hp = e.maxHp
          addText(state, e.x, e.y - e.radius - 6, 'DRAINED', ELITE_COLORS.vampiric, 12)
          spawnBurst(state, e.x, e.y, ELITE_COLORS.vampiric, 8, 120, 3, 0.4, true)
        }
        break
      }
    }
  }

  // --- enemy bullets vs player ---
  if (p.iframes <= 0) {
    const eb = state.enemyBullets
    for (let i = eb.length - 1; i >= 0; i--) {
      const b = eb[i]
      const r = b.radius + 11
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < r * r) {
        hurtPlayer(state, b.damage, b.source)
        eb[i] = eb[eb.length - 1]
        eb.pop()
        break
      }
    }
  }

  // --- boss contact ---
  if (boss && !boss.dead && !boss.hidden && p.iframes <= 0) {
    const r = boss.radius + 11
    if ((boss.x - p.x) ** 2 + (boss.y - p.y) ** 2 < r * r) {
      hurtPlayer(state, boss.damage, `THE ${boss.name}`)
    }
  }
}

/** register a kill in the streak; announces each new multiplier tier */
function bumpCombo(state: GameState) {
  const before = comboMultiplier(state.combo)
  state.combo++
  state.comboT = COMBO.window
  state.maxCombo = Math.max(state.maxCombo, state.combo)
  const after = comboMultiplier(state.combo)
  if (after > before) {
    const p = state.player
    addText(state, p.x, p.y - 34, `COMBO ×${after}`, '#ffd23e', 18)
    sfx.comboTier(after)
  }
}

function hurtPlayer(state: GameState, damage: number, source: string) {
  const p = state.player
  if (state.dying) return
  p.hp -= damage
  p.iframes = HURT_IFRAMES
  p.hurtFlash = 0.25
  state.shake += 8
  state.hitStop = Math.max(state.hitStop, 0.06)
  state.lastHitBy = source
  if (comboMultiplier(state.combo) > 1) {
    addText(state, p.x, p.y - 38, 'COMBO BROKEN', '#ff3d6e', 14)
    sfx.comboBreak()
  }
  state.combo = 0
  state.comboT = 0
  sfx.hurt()
  haptics.hurt()
  addText(state, p.x, p.y - 20, `-${Math.round(damage)}`, PALETTE.hp, 15)
  spawnBurst(state, p.x, p.y, PALETTE.hp, 8, 140, 3, 0.4, true)
}
