import { useCallback, useEffect, useRef, useState } from 'react'
import MainMenu from './components/MainMenu'
import OrientationGate from './components/OrientationGate'
import GameScreen from './GameScreen'
import { CHARACTERS, PERM_UPGRADES, dailyKey, permUpgradeCost } from './game/config'
import { evaluateRunAchievements } from './game/achievements'
import { setMuted, unlockAudio } from './game/audio'
import { setHapticsEnabled } from './game/haptics'
import {
  addLeaderboardEntry,
  loadSave,
  writeSave,
  type SaveData,
} from './game/storage'
import type { RunStats } from './game/types'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'game'>('menu')
  const [save, setSave] = useState<SaveData>(loadSave)
  const [runKey, setRunKey] = useState(0)
  const [daily, setDaily] = useState(false)
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
    (stats: RunStats, meta: { daily: boolean; practice: boolean }): string[] => {
      const cur = saveRef.current
      const character = meta.daily
        ? 'Daily'
        : (CHARACTERS.find((c) => c.id === cur.selectedCharacter)?.name ?? '?')
      const newAch = evaluateRunAchievements(cur, stats, meta.daily)
      let next: SaveData = {
        ...cur,
        coins: cur.coins + stats.coins,
        totalKills: cur.totalKills + stats.kills,
        totalBosses: cur.totalBosses + stats.bossesKilled,
        totalElites: cur.totalElites + stats.eliteKills,
        totalDashes: cur.totalDashes + stats.dashes,
        totalChests: cur.totalChests + stats.chestsOpened,
        achievements: [...cur.achievements, ...newAch],
      }
      // first daily finish of the UTC day is the real attempt
      if (meta.daily && !meta.practice) {
        next = { ...next, dailyAttempt: { date: dailyKey(), time: stats.time } }
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

  // in-run achievement toasts bank immediately so a crash can't lose them
  const handleLiveAchievements = useCallback(
    (ids: string[]) => {
      const cur = saveRef.current
      const fresh = ids.filter((id) => !cur.achievements.includes(id))
      if (fresh.length === 0) return
      updateSave({ ...cur, achievements: [...cur.achievements, ...fresh] })
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

  const handleTutorialSeen = useCallback(() => {
    const cur = saveRef.current
    if (!cur.seenTutorial) updateSave({ ...cur, seenTutorial: true })
  }, [updateSave])

  if (screen === 'game') {
    return (
      <>
        <OrientationGate />
        <GameScreen
          save={save}
          daily={daily}
          runKey={runKey}
          onRunEnd={handleRunEnd}
          onLiveAchievements={handleLiveAchievements}
          onAbandon={handleAbandon}
          onToggleMute={toggleMute}
          onTutorialSeen={handleTutorialSeen}
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
        onPlay={(playDaily) => {
          setDaily(playDaily)
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
        onBuyPermUpgrade={(id) => {
          const def = PERM_UPGRADES.find((u) => u.id === id)
          if (!def) return
          const rank = save.permUpgrades[id] ?? 0
          const cost = permUpgradeCost(def, rank)
          if (rank >= def.maxRank || save.coins < cost) return
          const achievements =
            rank + 1 >= def.maxRank && !save.achievements.includes('perm-max')
              ? [...save.achievements, 'perm-max']
              : save.achievements
          updateSave({
            ...save,
            coins: save.coins - cost,
            permUpgrades: { ...save.permUpgrades, [id]: rank + 1 },
            achievements,
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
