// Achievement evaluation, split in two passes: the run-end pass (App banks it
// into the save) covers everything; the live pass runs on each HUD snapshot so
// time/level/combo milestones toast mid-run. Live-earned ids are written to
// the save immediately, which also stops the run-end pass from re-awarding
// ('perm-max' is the exception — App awards it at purchase time).

import type { HudSnapshot, RunStats } from './types'
import type { SaveData } from './storage'

export function evaluateRunAchievements(
  save: SaveData,
  stats: RunStats,
  daily: boolean,
): string[] {
  const earned: string[] = []
  const has = (id: string) => save.achievements.includes(id) || earned.includes(id)
  const award = (id: string, cond: boolean) => {
    if (cond && !has(id)) earned.push(id)
  }
  award('first-blood', stats.kills > 0)
  award('survive-5', stats.time >= 300)
  award('survive-10', stats.time >= 600)
  award('survive-18', stats.time >= 1080)
  award('survive-25', stats.time >= 1500)
  award('boss-1', stats.bossesKilled >= 1)
  award('boss-3', stats.bossesKilled >= 3)
  award('boss-10', save.totalBosses + stats.bossesKilled >= 10)
  award('level-20', stats.level >= 20)
  award('level-30', stats.level >= 30)
  award('kills-1000', save.totalKills + stats.kills >= 1000)
  award('kills-10000', save.totalKills + stats.kills >= 10000)
  award('combo-25', stats.maxCombo >= 25)
  award('combo-50', stats.maxCombo >= 50)
  award('evolution-1', stats.evolutions >= 1)
  award('evolution-4', stats.evolutions >= 4)
  award('elite-10', save.totalElites + stats.eliteKills >= 10)
  award('dash-100', save.totalDashes + stats.dashes >= 100)
  award('nuke-1', stats.nukesUsed >= 1)
  award('chest-10', save.totalChests + stats.chestsOpened >= 10)
  award('daily-1', daily)
  award('rich', save.coins + stats.coins >= 1000)
  award('rich-5000', save.coins + stats.coins >= 5000)
  return earned
}

/** Milestones checkable from a HUD snapshot alone — evaluated at ~10Hz during
 * the run so they toast the moment they happen. `lifetimeKills`/`bankedCoins`
 * are the save's totals captured at run start. */
export function evaluateLiveAchievements(
  hud: HudSnapshot,
  earned: ReadonlySet<string>,
  lifetimeKills: number,
  bankedCoins: number,
): string[] {
  const fresh: string[] = []
  const award = (id: string, cond: boolean) => {
    if (cond && !earned.has(id)) fresh.push(id)
  }
  award('first-blood', hud.kills > 0)
  award('survive-5', hud.time >= 300)
  award('survive-10', hud.time >= 600)
  award('survive-18', hud.time >= 1080)
  award('survive-25', hud.time >= 1500)
  award('level-20', hud.level >= 20)
  award('level-30', hud.level >= 30)
  award('combo-25', hud.maxCombo >= 25)
  award('combo-50', hud.maxCombo >= 50)
  award('evolution-1', hud.evolutions >= 1)
  award('evolution-4', hud.evolutions >= 4)
  award('kills-1000', lifetimeKills + hud.kills >= 1000)
  award('kills-10000', lifetimeKills + hud.kills >= 10000)
  award('rich', bankedCoins + hud.coins >= 1000)
  award('rich-5000', bankedCoins + hud.coins >= 5000)
  return fresh
}
