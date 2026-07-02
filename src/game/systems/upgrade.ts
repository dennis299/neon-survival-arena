// Level-up choices: 3 random upgrades weighted so foundational picks dominate
// early levels and exotic combos appear later. 'Bigger Explosions' only offers
// itself once Explosive Rounds is owned.

import { UPGRADES } from '../config'
import type { GameState, UpgradeChoice, UpgradeDef } from '../types'

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
  return choices
}

export function applyUpgrade(state: GameState, def: UpgradeDef) {
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
