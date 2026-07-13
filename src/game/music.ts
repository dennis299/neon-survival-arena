// Procedural synthwave score — no audio files. Five environment themes each
// define their own key, tempo, instrument timbres, and a real melody (built
// from the same call-and-response contour, transposed + re-rhythmed per
// theme so each stays recognizably "us" while sounding distinct). The lead
// voice is a persistent oscillator pair with portamento + vibrato — that's
// what makes it "sing" instead of blip. `setTheme()` ducks the mix, swaps
// the active theme at the dip, and fades back in, so environment changes
// read as a musical transition rather than a hard cut.
//
// Scheduling uses the standard Web Audio look-ahead pattern (schedule ~120ms
// of future notes on a 25ms timer) so tempo stays sample-accurate even if
// the tab hitches — setTimeout-per-note would drift and stutter.

import { getAudioEngine } from './audio'

const STEPS_PER_BAR = 16
const BARS = 4
const TOTAL_STEPS = STEPS_PER_BAR * BARS
const SCHEDULE_AHEAD = 0.12
const TICK_MS = 25
const MUSIC_BUS_VOLUME = 1 // duckBus itself; overall level still governed by audio.ts's `music` gain

// [bar, step-in-bar, midi note, length in 16th-notes]
type LeadNote = [number, number, number, number]

export interface MusicTheme {
  id: string
  bpm: number
  chords: number[][]
  leadMain: LeadNote[]
  leadFill: LeadNote[]
  bassWave: OscillatorType
  arpWave: OscillatorType
  leadWave1: OscillatorType
  leadWave2: OscillatorType
  sparseDrums: boolean
  delayWet: number
}

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// natural minor scale, one octave, from a given tonic
function scaleFor(tonic: number): number[] {
  return [0, 2, 3, 5, 7, 8, 10].map((iv) => tonic + iv)
}

// i (minor) - VI (major) - III (major) - VII (major), the classic natural-
// minor synthwave progression, generated from any tonic so every theme
// shares the same harmonic shape in a different key.
function minorProgression(tonic: number): number[][] {
  return [
    [tonic, tonic + 3, tonic + 7],
    [tonic - 4, tonic, tonic + 3],
    [tonic + 3, tonic + 7, tonic + 10],
    [tonic - 2, tonic + 2, tonic + 5],
  ]
}

// Same melodic contour (scale-degree indices) reused across every theme so
// they feel like variations on one motif, transposed + re-rhythmed per key.
const MAIN_DEGREES = [2, 3, 5, 4, 6, 5, 3, 2]
const FILL_DEGREES = [0, 2, 3, 2]

function buildLead(scale: number[], rhythm: [number, number, number]): { main: LeadNote[]; fill: LeadNote[] } {
  const [a, b, c] = rhythm
  const main: LeadNote[] = [
    [1, 0, scale[MAIN_DEGREES[0]], a], [1, 4, scale[MAIN_DEGREES[1]], b],
    [1, 8, scale[MAIN_DEGREES[2]], a], [1, 12, scale[MAIN_DEGREES[3]], c],
    [3, 0, scale[MAIN_DEGREES[4]], a], [3, 4, scale[MAIN_DEGREES[5]], b],
    [3, 8, scale[MAIN_DEGREES[6]], a], [3, 12, scale[MAIN_DEGREES[7]], c],
  ]
  const fill: LeadNote[] = [
    [0, 10, scale[FILL_DEGREES[0]], a], [0, 14, scale[FILL_DEGREES[1]], b],
    [2, 10, scale[FILL_DEGREES[2]], a], [2, 14, scale[FILL_DEGREES[3]], b],
  ]
  return { main, fill }
}

function makeTheme(
  id: string,
  bassTonic: number,
  bpm: number,
  rhythm: [number, number, number],
  overrides: Partial<MusicTheme>,
): MusicTheme {
  const { main, fill } = buildLead(scaleFor(bassTonic + 12), rhythm)
  return {
    id,
    bpm,
    chords: minorProgression(bassTonic),
    leadMain: main,
    leadFill: fill,
    bassWave: 'sine',
    arpWave: 'triangle',
    leadWave1: 'sawtooth',
    leadWave2: 'triangle',
    sparseDrums: false,
    delayWet: 0,
    ...overrides,
  }
}

