// Spawn director: continuous pressure that ramps with elapsed time, plus the
// 3-minute boss schedule. Enemies always spawn just outside the viewport.

import { DIFFICULTY, ELITE, ENEMY_DEFS } from '../config'
import { sfx } from '../audio'
import { haptics } from '../haptics'
import { rng } from '../rng'
import { createBoss } from '../entities/boss'
import { createEnemy, makeElite } from '../entities/enemy'
import type { EnemyKind, GameState, RunMods } from '../types'

const KINDS = Object.keys(ENEMY_DEFS) as EnemyKind[]
export const ENEMY_CAP = 260

function spawnInterval(time: number, mods: RunMods): number {
  const t = Math.min(1, time / DIFFICULTY.rampTime)
  // ease-out so early game ramps quickly enough to stay exciting
  const eased = 1 - Math.pow(1 - t, 1.6)
  const floor = DIFFICULTY.spawnFloor * mods.spawnFloorMult
  // rate mult divides the whole interval (including the floor) — otherwise
  // the Math.max clamp would cancel it once the ramp completes
  const base = DIFFICULTY.spawnStart + (floor - DIFFICULTY.spawnStart) * eased
  return Math.max(floor, base) / mods.spawnRateMult
}

export function difficultyMults(time: number): { hp: number; speed: number } {
  const min = time / 60
  return {
    hp: 1 + min * DIFFICULTY.hpPerMin,
    speed: Math.min(DIFFICULTY.speedCap, 1 + min * DIFFICULTY.speedPerMin),
  }
}

function pickKind(time: number, mods: RunMods): EnemyKind {
  let total = 0
  for (const k of KINDS) {
    if (time >= ENEMY_DEFS[k].unlockAt) total += ENEMY_DEFS[k].weight * (mods.weightMult[k] ?? 1)
  }
  let roll = rng() * total
  for (const k of KINDS) {
    if (time < ENEMY_DEFS[k].unlockAt) continue
    roll -= ENEMY_DEFS[k].weight * (mods.weightMult[k] ?? 1)
    if (roll <= 0) return k
  }
  return 'bug'
}

function spawnOffscreen(state: GameState, kind: EnemyKind, viewW: number, viewH: number) {
  if (state.enemies.length >= ENEMY_CAP) return
  const { hp, speed } = difficultyMults(state.time)
  const p = state.player
  const margin = 40
  const halfW = viewW / 2 + margin
  const halfH = viewH / 2 + margin
  let x: number
  let y: number
  if (rng() < 0.5) {
    x = p.x + (rng() < 0.5 ? -halfW : halfW)
    y = p.y + (rng() * 2 - 1) * halfH
  } else {
    x = p.x + (rng() * 2 - 1) * halfW
    y = p.y + (rng() < 0.5 ? -halfH : halfH)
  }
  const e = createEnemy(state, kind, x, y, hp, speed * state.mods.enemySpeedMult)
  // rare elite promotion once the run has warmed up
  const eliteChance = state.mods.eliteChance ?? ELITE.chance
  if (state.time >= ELITE.unlockAt && rng() < eliteChance) makeElite(state, e)
  state.enemies.push(e)
}

export function updateSpawner(state: GameState, dt: number, viewW: number, viewH: number) {
  state.spawnT -= dt
  if (state.spawnT <= 0) {
    state.spawnT = spawnInterval(state.time, state.mods)
    spawnOffscreen(state, pickKind(state.time, state.mods), viewW, viewH)
    // occasional pack spawn, more likely later
    const packChance = (state.time / 60) * DIFFICULTY.packChancePerMin
    if (rng() < packChance) {
      const kind = pickKind(state.time, state.mods)
      for (let i = 0; i < 6; i++) spawnOffscreen(state, kind, viewW, viewH)
    }
  }

  // boss schedule: warn 3s ahead of each interval mark
  const nextBossAt = (state.bossCycle + 1) * DIFFICULTY.bossInterval
  if (!state.boss && state.bossWarnT <= 0 && state.time >= nextBossAt - 3) {
    state.bossWarnT = 3
    sfx.bossWarn()
    haptics.bossWarn()
  }
  if (state.bossWarnT > 0) {
    state.bossWarnT -= dt
    if (state.bossWarnT <= 0 && !state.boss) {
      state.boss = createBoss(state, state.bossCycle)
      state.bossCycle++
    }
  }
}
