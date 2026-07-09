// Level-up choices: 3 random upgrades weighted so foundational picks dominate
// early levels and exotic combos appear later. 'Bigger Explosions' only offers
// itself once Explosive Rounds is owned. Once both prerequisite lines of a
// weapon evolution are maxed, the evolution hijacks a choice slot — a
// guaranteed offer until it's taken.

import { EVOLUTIONS, UPGRADES } from '../config'
import type { EvolutionDef, GameState, UpgradeChoice, UpgradeDef } from '../types'

function isAvailable(state: GameState, def: UpgradeDef): boolean {
  const taken = state.upgradesTaken[def.id] ?? 0
  if (taken >= def.maxLevel) return false
  if (state.level < def.minPlayerLevel) return false
  if (def.id === 'bigboom' && !(state.upgradesTaken['explosive'] > 0)) return false
  return true
}

function weightFor(state: GameState, def: UpgradeDef): number {
  const taken = state.upgradesTaken[def.id] ?? 0
  // already-invested lines are a bit more likely — encourages builds
  let w = 10 + taken * 4
  // exotic picks get a late-game boost
  if (def.minPlayerLevel >= 4 && state.level >= def.minPlayerLevel + 2) w += 6
  return w
}

/** first unowned evolution whose two prerequisite lines are both maxed */
export function pendingEvolution(state: GameState): EvolutionDef | null {
  for (const evo of EVOLUTIONS) {
    if (state.evolutions.includes(evo.id)) continue
    const ready = evo.requires.every((id) => {
      const def = UPGRADES.find((u) => u.id === id)
      return def !== undefined && (state.upgradesTaken[id] ?? 0) >= def.maxLevel
    })
    if (ready) return evo
  }
  return null
}

export function rollChoices(state: GameState): UpgradeChoice[] {
  const pool = UPGRADES.filter((u) => isAvailable(state, u))
  const choices: UpgradeChoice[] = []
  const used = new Set<string>()
  for (let pick = 0; pick < 3 && used.size < pool.length; pick++) {
    const candidates = pool.filter((u) => !used.has(u.id))
    let total = 0
    for (const u of candidates) total += weightFor(state, u)
    let roll = Math.random() * total
    let chosen = candidates[candidates.length - 1]
    for (const u of candidates) {
      roll -= weightFor(state, u)
      if (roll <= 0) {
        chosen = u
        break
      }
    }
    used.add(chosen.id)
    choices.push({ def: chosen, nextLevel: (state.upgradesTaken[chosen.id] ?? 0) + 1 })
  }
  // an earned evolution replaces a slot — the chase hook must never miss
  const evo = pendingEvolution(state)
  if (evo) {
    const evoChoice: UpgradeChoice = { def: evo, nextLevel: 1, isEvolution: true }
    if (choices.length > 0) choices[0] = evoChoice
    else choices.push(evoChoice)
  }
  return choices
}

export function applyUpgrade(state: GameState, def: UpgradeDef | EvolutionDef) {
  if ('requires' in def) {
    if (state.evolutions.includes(def.id)) return
    state.evolutions.push(def.id)
    def.apply(state.player)
    return
  }
  const level = (state.upgradesTaken[def.id] ?? 0) + 1
  state.upgradesTaken[def.id] = level
  const hpBefore = state.player.maxHp
  def.apply(state.player, level)
  // max-hp upgrades also heal by the amount gained
  if (state.player.maxHp > hpBefore) {
    state.player.hp += state.player.maxHp - hpBefore
  }
  state.player.hp = Math.min(state.player.hp, state.player.maxHp)
}

/** Roll chest rewards without applying them — the loop applies on CLAIM so
 * the sim state stays consistent with what the overlay showed. null = coins.
 * Owned lines can keep leveling regardless of minPlayerLevel; new lines
 * respect it. */
export function rollChestRewards(
  state: GameState,
  count: number,
): { def: UpgradeDef | null; level: number }[] {
  const taken: Record<string, number> = { ...state.upgradesTaken }
  const out: { def: UpgradeDef | null; level: number }[] = []
  for (let i = 0; i < count; i++) {
    const pool = UPGRADES.filter((u) => {
      const t = taken[u.id] ?? 0
      if (t >= u.maxLevel) return false
      if (t === 0 && state.level < u.minPlayerLevel) return false
      if (u.id === 'bigboom' && !((taken['explosive'] ?? 0) > 0)) return false
      return true
    })
    if (pool.length === 0) {
      out.push({ def: null, level: 0 })
      continue
    }
    const u = pool[(Math.random() * pool.length) | 0]
    taken[u.id] = (taken[u.id] ?? 0) + 1
    out.push({ def: u, level: taken[u.id] })
  }
  return out
}
