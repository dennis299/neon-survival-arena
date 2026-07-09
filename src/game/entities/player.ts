import { basePlayerStats } from '../config'
import type { CharacterDef, Player } from '../types'
import type { InputState } from '../input'
import type { GameState } from '../types'

export function createPlayer(character: CharacterDef): Player {
  const stats = basePlayerStats()
  character.mod(stats)
  return {
    ...stats,
    x: 0,
    y: 0,
    hp: stats.maxHp,
    aim: 0,
    fireT: 0,
    regenT: 0,
    hurtFlash: 0,
    iframes: 0,
    novaT: 0,
    triggerNova: false,
  }
}

export function updatePlayer(state: GameState, input: InputState, dt: number) {
  const p = state.player
  p.x += input.moveX * p.speed * dt
  p.y += input.moveY * p.speed * dt

  if (input.aiming) {
    p.aim = input.aim
  } else if (input.moveX !== 0 || input.moveY !== 0) {
    // mobile with no right stick: aim where you walk
    p.aim = Math.atan2(input.moveY, input.moveX)
  }

  if (p.regen > 0 && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + p.regen * dt)
  }
  p.hurtFlash = Math.max(0, p.hurtFlash - dt)
  p.iframes = Math.max(0, p.iframes - dt)

  if (p.novaLevel > 0) {
    p.novaT -= dt
    if (p.novaT <= 0) {
      p.novaT = Math.max(1.5, 4.5 - p.novaLevel * 0.5)
      p.triggerNova = true
    }
  }
}
