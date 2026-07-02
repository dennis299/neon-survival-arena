import { useState } from 'react'
import { ACHIEVEMENTS, CHARACTERS } from '../game/config'
import type { SaveData } from '../game/storage'
import { formatTime } from './HUD'

type Tab = 'play' | 'ranks' | 'trophies'

export default function MainMenu({
  save,
  onPlay,
  onSelectCharacter,
  onBuyCharacter,
  onToggleMute,
  onShake,
}: {
  save: SaveData
  onPlay: () => void
  onSelectCharacter: (id: string) => void
  onBuyCharacter: (id: string) => void
  onToggleMute: () => void
  onShake: (v: number) => void
}) {
  const [tab, setTab] = useState<Tab>('play')

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
          <button className="play-btn glow-text" onClick={onPlay}>
            ▶ PLAY
          </button>
          <div className="settings-row">
            <button className="mini-btn" onClick={onToggleMute}>
              {save.settings.muted ? '🔇 sound off' : '🔊 sound on'}
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
        <div className="board">
          {save.leaderboard.length === 0 && <p className="board-empty">no runs yet — go survive</p>}
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
