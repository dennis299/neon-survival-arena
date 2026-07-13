// Treasure chest reveal: rewards were already rolled by the loop but are only
// applied when CLAIM resumes the sim (mirrors how chooseUpgrade works).

import { useEffect, useState } from 'react'
import { sfx } from '../game/audio'
import type { ChestReward } from '../game/types'

const STAGGER_MS = 600

export default function ChestOverlay({
  rewards,
  onClaim,
}: {
  rewards: ChestReward[]
  onClaim: () => void
}) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timers = rewards.map((_, i) =>
      setTimeout(() => sfx.chestReward(i), i * STAGGER_MS + 250),
    )
    timers.push(setTimeout(() => setReady(true), rewards.length * STAGGER_MS + 300))
    return () => timers.forEach(clearTimeout)
  }, [rewards])

  return (
    <div className="overlay">
      <span className="chest-icon">🎁</span>
      <h2 className="overlay-title glow-text">TREASURE!</h2>
      <div className="chest-rewards">
        {rewards.map((r, i) => (
          <div
            key={i}
            className="chest-reward"
            style={{
              ['--card-color' as string]: r.color,
              animationDelay: `${i * STAGGER_MS}ms`,
            }}
          >
            <span className="chest-reward-icon">{r.icon}</span>
            <span className="chest-reward-name">{r.name}</span>
            {r.level > 0 && <span className="card-level">LV {r.level}</span>}
          </div>
        ))}
      </div>
      <button className={ready ? 'btn primary chest-claim' : 'btn primary chest-claim hidden'} onClick={onClaim} disabled={!ready}>
        CLAIM
      </button>
    </div>
  )
}