// bass tonics chosen to keep every theme's sub bass in a similar register
export const MUSIC_THEMES: Record<string, MusicTheme> = {
  outskirts: makeTheme('outskirts', 48, 96, [3, 2, 4], {}),
  wastes: makeTheme('wastes', 45, 100, [3, 2, 4], {
    arpWave: 'square', leadWave1: 'sawtooth', leadWave2: 'square',
  }),
  core: makeTheme('core', 42, 128, [2, 1, 3], {
    bassWave: 'sawtooth', arpWave: 'sawtooth', leadWave1: 'sawtooth', leadWave2: 'sawtooth',
  }),
  frostbyte: makeTheme('frostbyte', 47, 84, [4, 3, 6], {
    arpWave: 'sine', leadWave1: 'triangle', leadWave2: 'sine', sparseDrums: true,
  }),
  void: makeTheme('void', 50, 80, [5, 4, 8], {
    arpWave: 'sine', leadWave1: 'sine', leadWave2: 'triangle', sparseDrums: true, delayWet: 0.24,
  }),
}

interface LeadVoice {
  osc1: OscillatorNode
  osc2: OscillatorNode
  gain: GainNode
}

let lead: LeadVoice | null = null
let duckBus: GainNode | null = null
let lowHpFilter: BiquadFilterNode | null = null
let delayNode: DelayNode | null = null
let delayFeedback: GainNode | null = null
let delayWetGain: GainNode | null = null
let engineRef: { ctx: AudioContext; music: GainNode } | null = null
let timer: number | null = null
let nextStepTime = 0
let step = 0
let intensity = 0
let bossMode = false
let lowHpMode = false
let activeTheme: MusicTheme = MUSIC_THEMES.outskirts

function stepDur(): number {
  return 60 / activeTheme.bpm / 4
}

function pluck(
  f: number,
  time: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  filterFreq: number,
) {
  if (!engineRef || !duckBus) return
  const { ctx } = engineRef
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(f, time)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFreq, time)
  filter.Q.value = 1.1
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(Math.max(vol, 0.001), time + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  osc.connect(filter).connect(gain).connect(duckBus)
  osc.start(time)
  osc.stop(time + dur + 0.05)
}

function kick(time: number, vol: number) {
  if (!engineRef || !duckBus) return
  const { ctx } = engineRef
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.13)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22)
  osc.connect(gain).connect(duckBus)
  osc.start(time)
  osc.stop(time + 0.24)
}

function noiseBurst(
  time: number,
  dur: number,
  vol: number,
  filterType: BiquadFilterType,
  filterFreq: number,
  q: number,
) {
  if (!engineRef || !duckBus) return
  const { ctx } = engineRef
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur))
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + dur)
  src.connect(filter).connect(gain).connect(duckBus)
  src.start(time)
}

function hat(time: number, open: boolean, vol: number) {
  noiseBurst(time, open ? 0.09 : 0.035, vol, 'highpass', 7000, 0.7)
}

function clap(time: number, vol: number) {
  ;[0, 0.012, 0.024].forEach((d, i) => {
    noiseBurst(time + d, 0.05, vol * (i === 0 ? 1 : 0.5), 'bandpass', 1600, 2)
  })
}

function ensureLead(ctx: AudioContext, bus: GainNode): LeadVoice {
  if (lead) return lead
  const osc1 = ctx.createOscillator()
  osc1.type = activeTheme.leadWave1
  const osc2 = ctx.createOscillator()
  osc2.type = activeTheme.leadWave2
  osc2.detune.value = 9 // slight chorus width, not modulated
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 2200
  filter.Q.value = 0.7
  const gain = ctx.createGain()
  gain.gain.value = 0.0001
  // vibrato: a slow LFO summed directly into both oscillators' frequency —
  // Web Audio sums multiple connections to the same AudioParam natively
  const vibrato = ctx.createOscillator()
  vibrato.type = 'sine'
  vibrato.frequency.value = 5.4
  const vibratoDepth = ctx.createGain()
  vibratoDepth.gain.value = 3.2 // peak deviation in Hz
  vibrato.connect(vibratoDepth)
  vibratoDepth.connect(osc1.frequency)
  vibratoDepth.connect(osc2.frequency)
  osc1.connect(filter)
  osc2.connect(filter)
  filter.connect(gain)
  gain.connect(bus)
  // send to the delay bus too (its wet gain is 0 unless the active theme wants echo)
  if (delayNode) gain.connect(delayNode)
  osc1.start()
  osc2.start()
  vibrato.start()
  lead = { osc1, osc2, gain }
  return lead
}

