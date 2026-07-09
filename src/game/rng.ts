// Seedable PRNG (mulberry32) for the sim. Daily-challenge runs seed from the
// UTC date so everyone plays the same run; normal runs reseed from entropy.
// Only decision-making sim code draws from rng() — visual-only randomness
// (particles, screen shake, per-frame cosmetic sparks) stays on Math.random
// so frame rate never changes how many draws the sim consumes.

let s = 0

export function seedRng(seed: number | null | undefined) {
  if (seed === null || seed === undefined) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1)
      crypto.getRandomValues(buf)
      s = buf[0] | 0
    } else {
      s = (Date.now() * 2654435761) | 0
    }
  } else {
    s = seed | 0
  }
}
seedRng(null)

/** drop-in replacement for Math.random() */
export function rng(): number {
  s = (s + 0x6d2b79f5) | 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
