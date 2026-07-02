import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, CHARACTERS } from '../game/config'
import { unlockAudio } from '../game/audio'
import { fetchTopScores, isGlobalLeaderboardEnabled, type GlobalScore } from '../game/leaderboard'
import type { SaveData } from '../game/storage'
import { formatTime } from './HUD'

type Tab = 'play' | 'ranks' | 'trophies'
type Board = 'local' | 'global'

const HAS_VIBRATE = typeof navigator !== 'undefined' && 'vibrate' in navigator

export default function MainMenu({
  save,
  onPlay,
  onSelectCharacter,
  onBuyCharacter,
  onToggleMute,
  onShake,
  onRename,
  onToggleHaptics,
  onToggleReduceEffects,
}: {
  save: SaveData
  onPlay: () => void
  onSelectCharacter: (id: string) => void
  onBuyCharacter: (id: string) => void
  onToggleMute: () => void
  onShake: (v: number) => void
  onRename: (name: string) => void
  onToggleHaptics: () => void
  onToggleReduceEffects: () => void
}) {
  const [tab, setTab] = useState<Tab>('play')
  const [board, setBoard] = useState<Board>(isGlobalLeaderboardEnabled() ? 'global' : 'local')
  const [nameInput, setNameInput] = useState(save.playerName)
  const [globalScores, setGlobalScores] = useState<GlobalScore[] | null>(null)
  const [globalState, setGlobalState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => setNameInput(save.playerName), [save.playerName])

  function commitName() {
    const trimmed = nameInput.trim().slice(0, 16)
    if (trimmed && trimmed !== save.playerName) onRename(trimmed)
    else setNameInput(save.playerName)
  }

  function loadGlobal() {
    if (!isGlobalLeaderboardEnabled()) return
    setGlobalState('loading')
    fetchTopScores(10)
      .then((scores) => {
        setGlobalScores(scores)
        setGlobalState('idle')
      })
      .catch(() => setGlobalState('error'))
  }

  useEffect(() => {
    if (tab === 'ranks' && board === 'global' && globalScores === null) loadGlobal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, board])

  return (
    <div className="menu">
      <h1 className="title glow-text">
        NEON<span className="title-accent">SURVIVAL</span>ARENA
      </h1>
      <p className="tagline">survive the swarm · the clock is the score</p>

      <div className="menu-stats">
        <span>🪙 {save.coins}</span>
        <span>⏱️ best {formatTime(save.bestTime)}</span>
        <span>💀 {save.totalKills.toLocaleString()} kills</span>
      </div>

      <label className="name-field">
        <span>callsign</span>
        <input
          value={nameInput}
          maxLength={16}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
        />
      </label>

      <div className="tabs">
        <button className={tab === 'play' ? 'tab active' : 'tab'} onClick={() => setTab('play')}>
          PLAY
        </button>
        <button className={tab === 'ranks' ? 'tab active' : 'tab'} onClick={() => setTab('ranks')}>
          LEADERBOARD
        </button>
        <button
          className={tab === 'trophies' ? 'tab active' : 'tab'}
          onClick={() => setTab('trophies')}
        >
          TROPHIES
        </button>
      </div>

      {tab === 'play' && (
        <>
          <div className="characters">
            {CHARACTERS.map((c) => {
              const unlocked = save.unlockedCharacters.includes(c.id)
              const selected = save.selectedCharacter === c.id
              const affordable = save.coins >= c.cost
              return (
                <button
                  key={c.id}
                  className={`char ${selected ? 'selected' : ''} ${unlocked ? '' : 'locked'}`}
                  style={{ ['--char-color' as string]: c.color }}
                  onClick={() => (unlocked ? onSelectCharacter(c.id) : affordable && onBuyCharacter(c.id))}
                >
                  <span className="char-orb" />
                  <span className="char-name">{c.name}</span>
                  <span className="char-desc">{c.desc}</span>
                  {!unlocked && (
                    <span className={`char-cost ${affordable ? 'ok' : ''}`}>🪙 {c.cost}</span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            className="play-btn glow-text"
            onClick={() => {
              // resume/create the AudioContext synchronously inside this click
              // handler — iOS Safari only honors the unlock within the
              // original user-gesture call stack, not after a React effect
              unlockAudio()
              onPlay()
            }}
          >
            ▶ PLAY
          </button>
          <div className="settings-row">
            <button className="mini-btn" onClick={onToggleMute}>
              {save.settings.muted ? '🔇 sound off' : '🔊 sound on'}
            </button>
            {HAS_VIBRATE && (
              <button className="mini-btn" onClick={onToggleHaptics}>
                {save.settings.haptics ? '📳 haptics on' : '📴 haptics off'}
              </button>
            )}
            <button className="mini-btn" onClick={onToggleReduceEffects}>
              {save.settings.reduceEffects ? '🌫️ effects: low' : '✨ effects: full'}
            </button>
            <label className="shake-label">
              shake
              <input
                type="range"
                min={0}
                max={1}
                step={0.25}
                value={save.settings.screenShake}
                onChange={(e) => onShake(Number(e.target.value))}
              />
            </label>
          </div>
          <p className="controls-hint">
            desktop: WASD move · mouse aim · auto-fire · P pause
            <br />
            mobile: left thumb move · right thumb aim
          </p>
        </>
      )}

      {tab === 'ranks' && (
        <>
          {isGlobalLeaderboardEnabled() && (
            <div className="board-tabs">
              <button
                className={board === 'global' ? 'pill active' : 'pill'}
                onClick={() => setBoard('global')}
              >
                🌐 GLOBAL
              </button>
              <button
                className={board === 'local' ? 'pill active' : 'pill'}
                onClick={() => setBoard('local')}
              >
                💾 THIS DEVICE
              </button>
              {board === 'global' && (
                <button className="pill refresh" onClick={loadGlobal} title="refresh">
                  ⟳
                </button>
              )}
            </div>
          )}

          {board === 'local' && (
            <div className="board">
              {save.leaderboard.length === 0 && (
                <p className="board-empty">no runs yet — go survive</p>
              )}
              {save.leaderboard.map((e, i) => (
                <div key={i} className="board-row">
                  <span className="board-rank">#{i + 1}</span>
                  <span className="board-time">{formatTime(e.time)}</span>
                  <span>LV {e.level}</span>
                  <span>💀 {e.kills}</span>
                  <span className="board-char">{e.character}</span>
                  <span className="board-date">{e.date}</span>
                </div>
              ))}
            </div>
          )}

          {board === 'global' && (
            <div className="board">
              {globalState === 'loading' && <p className="board-empty">loading…</p>}
              {globalState === 'error' && (
                <p className="board-empty">couldn't reach the leaderboard — try again</p>
              )}
              {globalState === 'idle' && globalScores?.length === 0 && (
                <p className="board-empty">no runs yet — be the first</p>
              )}
              {globalState === 'idle' &&
                globalScores?.map((e, i) => (
                  <div key={`${e.name}-${e.created_at}-${i}`} className="board-row">
                    <span className="board-rank">#{i + 1}</span>
                    <span className="board-time">{formatTime(e.time_seconds)}</span>
                    <span>LV {e.level}</span>
                    <span>💀 {e.kills}</span>
                    <span className="board-char">{e.name}</span>
                    <span className="board-date">
                      {new Date(e.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      )}

      {tab === 'trophies' && (
        <div className="trophies">
          {ACHIEVEMENTS.map((a) => {
            const got = save.achievements.includes(a.id)
            return (
              <div key={a.id} className={`trophy ${got ? 'got' : ''}`}>
                <span className="trophy-icon">{got ? a.icon : '🔒'}</span>
                <div>
                  <div className="trophy-name">{a.name}</div>
                  <div className="trophy-desc">{a.desc}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
