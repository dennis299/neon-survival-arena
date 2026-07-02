// Mounts the canvas, owns one game instance per run, and renders the React
// overlays (HUD / level-up cards / pause / recap) around it.

import { useEffect, useRef, useState } from 'react'
import { createGame, type GameControls } from './game/loop'
import { setMuted, unlockAudio } from './game/audio'
import type { HudSnapshot, RunStats, UpgradeChoice } from './game/types'
import type { SaveData } from './game/storage'
import HUD from './components/HUD'
import UpgradeCards from './components/UpgradeCards'
import PauseMenu from './components/PauseMenu'
import GameOver from './components/GameOver'

const EMPTY_HUD: HudSnapshot = {
  hp: 100,
  maxHp: 100,
  xp: 0,
  xpNeeded: 5,
  level: 1,
  time: 0,
  kills: 0,
  coins: 0,
  bossHp: 0,
  bossMaxHp: 0,
  bossName: '',
  fps: 60,
}

export default function GameScreen({
  save,
  onRunEnd,
  onAbandon,
  onToggleMute,
  runKey,
  onRetry,
  onMenu,
}: {
  save: SaveData
  /** bank the run into the save; returns ids of newly earned achievements */
  onRunEnd: (stats: RunStats) => string[]
  onAbandon: (coins: number, kills: number) => void
  onToggleMute: () => void
  runKey: number
  onRetry: () => void
  onMenu: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<GameControls | null>(null)
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD)
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null)
  const [paused, setPaused] = useState(false)
  const [gameOver, setGameOver] = useState<RunStats | null>(null)
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const bankedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    unlockAudio()
    setMuted(save.settings.muted)
    bankedRef.current = false
    setHud(EMPTY_HUD)
    setChoices(null)
    setPaused(false)
    setGameOver(null)

    const controls = createGame(canvas, {
      characterId: save.selectedCharacter,
      shakeScale: save.settings.screenShake,
      bestTime: save.bestTime,
      callbacks: {
        onHud: setHud,
        onLevelUp: setChoices,
        onGameOver: (stats) => {
          bankedRef.current = true
          setNewAchievements(onRunEnd(stats))
          setGameOver(stats)
        },
      },
    })
    controlsRef.current = controls
    return () => {
      controls.destroy()
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  // reflect engine-side pause (P/Esc key) into the React overlay at a low poll rate
  useEffect(() => {
    const id = setInterval(() => {
      const c = controlsRef.current
      if (c && !choices && !gameOver) setPaused(c.isPaused())
    }, 150)
    return () => clearInterval(id)
  }, [choices, gameOver])

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <HUD hud={hud} />
      {choices && !gameOver && (
        <UpgradeCards
          choices={choices}
          onPick={(def) => {
            controlsRef.current?.chooseUpgrade(def)
            setChoices(null)
          }}
        />
      )}
      {paused && !choices && !gameOver && (
        <PauseMenu
          muted={save.settings.muted}
          onResume={() => {
            controlsRef.current?.resume()
            setPaused(false)
          }}
          onToggleMute={onToggleMute}
          onQuit={() => {
            if (!bankedRef.current) onAbandon(hud.coins, hud.kills)
            onMenu()
          }}
        />
      )}
      {gameOver && (
        <GameOver
          stats={gameOver}
          newAchievements={newAchievements}
          onRetry={onRetry}
          onMenu={onMenu}
        />
      )}
    </div>
  )
}
