import { DASH, STATIC_FIELD, basePlayerStats } from '../config'
import { sfx } from '../audio'
import { haptics } from '../haptics'
import { spawnBurst } from '../systems/particles'
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
    dashT: 0,
    dashCd: 0,
    dashDirX: 0,
    dashDirY: 0,
    overdriveT: 0,
    staticT: 0,
    triggerStatic: false,
  }
}

export function updatePlayer(state: GameState, input: InputState, dashRequested: boolean, dt: number) {
  const p = state.player

  p.dashCd = Math.max(0, p.dashCd - dt)
  if (dashRequested && p.dashCd <= 0 && !state.dying) {
    // dash along current movement, or where you're aiming when standing still
    const moving = input.moveX !== 0 || input.moveY !== 0
    p.dashDirX = moving ? input.moveX : Math.cos(p.aim)
    p.dashDirY = moving ? input.moveY : Math.sin(p.aim)
    p.dashT = DASH.duration
    p.dashCd = DASH.cooldown
    p.iframes = Math.max(p.iframes, DASH.iframes)
    sfx.dash()
    haptics.dash()
    spawnBurst(state, p.x, p.y, '#4dd8ff', 10, 180, 3, 0.3, true)
  }

  if (p.dashT > 0) {
    p.dashT -= dt
    p.x += p.dashDirX * p.speed * DASH.speedMult * dt
    p.y += p.dashDirY * p.speed * DASH.speedMult * dt
    // afterimage trail
    spawnBurst(state, p.x, p.y, '#8ef6ff', 2, 20, 3.5, 0.28, true)
  } else {
    p.x += input.moveX * p.speed * dt
    p.y += input.moveY * p.speed * dt
  }

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

  p.overdriveT = Math.max(0, p.overdriveT - dt)

  // Static Field evolution: periodic arc storm, resolved by the collision pass
  if (p.staticField) {
    p.staticT -= dt
    if (p.staticT <= 0) {
      p.staticT = STATIC_FIELD.interval
      p.triggerStatic = true
    }
  }
}
