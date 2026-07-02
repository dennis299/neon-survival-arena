// Lightweight ambient particles (embers/snow/spores/stars) that drift
// continuously around the camera to sell each environment's atmosphere.
// Unlike combat particles these never expire — they wrap when they drift
// too far from the player instead of fading out.

import type { AmbientKind } from '../environments'
import type { AmbientParticle, GameState } from '../types'

const COUNT_FULL = 46
const COUNT_LOW = 18
const SPAWN_RADIUS = 520

function spawnOne(kind: AmbientKind, cx: number, cy: number): AmbientParticle {
  const angle = Math.random() * Math.PI * 2
  const r = Math.random() * SPAWN_RADIUS
  const x = cx + Math.cos(angle) * r
  const y = cy + Math.sin(angle) * r
  switch (kind) {
    case 'embers':
      return {
        x, y,
        vx: (Math.random() - 0.5) * 14,
        vy: -18 - Math.random() * 22,
        size: 1.5 + Math.random() * 2.5,
        alpha: 0.4 + Math.random() * 0.5,
        twinklePhase: Math.random() * 10,
      }
    case 'snow':
      return {
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: 14 + Math.random() * 18,
        size: 1.5 + Math.random() * 2,
        alpha: 0.35 + Math.random() * 0.5,
        twinklePhase: Math.random() * 10,
      }
    case 'spores':
      return {
        x, y,
        vx: (Math.random() - 0.5) * 12,
        vy: -8 - Math.random() * 10,
        size: 2 + Math.random() * 3,
        alpha: 0.25 + Math.random() * 0.35,
        twinklePhase: Math.random() * 10,
      }
    case 'stars':
      return {
        x, y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 1 + Math.random() * 1.6,
        alpha: 0.3 + Math.random() * 0.6,
        twinklePhase: Math.random() * 10,
      }
    default:
      return { x, y, vx: 0, vy: 0, size: 0, alpha: 0, twinklePhase: 0 }
  }
}

export function resetAmbient(state: GameState, kind: AmbientKind, lowEffects: boolean) {
  const count = kind === 'none' ? 0 : lowEffects ? COUNT_LOW : COUNT_FULL
  const list: AmbientParticle[] = []
  for (let i = 0; i < count; i++) list.push(spawnOne(kind, state.player.x, state.player.y))
  state.ambientParticles = list
}

export function updateAmbient(state: GameState, dt: number, kind: AmbientKind) {
  const p = state.player
  const limit = SPAWN_RADIUS * 1.3
  const limitSq = limit * limit
  for (const a of state.ambientParticles) {
    a.x += a.vx * dt
    a.y += a.vy * dt
    a.twinklePhase += dt
    const dx = a.x - p.x
    const dy = a.y - p.y
    if (dx * dx + dy * dy > limitSq) {
      const fresh = spawnOne(kind, p.x, p.y)
      a.x = fresh.x
      a.y = fresh.y
      a.vx = fresh.vx
      a.vy = fresh.vy
    }
  }
}
