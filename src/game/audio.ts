// Procedural audio via the Web Audio API — no sound files. Every effect is
// synthesized: oscillators for tones, filtered noise for explosions.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let music: GainNode | null = null
let muted = false
let lastPlay: Record<string, number> = {}

export const MUSIC_VOLUME = 0.3

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
    // separate bus for music so mute/toggles don't fight the SFX throttling
    music = ctx.createGain()
    music.gain.value = MUSIC_VOLUME
    music.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio() {
  ensureCtx()
}

/** The shared context + buses, for the music engine. */
export function getAudioEngine(): { ctx: AudioContext; music: GainNode } | null {
  const c = ensureCtx()
  if (!c || !music) return null
  return { ctx: c, music }
}

export function setMuted(m: boolean) {
  muted = m
  if (ctx && music) {
    music.gain.linearRampToValueAtTime(m ? 0 : MUSIC_VOLUME, ctx.currentTime + 0.15)
  }
}

export function isSfxMuted() {
  return muted
}

export function isMuted() {
  return muted
}

/** rate-limit identical sounds so 30 hits in one frame don't clip the mix */
function throttled(key: string, minGap: number): boolean {
  const now = performance.now()
  if (now - (lastPlay[key] ?? 0) < minGap) return true
  lastPlay[key] = now
  return false
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  freqEnd?: number,
) {
  const c = ensureCtx()
  if (!c || !master || muted) return
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime)
  if (freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), c.currentTime + duration)
  }
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  osc.connect(gain).connect(master)
  osc.start()
  osc.stop(c.currentTime + duration)
}

function noise(duration: number, volume: number, filterFreq: number, filterEnd?: number) {
  const c = ensureCtx()
  if (!c || !master || muted) return
  const len = Math.floor(c.sampleRate * duration)
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFreq, c.currentTime)
  if (filterEnd !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(filterEnd, 10), c.currentTime + duration)
  }
  const gain = c.createGain()
  gain.gain.setValueAtTime(volume, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration)
  src.connect(filter).connect(gain).connect(master)
  src.start()
}

export const sfx = {
  shoot() {
    if (throttled('shoot', 70)) return
    tone(880, 0.06, 'square', 0.06, 440)
  },
  hit() {
    if (throttled('hit', 50)) return
    tone(220, 0.08, 'sawtooth', 0.08, 110)
  },
  enemyDie() {
    if (throttled('die', 60)) return
    tone(330, 0.14, 'triangle', 0.12, 55)
    noise(0.1, 0.08, 1200, 200)
  },
  explosion() {
    if (throttled('boom', 90)) return
    noise(0.45, 0.35, 900, 60)
    tone(90, 0.4, 'sine', 0.3, 30)
  },
  gem() {
    if (throttled('gem', 60)) return
    tone(1320, 0.09, 'sine', 0.1, 1760)
  },
  coin() {
    if (throttled('coin', 80)) return
    tone(988, 0.06, 'square', 0.08)
    setTimeout(() => tone(1319, 0.1, 'square', 0.08), 60)
  },
  hurt() {
    if (throttled('hurt', 200)) return
    tone(160, 0.25, 'sawtooth', 0.25, 60)
  },
  levelUp() {
    ;[523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => tone(f, 0.18, 'triangle', 0.16), i * 90)
    })
  },
  pick() {
    tone(660, 0.12, 'triangle', 0.14, 880)
  },
  bossWarn() {
    ;[0, 350, 700].forEach((d) => {
      setTimeout(() => {
        tone(78, 0.32, 'sawtooth', 0.3, 74)
        tone(156, 0.32, 'square', 0.12, 148)
      }, d)
    })
  },
  bossDie() {
    noise(1.1, 0.4, 1400, 40)
    tone(65, 1.0, 'sine', 0.35, 25)
    ;[880, 1109, 1319, 1760].forEach((f, i) => {
      setTimeout(() => tone(f, 0.25, 'triangle', 0.14), 200 + i * 110)
    })
  },
  gameOver() {
    ;[392, 330, 262, 196].forEach((f, i) => {
      setTimeout(() => tone(f, 0.35, 'triangle', 0.2), i * 200)
    })
  },
}
