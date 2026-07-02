// Mounts the canvas, owns one game instance per run, and renders the React
// overlays (HUD / level-up cards / pause / recap) around it.

import { useEffect, useRef, useState } from 'react'
import { createGame, type GameControls } from './game/loop'
import { setMuted, unlockAudio } from './game/audio'
import { startMusic, type MusicHandle } from './game/music'
import { isGlobalLeaderboardEnabled, submitScore } from './game/leaderboard'
import type { HudSnapshot, RunStats, UpgradeChoice } from './game/types'
import type { SaveData } from './game/storage'
import HUD from './components/HUD'
import UpgradeCards from './components/UpgradeCards'
import PauseMenu from './components/PauseMenu'
import GameOver, { type SubmitStatus } from './components/GameOver'

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

/** seconds of run time before the score reaches full musical intensity */
const INTENSITY_RAMP = 420

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
  const musicRef = useRef<MusicHandle | null>(null)
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD)
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null)
  const [paused, setPaused] = useState(false)
  const [gameOver, setGameOver] = useState<RunStats | null>(null)
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const bankedRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    unlockAudio()
    setMuted(save.settings.muted)
    musicRef.current = startMusic()
    bankedRef.current = false
    setHud(EMPTY_HUD)
    setChoices(null)
    setPaused(false)
    setGameOver(null)
    setSubmitStatus(isGlobalLeaderboardEnabled() ? 'idle' : 'disabled')

    const controls = createGame(canvas, {
      characterId: save.selectedCharacter,
      shakeScale: save.settings.screenShake,
      bestTime: save.bestTime,
      callbacks: {
        onHud: (h) => {
          setHud(h)
          musicRef.current?.setIntensity(h.time / INTENSITY_RAMP)
          musicRef.current?.setBoss(h.bossMaxHp > 0)
        },
        onLevelUp: setChoices,
        onGameOver: (stats) => {
          bankedRef.current = true
          setNewAchievements(onRunEnd(stats))
          setGameOver(stats)
          if (isGlobalLeaderboardEnabled()) {
            setSubmitStatus('pending')
            void submitScore({
              name: save.playerName,
              timeSeconds: stats.time,
              kills: stats.kills,
              level: stats.level,
              bosses: stats.bossesKilled,
              characterId: save.selectedCharacter,
            }).then((ok) => setSubmitStatus(ok ? 'ok' : 'error'))
          }
        },
      },
    })
    controlsRef.current = controls
    return () => {
      controls.destroy()
      controlsRef.current = null
      musicRef.current?.stop()
      musicRef.current = null
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
          playerName={save.playerName}
          submitStatus={submitStatus}
          onRetry={onRetry}
          onMenu={onMenu}
        />
      )}
    </div>
  )
}
