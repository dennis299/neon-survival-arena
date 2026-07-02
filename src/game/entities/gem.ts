// XP gems and coins both home straight to the player from the moment they
// drop — no manual collection, just dodge enemies and let the rewards come
// to you. Coins home at a fixed strength; gems scale with the player's
// magnet stat, so the Gem Magnet upgrade still matters — it no longer just
// extends pickup range, it makes gems fly in dramatically faster. Leveling
// itself is resolved by the loop (it pauses the sim for the picker).

import { sfx } from '../audio'
import { spawnBurst } from '../systems/particles'
import { PALETTE } from '../config'
import type { GameState } from '../types'

const PICKUP_DIST = 18
const GEM_CAP = 400
const COIN_HOMING_ACCEL = 900
const COIN_MIN_SPEED = 260
// gem pull scales with the player's magnet stat (base 70 -> ~630 accel / ~180 min speed)
const GEM_ACCEL_PER_MAGNET = 9
const GEM_MIN_SPEED_PER_MAGNET = 2.6

export function dropGem(state: GameState, x: number, y: number, value: number) {
  // merge into fewer, bigger gems if the field is saturated (perf guard)
  if (state.gems.length > GEM_CAP) {
    const g = state.gems[(Math.random() * state.gems.length) | 0]
    if (!g.isCoin) {
      g.value += value
      return
    }
  }
  state.gems.push({
    x: x + (Math.random() - 0.5) * 14,
    y: y + (Math.random() - 0.5) * 14,
    vx: (Math.random() - 0.5) * 60,
    vy: (Math.random() - 0.5) * 60,
    value,
    radius: 5 + Math.min(3, value * 0.3),
    isCoin: false,
    t: Math.random() * 10,
  })
}

export function dropCoin(state: GameState, x: number, y: number, value: number) {
  state.gems.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 80,
    vy: (Math.random() - 0.5) * 80,
    value,
    radius: 6,
    isCoin: true,
    t: Math.random() * 10,
  })
}

export function updateGems(state: GameState, dt: number) {
  const p = state.player
  const gems = state.gems
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i]
    g.t += dt
    const dx = p.x - g.x
    const dy = p.y - g.y
    const dist = Math.hypot(dx, dy) || 1
    const nx = dx / dist
    const ny = dy / dist

    // both gems and coins always home to the player, regardless of distance
    const accel = g.isCoin ? COIN_HOMING_ACCEL : p.magnet * GEM_ACCEL_PER_MAGNET
    const minSpeed = g.isCoin ? COIN_MIN_SPEED : p.magnet * GEM_MIN_SPEED_PER_MAGNET
    g.vx += nx * accel * dt
    g.vy += ny * accel * dt
    const speed = Math.hypot(g.vx, g.vy)
    if (speed < minSpeed) {
      g.vx = nx * minSpeed
      g.vy = ny * minSpeed
    }
    g.x += g.vx * dt
    g.y += g.vy * dt

    if (dist < PICKUP_DIST) {
      if (g.isCoin) {
        state.coins += g.value
        sfx.coin()
        spawnBurst(state, g.x, g.y, PALETTE.coin, 5, 90, 2.5, 0.35, true)
      } else {
        state.xp += g.value
        sfx.gem()
        spawnBurst(state, g.x, g.y, PALETTE.xp, 4, 80, 2.5, 0.3, true)
      }
      gems[i] = gems[gems.length - 1]
      gems.pop()
    }
  }
}