function playLead(midi: number, time: number, lenSteps: number) {
  if (!engineRef || !duckBus) return
  const { ctx } = engineRef
  const l = ensureLead(ctx, duckBus)
  const f = freq(midi)
  const glide = 0.05
  l.osc1.frequency.cancelScheduledValues(time)
  l.osc2.frequency.cancelScheduledValues(time)
  l.osc1.frequency.setTargetAtTime(f, time, glide)
  l.osc2.frequency.setTargetAtTime(f, time, glide)
  const dur = lenSteps * stepDur()
  const peak = 0.06 + intensity * 0.05 + (bossMode ? 0.03 : 0)
  l.gain.gain.cancelScheduledValues(time)
  l.gain.gain.setValueAtTime(0.0001, time)
  l.gain.gain.exponentialRampToValueAtTime(peak, time + 0.05)
  l.gain.gain.exponentialRampToValueAtTime(peak * 0.75, time + Math.max(dur * 0.6, 0.05))
  l.gain.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.15)
}

function scheduleStep(s: number, time: number) {
  const theme = activeTheme
  const bar = Math.floor(s / STEPS_PER_BAR)
  const stepInBar = s % STEPS_PER_BAR
  const chord = theme.chords[bar]

  // sub bass: quarter notes, eighths once things heat up (boss = driving chase feel)
  const bassDiv = bossMode ? 2 : 4
  if (stepInBar % bassDiv === 0) {
    pluck(freq(chord[0] - 12), time, stepDur() * bassDiv * 0.85, theme.bassWave, 0.22 + intensity * 0.1, 900)
  }

  // arpeggio: chord tones cycling up an octave and back, brightens with intensity
  if (intensity > 0.05 || bossMode) {
    const arpPattern = [0, 1, 2, 1]
    const midi = chord[arpPattern[stepInBar % 4]] + (stepInBar % 8 >= 4 ? 12 : 0)
    const cutoff = 700 + intensity * 2600 + (bossMode ? 800 : 0)
    pluck(freq(midi), time, stepDur() * 0.9, theme.arpWave, 0.05 + intensity * 0.05, cutoff)
  }

  // drums: kick always anchors the beat; hats/clap layer in as intensity rises.
  // sparse-drum themes (frostbyte/void) hold back further for a calmer feel.
  const drumScale = theme.sparseDrums ? 0.55 : 1
  if (stepInBar % 4 === 0) kick(time, (0.5 + intensity * 0.15) * drumScale)
  // low-hp heartbeat: a "lub-dub" doubling of the kick while the mix is muffled
  if (lowHpMode && stepInBar % 8 === 3) kick(time, 0.55)
  if (stepInBar % 4 === 2 && (intensity > 0.15 || bossMode) && !theme.sparseDrums) clap(time, 0.16)
  const hatDiv = bossMode || intensity > 0.6 ? 1 : 2
  const hatGate = theme.sparseDrums ? intensity > 0.3 || bossMode : intensity > 0.12 || bossMode
  if (stepInBar % hatDiv === 0 && hatGate) {
    hat(time, stepInBar % 8 === 6, (0.05 + intensity * 0.05) * drumScale)
  }

  // lead melody: always sings the main phrase; fills join in once things get busy
  for (const [b, st, midi, len] of theme.leadMain) {
    if (b === bar && st === stepInBar) playLead(midi, time, len)
  }
  if (intensity > 0.45 || bossMode) {
    for (const [b, st, midi, len] of theme.leadFill) {
      if (b === bar && st === stepInBar) playLead(midi, time, len)
    }
  }
}

function tick() {
  if (!engineRef) return
  const { ctx } = engineRef
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime)
    nextStepTime += stepDur()
    step = (step + 1) % TOTAL_STEPS
  }
}

