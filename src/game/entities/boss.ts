// Boss AI. One boss every 3 minutes, cycling Robot → Worm → Queen with an HP
// multiplier each full cycle. Deaths are resolved in the collision system.

import { BOSS_CYCLE_HP_MULT, BOSS_DEFS } from '../config'
import { rng } from '../rng'
import { spawnBurst } from '../systems/particles'
import { createEnemy } from './enemy'
import type { Boss, BossKind, GameState } from '../types'

const KINDS: BossKind[] = ['robot', 'worm', 'queen']

export function bossKindForCycle(cycle: number): BossKind {
  return KINDS[cycle % KINDS.length]
}

export function createBoss(state: GameState, cycle: number): Boss {
  const kind = bossKindForCycle(cycle)
  const def = BOSS_DEFS[kind]
  const hpMult = Math.pow(BOSS_CYCLE_HP_MULT, Math.floor(cycle / KINDS.length))
  const p = state.player
  const ang = rng() * Math.PI * 2
  return {
    kind,
    name: def.name,
    x: p.x + Math.cos(ang) * 480,
    y: p.y + Math.sin(ang) * 480,
    vx: 0,
    vy: 0,
    hp: def.hp * hpMult,
    maxHp: def.hp * hpMult,
    radius: def.radius,
    damage: def.damage,
    speed: def.speed,
    t: 0,
    attackT: 0,
    phase: 0,
    angle: 0,
    hidden: false,
    hitFlash: 0,
    dead: false,
  }
}

function radialBurst(
  state: GameState,
  x: number,
  y: number,
  count: number,
  speed: number,
  damage: number,
  source: string,
) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2
    state.enemyBullets.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      damage,
      radius: 6,
      life: 3,
      source,
    })
  }
}

export function updateBoss(state: GameState, dt: number) {
  const b = state.boss
  if (!b || b.dead) return
  const p = state.player
  const dx = p.x - b.x
  const dy = p.y - b.y
  const dist = Math.hypot(dx, dy) || 1
  const nx = dx / dist
  const ny = dy / dist
  b.angle = Math.atan2(dy, dx)
  b.t += dt
  b.attackT += dt
  b.hitFlash = Math.max(0, b.hitFlash - dt)

  switch (b.kind) {
    case 'robot': {
      // relentless chase; rockets every 4s; radial ground-slam when close
      b.vx = nx * b.speed
      b.vy = ny * b.speed
      if (b.attackT > 4) {
        b.attackT = 0
        for (let i = -1; i <= 1; i++) {
          const a = b.angle + i * 0.25
          state.enemyBullets.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(a) * 260,
            vy: Math.sin(a) * 260,
            damage: b.damage,
            radius: 8,
            life: 3.2,
            source: "THE GIANT ROBOT'S ROCKETS",
          })
        }
      }
      if (dist < 150 && b.t > 6) {
        b.t = 0
        radialBurst(state, b.x, b.y, 16, 220, b.damage * 0.7, "THE GIANT ROBOT'S SLAM")
        state.shake += 18
        spawnBurst(state, b.x, b.y, '#ff9a3d', 30, 260, 5, 0.7, true)
      }
      break
    }
    case 'worm': {
      // burrow → speed under the player → erupt in a radial burst → surface chase
      if (b.phase === 0) {
        // surfaced chase
        b.hidden = false
        b.vx = nx * b.speed * 0.45
        b.vy = ny * b.speed * 0.45
        if (b.t > 2.6) {
          b.t = 0
          b.phase = 1
          b.hidden = true
          spawnBurst(state, b.x, b.y, '#b464ff', 20, 160, 4, 0.6, true)
        }
      } else {
        // burrowed — untargetable, homing fast
        b.vx = nx * b.speed
        b.vy = ny * b.speed
        if (Math.random() < dt * 20) {
          spawnBurst(state, b.x, b.y, '#5a4a8a', 2, 60, 3, 0.5, false)
        }
        if (b.t > 1.7 || dist < 24) {
          b.t = 0
          b.phase = 0
          b.hidden = false
          radialBurst(state, b.x, b.y, 12, 240, b.damage * 0.8, "THE CYBER WORM'S ERUPTION")
          state.shake += 14
          spawnBurst(state, b.x, b.y, '#b464ff', 34, 300, 5, 0.8, true)
        }
      }
      break
    }
    case 'queen': {
      // slow stalk; spawns minion swarms; radial projectile bursts
      b.vx = nx * b.speed
      b.vy = ny * b.speed
      if (b.attackT > 3.4) {
        b.attackT = 0
        radialBurst(state, b.x, b.y, 14, 190, b.damage * 0.75, "THE ALIEN QUEEN'S BURST")
      }
      if (b.t > 5.5) {
        b.t = 0
        const mult = 1 + state.time / 60 * 0.2
        for (let i = 0; i < 5; i++) {
          const a = rng() * Math.PI * 2
          state.enemies.push(
            createEnemy(
              state, 'bug',
              b.x + Math.cos(a) * 50, b.y + Math.sin(a) * 50,
              mult, 1.1 * state.mods.enemySpeedMult,
            ),
          )
        }
        spawnBurst(state, b.x, b.y, '#ff5db1', 16, 140, 4, 0.6, true)
      }
      break
    }
  }

  b.x += b.vx * dt
  b.y += b.vy * dt
}
