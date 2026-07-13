// Enemy AI. Seven kinds, each with a distinct movement/attack pattern.
// Stats come from ENEMY_DEFS; time-based difficulty multipliers are applied
// at spawn by the spawn system.

import { ELITE, ELITE_COLORS, ENEMY_COLORS, ENEMY_DEFS } from '../config'
import { rng } from '../rng'
import { spawnBurst } from '../systems/particles'
import type { EliteMod, Enemy, EnemyKind, GameState } from '../types'

const ELITE_MODS: EliteMod[] = ['swift', 'regenerating', 'splitting', 'vampiric']

const SNIPER_RANGE = 300
const SNIPER_COOLDOWN = 2.4
const BOOMER_FUSE = 0.55
const BOOMER_TRIGGER = 52
const NINJA_BLINK_EVERY = 2.6

export function createEnemy(
  state: GameState,
  kind: EnemyKind,
  x: number,
  y: number,
  hpMult: number,
  speedMult: number,
): Enemy {
  const def = ENEMY_DEFS[kind]
  return {
    id: state.nextId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp: def.hp * hpMult,
    maxHp: def.hp * hpMult,
    speed: def.speed * speedMult,
    radius: def.radius,
    damage: def.damage,
    xp: def.xp,
    slow: 0,
    burn: 0,
    burnDps: 0,
    hitFlash: 0,
    t: rng() * 10,
    phase: 0,
    angle: 0,
    orbHitT: 0,
    dead: false,
  }
}

/** Promote a freshly-spawned enemy to an elite with one random modifier. */
export function makeElite(state: GameState, e: Enemy): Enemy {
  const mod = ELITE_MODS[(rng() * ELITE_MODS.length) | 0]
  e.elite = mod
  e.radius *= ELITE.radiusMult
  e.hp *= ELITE.hpMult
  e.maxHp *= ELITE.hpMult
  e.damage *= ELITE.damageMult
  e.xp = Math.round(e.xp * ELITE.xpMult)
  if (mod === 'swift') e.speed *= ELITE.swiftSpeedMult
  spawnBurst(state, e.x, e.y, ELITE_COLORS[mod], 12, 160, 3.5, 0.5, true)
  return e
}

export function updateEnemies(state: GameState, dt: number) {
  const p = state.player
  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i]
    if (e.dead) continue

    // status effects
    e.hitFlash = Math.max(0, e.hitFlash - dt)
    if (e.orbHitT > 0) e.orbHitT -= dt
    if (e.elite === 'regenerating' && e.hp > 0 && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + e.maxHp * ELITE.regenFrac * dt)
    }
    if (e.burn > 0) {
      e.burn -= dt
      e.hp -= e.burnDps * dt
      if (Math.random() < dt * 8) {
        spawnBurst(state, e.x, e.y, '#ff8a3d', 1, 30, 2.5, 0.4, true)
      }
      if (e.hp <= 0) {
        // burn kills are resolved by the collision system's sweep
        e.hp = 0
      }
    }
    const slowMult = e.slow > 0 ? 0.6 : 1
    e.slow = Math.max(0, e.slow - dt)

    const dx = p.x - e.x
    const dy = p.y - e.y
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    e.angle = Math.atan2(dy, dx)
    e.t += dt

    switch (e.kind) {
      case 'bug':
      case 'tank': {
        e.vx = nx * e.speed * slowMult
        e.vy = ny * e.speed * slowMult
        break
      }
      case 'sniper': {
        // hold at range and shoot
        const want = dist > SNIPER_RANGE ? 1 : dist < SNIPER_RANGE - 60 ? -1 : 0
        e.vx = nx * e.speed * slowMult * want
        e.vy = ny * e.speed * slowMult * want
        if (e.t > SNIPER_COOLDOWN && dist < SNIPER_RANGE + 120) {
          e.t = 0
          const speed = 300
          state.enemyBullets.push({
            x: e.x,
            y: e.y,
            vx: nx * speed,
            vy: ny * speed,
            damage: e.damage,
            radius: 5,
            life: 2.4,
            source: 'A SNIPER SHOT',
          })
        }
        break
      }
      case 'drone': {
        // erratic: chase with strong perpendicular wobble
        const wob = Math.sin(e.t * 5.5) * 1.1
        e.vx = (nx + -ny * wob) * e.speed * slowMult * 0.75
        e.vy = (ny + nx * wob) * e.speed * slowMult * 0.75
        break
      }
      case 'boomer': {
        if (e.phase === 0) {
          e.vx = nx * e.speed * slowMult
          e.vy = ny * e.speed * slowMult
          if (dist < BOOMER_TRIGGER) {
            e.phase = 1
            e.t = 0
          }
        } else {
          // fuse lit — freeze and flash, detonation handled below
          e.vx *= 0.85
          e.vy *= 0.85
          e.hitFlash = 0.2
          if (e.t > BOOMER_FUSE) {
            e.hp = 0
            e.phase = 2 // signals "self-detonated" to the collision sweep
          }
        }
        break
      }
      case 'ninja': {
        e.vx = nx * e.speed * slowMult
        e.vy = ny * e.speed * slowMult
        if (e.t > NINJA_BLINK_EVERY && dist > 130) {
          e.t = 0
          spawnBurst(state, e.x, e.y, ENEMY_COLORS.ninja, 8, 90, 3, 0.4, true)
          const ang = rng() * Math.PI * 2
          const r = 90 + rng() * 60
          e.x = p.x + Math.cos(ang) * r
          e.y = p.y + Math.sin(ang) * r
          spawnBurst(state, e.x, e.y, ENEMY_COLORS.ninja, 8, 90, 3, 0.4, true)
        }
        break
      }
      case 'shield': {
        // must be flanked — collision system blocks frontal damage
        e.vx = nx * e.speed * slowMult
        e.vy = ny * e.speed * slowMult
        break
      }
    }

    e.x += e.vx * dt
    e.y += e.vy * dt
  }
}
