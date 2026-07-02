import type { HudSnapshot } from '../game/types'

export function formatTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function HUD({ hud }: { hud: HudSnapshot }) {
  const hpPct = Math.max(0, (hud.hp / hud.maxHp) * 100)
  const xpPct = Math.min(100, (hud.xp / hud.xpNeeded) * 100)
  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <div className="bar hp-bar">
            <div className="bar-fill" style={{ width: `${hpPct}%` }} />
            <span className="bar-label">
              {Math.ceil(hud.hp)} / {hud.maxHp}
            </span>
          </div>
          <div className="bar xp-bar">
            <div className="bar-fill" style={{ width: `${xpPct}%` }} />
            <span className="bar-label">LV {hud.level}</span>
          </div>
        </div>
        <div className="hud-timer">{formatTime(hud.time)}</div>
        <div className="hud-right">
          <div className="hud-stat">💀 {hud.kills}</div>
          <div className="hud-stat coin">🪙 {hud.coins}</div>
        </div>
      </div>
      {hud.bossMaxHp > 0 && hud.bossHp > 0 && (
        <div className="boss-bar-wrap">
          <div className="boss-name">{hud.bossName}</div>
          <div className="bar boss-bar">
            <div
              className="bar-fill"
              style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
