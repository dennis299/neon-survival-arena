// Mounts the canvas, owns one game instance per run, and renders the React
// overlays (HUD / level-up cards / pause / recap) around it.

import { useEffect, useRef, useState } from 'react'
import { createGame, type GameControls } from './game/loop'
import { ACHIEVEMENTS, dailyBoardId, dailyKey, dailySeed, todaysDailyMod } from './game/config'
import { evaluateLiveAchievements } from './game/achievements'
import { setMuted, sfx, unlockAudio } from './game/audio'
import { startMusic, type MusicHandle } from './game/music'
import { haptics, setHapticsEnabled } from './game/haptics'
import { acquireWakeLock, releaseWakeLock, watchWakeLockVisibility } from './game/wakelock'
import { fetchRankFor, isGlobalLeaderboardEnabled, submitScore } from './game/leaderboard'
import type { ChestReward, HudSnapshot, RunStats, UpgradeChoice } from './game/types'
import type { SaveData } from './game/storage'
import HUD from './components/HUD'
import UpgradeCards from './components/UpgradeCards'
import ChestOverlay from './components/ChestOverlay'
import PauseMenu from './components/PauseMenu'
import TutorialHints from './components/TutorialHints'
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
  envId: 'outskirts',
  envName: 'CYBER OUTSKIRTS',
  combo: 0,
  comboMult: 1,
  maxCombo: 0,
  evolutions: 0,
  bestTime: 0,
  danger: 0,
}

/** seconds of run time before the score reaches full musical intensity */
const INTENSITY_RAMP = 420
const TOAST_LIFE_MS = 3500

