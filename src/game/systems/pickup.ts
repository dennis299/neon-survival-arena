// Ground pickups: rare micro-decisions dropped by normal kills (health /
// magnet / nuke / overdrive) plus treasure chests from elites and bosses.
// Touching a chest sets chestPendingRewards; the loop pauses the sim and
// hands the rolled rewards to React (mirrors the level-up flow).

import { PICKUPS, PICKUP_DEFS } from '../config'
import { sfx } from '../audio'
import { rng } from '../rng'
import { addText, spawnBurst } from './particles'
import type { GameState, PickupKind } from '../types'

const ROLLABLE: Exclude<PickupKind, 'chest'>[] = ['health', 'magnet', 'nuke', 'overdrive']

export function dropPickup(state: GameState, x: number, y: number) {
  let onField = 0
  for (const pk of state.pickups) if (pk.kind !== 'chest') onField++
  if (onField >= PICKUPS.fieldCap) return
  const kind = ROLLABLE[(rng() * ROLLABLE.length) | 0]
  state.pickups.push({ x, y, kind, t: rng() * 10, life: PICKUPS.life, rewards: 0 })
}

export function dropChest(state: GameState, x: number, y: number, rewards: number) {
  state.pickups.push({ x, y, kind: 'chest', t: 0, life: Infinity, rewards })
}

export function updatePickups(state: GameState, dt: number, viewW: number, viewH: number) {
  const p = state.player
  const arr = state.pickups
  for (let i = arr.length - 1; i >= 0; i--) {
    const pk = arr[i]
    pk.t += dt
    pk.life -= dt
    if (pk.life <= 0) {
      arr[i] = arr[arr.length - 1]
      arr.pop()
      continue
    }
    if ((pk.x - p.x) ** 2 + (pk.y - p.y) ** 2 > PICKUPS.radius * PICKUPS.radius) continue
    // a dying player can still drift — don't consume pickups (especially
    // chests, whose reward flow is gated off during the death cinematic)
    if (state.dying) continue

    switch (pk.kind) {
      case 'health': {
        const heal = p.maxHp * PICKUPS.healFrac
        p.hp = Math.min(p.maxHp, p.hp + heal)
        addText(state, p.x, p.y - 24, `+${Math.round(heal)} HP`, PICKUP_DEFS.health.color, 15)
        spawnBurst(state, p.x, p.y, PICKUP_DEFS.health.color, 14, 140, 3, 0.5, true)
        sfx.pickupHealth()
        break
      }
      case 'magnet': {
        // slam every gem/coin toward the player — homing keeps them coming
        for (const g of state.gems) {
          const d = Math.hypot(p.x - g.x, p.y - g.y) || 1
          g.vx = ((p.x - g.x) / d) * PICKUPS.magnetSpeed
          g.vy = ((p.y - g.y) / d) * PICKUPS.magnetSpeed
        }
        addText(state, p.x, p.y - 24, 'MAGNET!', PICKUP_DEFS.magnet.color, 15)
        spawnBurst(state, p.x, p.y, PICKUP_DEFS.magnet.color, 16, 220, 3, 0.5, true)
        sfx.pickupMagnet()
        break
      }
      case 'nuke': {
        const halfW = viewW / 2 + 40
        const halfH = viewH / 2 + 40
        for (const e of state.enemies) {
          if (e.dead) continue
          if (Math.abs(e.x - p.x) > halfW || Math.abs(e.y - p.y) > halfH) continue
          e.hp -= PICKUPS.nukeDamage
          e.hitFlash = 0.15
          state.damageDealt += PICKUPS.nukeDamage
        }
        state.flashT = 0.35
        state.shake += 24
        state.nukesUsed++
        addText(state, p.x, p.y - 24, 'NUKE!', PICKUP_DEFS.nuke.color, 18)
        sfx.pickupNuke()
        break
      }
      case 'overdrive': {
        p.overdriveT = PICKUPS.overdriveTime
        addText(state, p.x, p.y - 24, 'OVERDRIVE!', PICKUP_DEFS.overdrive.color, 15)
        spawnBurst(state, p.x, p.y, PICKUP_DEFS.overdrive.color, 14, 180, 3, 0.5, true)
        sfx.pickupOverdrive()
        break
      }
      case 'chest': {
        // resolved by the loop: pauses the sim and rolls the rewards
        // (+= so two chests touched the same frame both count)
        state.chestPendingRewards += pk.rewards
        state.chestsOpened++
        spawnBurst(state, pk.x, pk.y, '#ffd23e', 20, 200, 3.5, 0.6, true)
        break
      }
    }
    arr[i] = arr[arr.length - 1]
    arr.pop()
  }
}
