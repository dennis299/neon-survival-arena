// localStorage persistence — coins, unlocks, leaderboard, achievements,
// settings. No backend anywhere in this game.

export interface LeaderboardEntry {
  time: number
  kills: number
  level: number
  character: string
  date: string
}

export interface SaveData {
  coins: number
  totalKills: number
  bestTime: number
  unlockedCharacters: string[]
  selectedCharacter: string
  leaderboard: LeaderboardEntry[]
  achievements: string[]
  playerName: string
  settings: {
    muted: boolean
    screenShake: number
    haptics: boolean
    reduceEffects: boolean
  }
}

const KEY = 'neon-survival-arena-save-v1'

function randomName(): string {
  return `Neon${Math.floor(1000 + Math.random() * 9000)}`
}

function defaults(): SaveData {
  return {
    coins: 0,
    totalKills: 0,
    bestTime: 0,
    unlockedCharacters: ['vanguard'],
    selectedCharacter: 'vanguard',
    leaderboard: [],
    achievements: [],
    playerName: randomName(),
    settings: { muted: false, screenShake: 1, haptics: true, reduceEffects: false },
  }
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) {
      const fresh = defaults()
      writeSave(fresh)
      return fresh
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>
    const merged = { ...defaults(), ...parsed, settings: { ...defaults().settings, ...parsed.settings } }
    // first load after this feature shipped: persist the generated name so
    // it doesn't re-randomize on every reload until the user changes it
    if (!parsed.playerName) writeSave(merged)
    return merged
  } catch {
    return defaults()
  }
}

export function writeSave(data: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // storage full / private mode — play on without persistence
  }
}

export function addLeaderboardEntry(data: SaveData, entry: LeaderboardEntry): SaveData {
  const board = [...data.leaderboard, entry]
    .sort((a, b) => b.time - a.time)
    .slice(0, 10)
  return { ...data, leaderboard: board, bestTime: Math.max(data.bestTime, entry.time) }
}
