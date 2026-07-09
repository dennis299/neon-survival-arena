// Player weapons: main auto-fire cannon + orbiting drone companions.

import { PICKUPS } from '../config'
import { sfx } from '../audio'
import { rng } from '../rng'
import type { Bullet, GameState } from '../types'

const BULLET_LIFE = 1.4
const DRONE_ORBIT = 52
const DRONE_FIRE_RATE = 1.1
const DRONE_RANGE = 340

function makeBullet(
  state: GameState,
  x: number,
  y: number,
  angle: number,
  speedMult: number,
  fromDrone: boolean,
): Bullet {
  const p = state.player
  return {
    x,
    y,
    vx: Math.cos(angle) * p.bulletSpeed * speedMult,
    vy: Math.sin(angle) * p.bulletSpeed * speedMult,
    damage: fromDrone ? p.damage * 0.6 : p.damage,
    radius: 4,
    life: BULLET_LIFE,
    pierce: p.pierce,
    ricochet: p.ricochet,
    chain: p.chain,
    explosive: p.explosive * p.explosiveMult,
    fire: p.fireLevel > 0,
    ice: p.iceLevel > 0,
    fromDrone,
    bounces: 0,
    hitIds: new Set(),
  }
}

/** Orbital Array: each nova also launches a ring of bullets from the player. */
export function fireRadialRing(state: GameState, count = 16) {
  const p = state.player
  for (let i = 0; i < count; i++) {
    state.bullets.push(makeBullet(state, p.x, p.y, (i / count) * Math.PI * 2, 1, false))
  }
}

export function firePlayerWeapon(state: GameState, dt: number) {
  const p = state.player
  const rate = p.fireRate * (p.overdriveT > 0 ? PICKUPS.overdriveMult : 1)
  p.fireT -= dt
  while (p.fireT <= 0) {
    p.fireT += 1 / rate
    const n = p.bulletCount
    const spread = (p.spreadDeg * Math.PI) / 180
    for (let i = 0; i < n; i++) {
      const offset = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread * (n - 1) * 0.6
      state.bullets.push(makeBullet(state, p.x, p.y, p.aim + offset, 1, false))
    }
    sfx.shoot()
  }
}

export function updateDrones(state: GameState, dt: number) {
  const p = state.player
  // keep drone unit count in sync with the stat
  while (state.droneUnits.length < p.drones) {
    state.droneUnits.push({ angle: rng() * Math.PI * 2, fireT: 0 })
  }
  for (let i = 0; i < state.droneUnits.length; i++) {
    const d = state.droneUnits[i]
    d.angle += dt * 2.2
    const dx = p.x + Math.cos(d.angle) * DRONE_ORBIT
    const dy = p.y + Math.sin(d.angle) * DRONE_ORBIT
    d.fireT -= dt
    if (d.fireT <= 0) {
      // fire at nearest enemy in range
      let best = -1
      let bestD = DRONE_RANGE * DRONE_RANGE
      for (let j = 0; j < state.enemies.length; j++) {
        const e = state.enemies[j]
        if (e.dead) continue
        const dd = (e.x - dx) * (e.x - dx) + (e.y - dy) * (e.y - dy)
        if (dd < bestD) {
          bestD = dd
          best = j
        }
      }
      const target =
        best >= 0
          ? state.enemies[best]
          : state.boss && !state.boss.hidden && !state.boss.dead
            ? state.boss
            : null
      if (target) {
        const ang = Math.atan2(target.y - dy, target.x - dx)
        state.bullets.push(makeBullet(state, dx, dy, ang, 0.9, true))
        // Orbital Array evolution doubles drone fire rate
        d.fireT = 1 / (DRONE_FIRE_RATE * (p.orbitalArray ? 2 : 1))
      }
    }
  }
}

export function updateBullets(state: GameState, dt: number) {
  const bullets = state.bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    if (b.life <= 0) {
      bullets[i] = bullets[bullets.length - 1]
      bullets.pop()
    }
  }
  const eb = state.enemyBullets
  for (let i = eb.length - 1; i >= 0; i--) {
    const b = eb[i]
    b.x += b.vx * dt
    b.y += b.vy * dt
    b.life -= dt
    if (b.life <= 0) {
      eb[i] = eb[eb.length - 1]
      eb.pop()
    }
  }
}
