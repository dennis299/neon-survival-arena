// Global leaderboard — a public Supabase table, no accounts. Every finished
// run submits a row automatically; the menu's GLOBAL tab shows the top times
// from everyone who's played. Falls back to silently doing nothing (local
// leaderboard still works) if env vars are missing or the network is down.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabase = url && key ? createClient(url, key) : null

export interface GlobalScore {
  name: string
  time_seconds: number
  kills: number
  level: number
  bosses: number
  character_id: string
  created_at: string
}

export function isGlobalLeaderboardEnabled(): boolean {
  return supabase !== null
}

export async function submitScore(entry: {
  name: string
  timeSeconds: number
  kills: number
  level: number
  bosses: number
  characterId: string
}): Promise<boolean> {
  if (!supabase) return false
  const name = entry.name.trim().slice(0, 16) || 'Anonymous'
  try {
    const { error } = await supabase.from('scores').insert({
      name,
      time_seconds: Math.max(1, Math.round(entry.timeSeconds)),
      kills: entry.kills,
      level: entry.level,
      bosses: entry.bosses,
      character_id: entry.characterId,
    })
    return !error
  } catch {
    return false
  }
}

export async function fetchTopScores(limit = 10): Promise<GlobalScore[]> {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('scores')
      .select('name, time_seconds, kills, level, bosses, character_id, created_at')
      .order('time_seconds', { ascending: false })
      .limit(limit)
    if (error || !data) return []
    return data
  } catch {
    return []
  }
}
