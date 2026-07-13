// Achievement evaluation, split in two passes over one shared threshold table:
// the run-end pass (App banks it into the save) covers everything, including
// ids that need full RunStats (bosses/dashes/chests/daily — not present on a
// HUD snapshot); the live pass runs on each HUD snapshot so time/level/combo/
// evolution/kill/coin milestones toast mid-run. Live-earned ids are written to
// the save immediately, which also stops the run-end pass from re-awarding
// ('perm-max' is the exception — App awards it at purchase time).

import type { HudSnapshot, RunStats } from './types'
import type { SaveData } from './storage'

/** the subset of fields both a live HUD snapshot and a finished run's stats
 * carry — what a "live-checkable" milestone is allowed to read */
interface MilestoneSnapshot {
  kills: number
  time: number
  level: number
  maxCombo: number
  evolutions: number
}

/** a milestone checkable from a HUD snapshot alone, i.e. safe to toast live */
interface LiveThreshold {
  id: string
  value: (s: MilestoneSnapshot) => number
  threshold: number
}

const LIVE_THRESHOLDS: LiveThreshold[] = [
  { id: 'first-blood', value: (h) => h.kills, threshold: 1 },
  { id: 'survive-5', value: (h) => h.time, threshold: 300 },
  { id: 'survive-10', value: (h) => h.time, threshold: 600 },
  { id: 'survive-18', value: (h) => h.time, threshold: 1080 },
  { id: 'survive-25', value: (h) => h.time, threshold: 1500 },
  { id: 'level-20', value: (h) => h.level, threshold: 20 },
  { id: 'level-30', value: (h) => h.level, threshold: 30 },
  { id: 'combo-25', value: (h) => h.maxCombo, threshold: 25 },
  { id: 'combo-50', value: (h) => h.maxCombo, threshold: 50 },
  { id: 'evolution-1', value: (h) => h.evolutions, threshold: 1 },
  { id: 'evolution-4', value: (h) => h.evolutions, threshold: 4 },
]

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
  for (const t of LIVE_THRESHOLDS) award(t.id, t.value(stats) >= t.threshold)
  award('kills-1000', save.totalKills + stats.kills >= 1000)
  award('kills-10000', save.totalKills + stats.kills >= 10000)
  award('rich', save.coins + stats.coins >= 1000)
  award('rich-5000', save.coins + stats.coins >= 5000)
  award('boss-1', stats.bossesKilled >= 1)
  award('boss-3', stats.bossesKilled >= 3)
  award('boss-10', save.totalBosses + stats.bossesKilled >= 10)
  award('elite-10', save.totalElites + stats.eliteKills >= 10)
  award('dash-100', save.totalDashes + stats.dashes >= 100)
  award('nuke-1', stats.nukesUsed >= 1)
  award('chest-10', save.totalChests + stats.chestsOpened >= 10)
  award('daily-1', daily)
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
  for (const t of LIVE_THRESHOLDS) award(t.id, t.value(hud) >= t.threshold)
  award('kills-1000', lifetimeKills + hud.kills >= 1000)
  award('kills-10000', lifetimeKills + hud.kills >= 10000)
  award('rich', bankedCoins + hud.coins >= 1000)
  award('rich-5000', bankedCoins + hud.coins >= 5000)
  return fresh
}
