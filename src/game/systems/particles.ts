// Particles, floating damage numbers, and screen shake — the juice layer.

import type { FloatingText, GameState } from '../types'

const PARTICLE_CAP = 900
const PARTICLE_CAP_LOW = 320

export function spawnBurst(
  state: GameState,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  size: number,
  life: number,
  glow: boolean,
) {
  const cap = state.lowEffects ? PARTICLE_CAP_LOW : PARTICLE_CAP
  const room = cap - state.particles.length
  const n = Math.min(count, Math.max(0, room))
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const v = speed * (0.3 + Math.random() * 0.7)
    state.particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: life * (0.6 + Math.random() * 0.4),
      maxLife: life,
      size: size * (0.7 + Math.random() * 0.6),
      color,
      glow,
    })
  }
}

export function spawnExplosionFx(state: GameState, x: number, y: number, radius: number) {
  spawnBurst(state, x, y, '#ff9a3d', Math.min(26, 10 + radius * 0.2), radius * 3.2, 4.5, 0.5, true)
  spawnBurst(state, x, y, '#ffd23e', 8, radius * 2, 3, 0.35, true)
  state.shake += Math.min(10, 3 + radius * 0.06)
}

export function addText(
  state: GameState,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 13,
) {
  if (state.texts.length > 120) return
  const t: FloatingText = { x: x + (Math.random() - 0.5) * 12, y, vy: -55, life: 0.75, text, color, size }
  state.texts.push(t)
}

export function updateParticles(state: GameState, dt: number) {
  const ps = state.particles
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vx *= 1 - 4 * dt
    p.vy *= 1 - 4 * dt
    p.life -= dt
    if (p.life <= 0) {
      ps[i] = ps[ps.length - 1]
      ps.pop()
    }
  }
  const ts = state.texts
  for (let i = ts.length - 1; i >= 0; i--) {
    const t = ts[i]
    t.y += t.vy * dt
    t.vy *= 1 - 2.5 * dt
    t.life -= dt
    if (t.life <= 0) {
      ts[i] = ts[ts.length - 1]
      ts.pop()
    }
  }
  state.shake = Math.max(0, state.shake - state.shake * 7 * dt - 2 * dt)
}
