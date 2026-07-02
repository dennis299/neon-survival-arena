import { useCallback, useEffect, useRef, useState } from 'react'
import MainMenu from './components/MainMenu'
import OrientationGate from './components/OrientationGate'
import GameScreen from './GameScreen'
import { CHARACTERS } from './game/config'
import { setMuted, unlockAudio } from './game/audio'
import { setHapticsEnabled } from './game/haptics'
import {
  addLeaderboardEntry,
  loadSave,
  writeSave,
  type SaveData,
} from './game/storage'
import type { RunStats } from './game/types'

function evaluateAchievements(save: SaveData, stats: RunStats): string[] {
  const earned: string[] = []
  const has = (id: string) => save.achievements.includes(id) || earned.includes(id)
  const award = (id: string, cond: boolean) => {
    if (cond && !has(id)) earned.push(id)
  }
  award('first-blood', stats.kills > 0)
  award('survive-5', stats.time >= 300)
  award('survive-10', stats.time >= 600)
  award('survive-18', stats.time >= 1080)
  award('boss-1', stats.bossesKilled >= 1)
  award('boss-3', stats.bossesKilled >= 3)
  award('level-20', stats.level >= 20)
  award('kills-1000', save.totalKills + stats.kills >= 1000)
  award('rich', save.coins + stats.coins >= 1000)
  return earned
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [save, setSave] = useState<SaveData>(loadSave)
  const [runKey, setRunKey] = useState(0)
  // keep the latest save reachable from game callbacks without re-mounting the game
  const saveRef = useRef(save)
  saveRef.current = save

  // a first touch anywhere unlocks/resumes audio — a safety net alongside the
  // explicit unlockAudio() call on the Play button, for browsers stricter
  // about exactly which gesture counts
  useEffect(() => {
    const handler = () => unlockAudio()
    document.addEventListener('pointerdown', handler, { once: true })
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  useEffect(() => {
    setHapticsEnabled(save.settings.haptics)
  }, [save.settings.haptics])

  const updateSave = useCallback((next: SaveData) => {
    setSave(next)
    writeSave(next)
  }, [])

  const handleRunEnd = useCallback(
    (stats: RunStats): string[] => {
      const cur = saveRef.current
      const character = CHARACTERS.find((c) => c.id === cur.selectedCharacter)?.name ?? '?'
      const newAch = evaluateAchievements(cur, stats)
      let next: SaveData = {
        ...cur,
        coins: cur.coins + stats.coins,
        totalKills: cur.totalKills + stats.kills,
        achievements: [...cur.achievements, ...newAch],
      }
      next = addLeaderboardEntry(next, {
        time: stats.time,
        kills: stats.kills,
        level: stats.level,
        character,
        date: new Date().toLocaleDateString(),
      })
      updateSave(next)
      return newAch
    },
    [updateSave],
  )

  const handleAbandon = useCallback(
    (coins: number, kills: number) => {
      const cur = saveRef.current
      updateSave({ ...cur, coins: cur.coins + coins, totalKills: cur.totalKills + kills })
    },
    [updateSave],
  )

  const toggleMute = useCallback(() => {
    const cur = saveRef.current
    const next = { ...cur, settings: { ...cur.settings, muted: !cur.settings.muted } }
    setMuted(next.settings.muted)
    updateSave(next)
  }, [updateSave])

  if (screen === 'game') {
    return (
      <>
        <OrientationGate />
        <GameScreen
          save={save}
          runKey={runKey}
          onRunEnd={handleRunEnd}
          onAbandon={handleAbandon}
          onToggleMute={toggleMute}
          onRetry={() => setRunKey((k) => k + 1)}
          onMenu={() => setScreen('menu')}
        />
      </>
    )
  }

  return (
    <>
      <OrientationGate />
      <MainMenu
        save={save}
        onPlay={() => {
          setRunKey((k) => k + 1)
          setScreen('game')
        }}
        onSelectCharacter={(id) => updateSave({ ...save, selectedCharacter: id })}
        onBuyCharacter={(id) => {
          const def = CHARACTERS.find((c) => c.id === id)
          if (!def || save.coins < def.cost) return
          updateSave({
            ...save,
            coins: save.coins - def.cost,
            unlockedCharacters: [...save.unlockedCharacters, id],
            selectedCharacter: id,
          })
        }}
        onToggleMute={toggleMute}
        onShake={(v) =>
          updateSave({ ...save, settings: { ...save.settings, screenShake: v } })
        }
        onRename={(name) => updateSave({ ...save, playerName: name })}
        onToggleHaptics={() =>
          updateSave({ ...save, settings: { ...save.settings, haptics: !save.settings.haptics } })
        }
        onToggleReduceEffects={() =>
          updateSave({
            ...save,
            settings: { ...save.settings, reduceEffects: !save.settings.reduceEffects },
          })
        }
      />
    </>
  )
}