export default function GameScreen({
  save,
  daily,
  onRunEnd,
  onLiveAchievements,
  onAbandon,
  onToggleMute,
  onTutorialSeen,
  runKey,
  onRetry,
  onMenu,
}: {
  save: SaveData
  /** daily-challenge run: fixed character, seeded sim, day's modifier active */
  daily: boolean
  /** bank the run into the save; returns ids of newly earned achievements */
  onRunEnd: (stats: RunStats, meta: { daily: boolean; practice: boolean; dateKey: string }) => string[]
  /** bank achievements earned mid-run immediately (crash-safe) */
  onLiveAchievements: (ids: string[]) => void
  onAbandon: (coins: number, kills: number) => void
  onToggleMute: () => void
  /** first-run hints dismissed — never show them again */
  onTutorialSeen: () => void
  runKey: number
  onRetry: () => void
  onMenu: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<GameControls | null>(null)
  const musicRef = useRef<MusicHandle | null>(null)
  const lastEnvIdRef = useRef('outskirts')
  const [hud, setHud] = useState<HudSnapshot>(EMPTY_HUD)
  const [choices, setChoices] = useState<UpgradeChoice[] | null>(null)
  const [chest, setChest] = useState<ChestReward[] | null>(null)
  const [paused, setPaused] = useState(false)
  const [gameOver, setGameOver] = useState<RunStats | null>(null)
  const [newAchievements, setNewAchievements] = useState<string[]>([])
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle')
  const [globalRank, setGlobalRank] = useState<number | null>(null)
  const [toasts, setToasts] = useState<{ key: number; id: string }[]>([])
  const [showHints, setShowHints] = useState(!save.seenTutorial)
  const bankedRef = useRef(false)
  // live achievement tracking: what's already earned (save + this run) and
  // the save totals frozen at run start for lifetime-threshold checks
  const earnedRef = useRef<Set<string>>(new Set())
  const liveEarnedRef = useRef<string[]>([])
  const baseTotalsRef = useRef({ kills: 0, coins: 0 })
  const practiceRef = useRef(false)
  // daily identity captured at run START — a run crossing UTC midnight must
  // bank and submit under the day whose seed/modifier it actually played
  const dailyIdsRef = useRef({ key: '', board: '' })
  const toastKeyRef = useRef(0)
  const toastTimersRef = useRef<number[]>([])

  const dailyMod = daily ? todaysDailyMod() : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    unlockAudio()
    setMuted(save.settings.muted)
    setHapticsEnabled(save.settings.haptics)
    musicRef.current = startMusic()
    lastEnvIdRef.current = 'outskirts'
    void acquireWakeLock()
    const stopWatchingVisibility = watchWakeLockVisibility()
    bankedRef.current = false
    earnedRef.current = new Set(save.achievements)
    liveEarnedRef.current = []
    baseTotalsRef.current = { kills: save.totalKills, coins: save.coins }
    // the first daily finish of the UTC day is the real attempt; replays are practice
    dailyIdsRef.current = { key: dailyKey(), board: dailyBoardId() }
    practiceRef.current = daily && save.dailyAttempt?.date === dailyIdsRef.current.key
    setHud(EMPTY_HUD)
    setChoices(null)
    setChest(null)
    setPaused(false)
    setGameOver(null)
    setGlobalRank(null)
    setToasts([])
    setSubmitStatus(isGlobalLeaderboardEnabled() ? 'idle' : 'disabled')

    const controls = createGame(canvas, {
      characterId: daily ? 'vanguard' : save.selectedCharacter,
      shakeScale: save.settings.screenShake,
      bestTime: save.bestTime,
      lowEffects: save.settings.reduceEffects,
      seed: daily ? dailySeed() : null,
      dailyMod: daily ? todaysDailyMod() : null,
      permUpgrades: save.permUpgrades,
      callbacks: {
        onHud: (h) => {
          setHud(h)
          // score reacts to the run: slow ramp over time + how hairy it is right now
          musicRef.current?.setIntensity(
            Math.min(1, (h.time / INTENSITY_RAMP) * 0.6 + h.danger * 0.55),
          )
          musicRef.current?.setBoss(h.bossMaxHp > 0)
          musicRef.current?.setLowHp(h.hp > 0 && h.hp / h.maxHp < 0.3)
          if (h.envId !== lastEnvIdRef.current) {
            lastEnvIdRef.current = h.envId
            musicRef.current?.setTheme(h.envId)
          }
          // achievement milestones toast the moment they happen, not at the
          // recap — but not once the player is dead: residual bullets keep
          // killing during the cinematic and must not unlock anything
          if (h.hp <= 0) return
          const fresh = evaluateLiveAchievements(
            h,
            earnedRef.current,
            baseTotalsRef.current.kills,
            baseTotalsRef.current.coins,
          )
          if (fresh.length > 0) {
            for (const id of fresh) earnedRef.current.add(id)
            liveEarnedRef.current.push(...fresh)
            onLiveAchievements(fresh)
            sfx.achievement()
            haptics.achievement()
            const items = fresh.map((id) => ({ key: ++toastKeyRef.current, id }))
            setToasts((t) => [...t, ...items])
            for (const item of items) {
              toastTimersRef.current.push(
                window.setTimeout(() => {
                  setToasts((t) => t.filter((x) => x.key !== item.key))
                }, TOAST_LIFE_MS),
              )
            }
          }
        },
        onLevelUp: setChoices,
        onChest: setChest,
        onGameOver: (stats) => {
          bankedRef.current = true
          const practice = practiceRef.current
          const endEarned = onRunEnd(stats, { daily, practice, dateKey: dailyIdsRef.current.key })
          setNewAchievements([...liveEarnedRef.current, ...endEarned])
          setGameOver(stats)
          // practice daily replays stay off the global board
          if (isGlobalLeaderboardEnabled() && !(daily && practice)) {
            setSubmitStatus('pending')
            void submitScore({
              name: save.playerName,
              timeSeconds: stats.time,
              kills: stats.kills,
              level: stats.level,
              bosses: stats.bossesKilled,
              characterId: daily ? dailyIdsRef.current.board : save.selectedCharacter,
            }).then(async (ok) => {
              setSubmitStatus(ok ? 'ok' : 'error')
              if (ok) setGlobalRank(await fetchRankFor(stats.time, daily ? dailyIdsRef.current.board : undefined))
            })
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
      for (const t of toastTimersRef.current) clearTimeout(t)
      toastTimersRef.current = []
      stopWatchingVisibility()
      releaseWakeLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  // reflect engine-side pause (P/Esc key) into the React overlay at a low poll rate
  useEffect(() => {
    const id = setInterval(() => {
      const c = controlsRef.current
      if (c && !choices && !chest && !gameOver) setPaused(c.isPaused())
    }, 150)
    return () => clearInterval(id)
  }, [choices, chest, gameOver])

  return (
    <div className="game-screen">
      <canvas ref={canvasRef} className="game-canvas" />
      <HUD
        hud={hud}
        onPause={() => {
          controlsRef.current?.pause()
          setPaused(true)
        }}
      />
      {showHints && !gameOver && (
        <TutorialHints
          onDismiss={() => {
            setShowHints(false)
            onTutorialSeen()
          }}
        />
      )}
      {toasts.length > 0 && !gameOver && (
        <div className="ach-toast-stack">
          {toasts.map((t) => {
            const a = ACHIEVEMENTS.find((x) => x.id === t.id)
            if (!a) return null
            return (
              <div key={t.key} className="ach-toast live">
                {a.icon} <b>{a.name}</b> — {a.desc}
              </div>
            )
          })}
        </div>
      )}
      {choices && !gameOver && (
        <UpgradeCards
          choices={choices}
          onPick={(def) => {
            controlsRef.current?.chooseUpgrade(def)
            setChoices(null)
          }}
        />
      )}
      {chest && !choices && !gameOver && (
        <ChestOverlay
          rewards={chest}
          onClaim={() => {
            controlsRef.current?.claimChest()
            setChest(null)
          }}
        />
      )}
      {paused && !choices && !chest && !gameOver && (
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
          globalRank={globalRank}
          dailyName={dailyMod?.name ?? null}
          dailyPractice={practiceRef.current}
          onRetry={onRetry}
          onMenu={onMenu}
        />
      )}
    </div>
  )
}
