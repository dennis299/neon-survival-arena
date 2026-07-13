import { ACHIEVEMENTS } from '../game/config'
import type { RunStats } from '../game/types'
import { formatTime } from './HUD'

export type SubmitStatus = 'idle' | 'pending' | 'ok' | 'error' | 'disabled'

function SubmitLine({ status, name }: { status: SubmitStatus; name: string }) {
  if (status === 'idle' || status === 'disabled') return null
  if (status === 'pending') {
    return <div className="submit-line pending">🌐 syncing to global leaderboard…</div>
  }
  if (status === 'ok') {
    return (
      <div className="submit-line ok">
        🌐 added to the global leaderboard as <b>{name}</b>
      </div>
    )
  }
  return <div className="submit-line error">🌐 offline — this run is saved locally only</div>
}

export default function GameOver({
  stats,
  newAchievements,
  playerName,
  submitStatus,
  globalRank,
  dailyName,
  dailyPractice,
  onRetry,
  onMenu,
}: {
  stats: RunStats
  newAchievements: string[]
  playerName: string
  submitStatus: SubmitStatus
  globalRank: number | null
  /** daily-challenge run: the day's modifier name (null for normal runs) */
  dailyName: string | null
  /** replay after today's real attempt — not submitted anywhere */
  dailyPractice: boolean
  onRetry: () => void
  onMenu: () => void
}) {
  return (
    <div className="overlay">
      <h2 className="overlay-title glow-text danger-text">RUN OVER</h2>
      {dailyName && (
        <div className="daily-recap">
          📅 DAILY CHALLENGE — {dailyName.toUpperCase()}
          {dailyPractice && <span className="daily-practice"> · PRACTICE</span>}
        </div>
      )}
      <div className="killed-by">☠ KILLED BY {stats.killedBy}</div>
      {stats.newBest && <div className="new-best">★ NEW BEST TIME ★</div>}
      {globalRank !== null && (
        <div className="global-rank">
          #{globalRank.toLocaleString()} WORLDWIDE
        </div>
      )}
      <div className="recap-time">{formatTime(stats.time)}</div>
      <div className="recap-grid">
        <div className="recap-stat">
          <span className="recap-num">{stats.level}</span>
          <span>level</span>
        </div>
        <div className="recap-stat">
          <span className="recap-num">{stats.kills}</span>
          <span>kills</span>
        </div>
        <div className="recap-stat">
          <span className="recap-num">{stats.bossesKilled}</span>
          <span>bosses</span>
        </div>
        <div className="recap-stat">
          <span className="recap-num">{stats.damageDealt.toLocaleString()}</span>
          <span>damage</span>
        </div>
        <div className="recap-stat">
          <span className="recap-num">{stats.maxCombo}</span>
          <span>max combo</span>
        </div>
        <div className="recap-stat coin">
          <span className="recap-num">+{stats.coins}</span>
          <span>coins</span>
        </div>
      </div>

      {stats.upgrades.length > 0 && (
        <div className="recap-build">
          {stats.upgrades.map((u) => (
            <span
              key={u.name}
              className="build-chip"
              style={{ ['--card-color' as string]: u.color }}
              title={u.name}
            >
              {u.icon} {u.name} {u.level > 1 ? `×${u.level}` : ''}
            </span>
          ))}
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="recap-achievements">
          {newAchievements.map((id) => {
            const a = ACHIEVEMENTS.find((x) => x.id === id)
            if (!a) return null
            return (
              <div key={id} className="ach-toast">
                {a.icon} <b>{a.name}</b> — {a.desc}
              </div>
            )
          })}
        </div>
      )}

      <SubmitLine status={submitStatus} name={playerName} />

      <div className="overlay-btns">
        <button className="btn primary" onClick={onRetry}>
          ⟳ RUN IT BACK
        </button>
        <button className="btn" onClick={onMenu}>
          MENU
        </button>
      </div>
    </div>
  )
}