function applyThemeTimbre(theme: MusicTheme) {
  if (lead) {
    lead.osc1.type = theme.leadWave1
    lead.osc2.type = theme.leadWave2
  }
  if (delayWetGain && engineRef) {
    delayWetGain.gain.setTargetAtTime(theme.delayWet, engineRef.ctx.currentTime, 0.6)
  }
}

export interface MusicHandle {
  setIntensity: (v: number) => void
  setBoss: (active: boolean) => void
  /** near-death: muffles the mix and adds a heartbeat until it clears */
  setLowHp: (active: boolean) => void
  /** crossfades to a different environment's theme (id from environments.ts) */
  setTheme: (id: string) => void
  stop: () => void
}

/** Starts the score. Call once per run (from a user-gesture-adjacent effect). */
export function startMusic(initialThemeId?: string): MusicHandle | null {
  const engine = getAudioEngine()
  if (!engine) return null
  engineRef = engine
  intensity = 0
  bossMode = false
  step = 0
  activeTheme = MUSIC_THEMES[initialThemeId ?? 'outskirts'] ?? MUSIC_THEMES.outskirts
  nextStepTime = engine.ctx.currentTime + 0.05

  if (!duckBus) {
    duckBus = engine.ctx.createGain()
    duckBus.gain.value = MUSIC_BUS_VOLUME
    // low-hp muffle: a lowpass between the score and the music bus, wide open
    // normally, swept down when the player is nearly dead
    lowHpFilter = engine.ctx.createBiquadFilter()
    lowHpFilter.type = 'lowpass'
    lowHpFilter.frequency.value = 18000
    duckBus.connect(lowHpFilter).connect(engine.music)
    // space-echo send, only audible when the active theme's delayWet > 0
    delayNode = engine.ctx.createDelay(0.6)
    delayNode.delayTime.value = 0.28
    delayFeedback = engine.ctx.createGain()
    delayFeedback.gain.value = 0.35
    delayWetGain = engine.ctx.createGain()
    delayWetGain.gain.value = activeTheme.delayWet
    delayNode.connect(delayFeedback).connect(delayNode)
    delayNode.connect(delayWetGain).connect(duckBus)
  } else if (lowHpFilter) {
    lowHpFilter.connect(engine.music)
  }
  lowHpMode = false
  lowHpFilter?.frequency.setValueAtTime(18000, engine.ctx.currentTime)
  applyThemeTimbre(activeTheme)

  if (timer === null) {
    timer = window.setInterval(tick, TICK_MS)
  }
  return {
    setIntensity(v: number) {
      intensity = Math.max(0, Math.min(1, v))
    },
    setBoss(active: boolean) {
      bossMode = active
    },
    setLowHp(active: boolean) {
      if (active === lowHpMode) return
      lowHpMode = active
      if (lowHpFilter && engineRef) {
        lowHpFilter.frequency.setTargetAtTime(active ? 750 : 18000, engineRef.ctx.currentTime, 0.4)
      }
    },
    setTheme(id: string) {
      const next = MUSIC_THEMES[id]
      if (!next || next.id === activeTheme.id) return
      if (!engineRef || !duckBus) {
        activeTheme = next
        applyThemeTimbre(next)
        return
      }
      const { ctx } = engineRef
      const now = ctx.currentTime
      duckBus.gain.cancelScheduledValues(now)
      duckBus.gain.setValueAtTime(duckBus.gain.value, now)
      duckBus.gain.linearRampToValueAtTime(0.12, now + 0.6)
      duckBus.gain.linearRampToValueAtTime(MUSIC_BUS_VOLUME, now + 1.8)
      window.setTimeout(() => {
        activeTheme = next
        applyThemeTimbre(next)
      }, 600)
    },
    stop() {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
      if (lead && engineRef) {
        lead.gain.gain.cancelScheduledValues(engineRef.ctx.currentTime)
        lead.gain.gain.setTargetAtTime(0.0001, engineRef.ctx.currentTime, 0.05)
      }
      // detach at the end of the chain; duckBus→filter wiring stays intact
      // so the next startMusic() only needs to re-connect filter→music bus
      lowHpFilter?.disconnect()
      engineRef = null
    },
  }
}
