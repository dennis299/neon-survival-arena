// Procedural synthwave score — no audio files. A 4-bar minor progression
// (i–VI–III–VII) drives pulsing sub bass, a filtered arpeggio, four-on-the-
// floor drums, and a persistent legato lead voice with portamento + vibrato
// that carries an actual melody. That lead voice is what "sings": notes
// glide into each other and wobble in pitch the way a held vocal note does,
// instead of the flat on/off blips used for SFX.
//
// Scheduling uses the standard Web Audio look-ahead pattern (schedule ~120ms
// of future notes on a 25ms timer) so tempo stays sample-accurate even if
// the tab hitches — setTimeout-per-note would drift and stutter.

import { getAudioEngine } from './audio'

const BPM = 96
const STEP_DUR = 60 / BPM / 4 // one 16th note, in seconds
const STEPS_PER_BAR = 16
const BARS = 4
const TOTAL_STEPS = STEPS_PER_BAR * BARS
const SCHEDULE_AHEAD = 0.12
const TICK_MS = 25

// i - VI - III - VII in C minor: Cm, Ab, Eb, Bb (root, third, fifth as MIDI notes)
const CHORDS: number[][] = [
  [48, 51, 55], // Cm
  [44, 48, 51], // Ab
  [51, 55, 58], // Eb
  [46, 50, 53], // Bb
]

// [bar, step-in-bar, midi note, length in 16th-notes] — a real call-and-response melody
type LeadNote = [number, number, number, number]
const LEAD_MAIN: LeadNote[] = [
  [1, 0, 63, 3], [1, 4, 65, 2], [1, 8, 68, 3], [1, 12, 67, 4],
  [3, 0, 70, 3], [3, 4, 68, 2], [3, 8, 65, 3], [3, 12, 63, 4],
]
const LEAD_FILL: LeadNote[] = [
  [0, 10, 60, 3], [0, 14, 63, 2],
  [2, 10, 65, 3], [2, 14, 63, 2],
]

function freq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

interface LeadVoice {
  osc1: OscillatorNode
  osc2: OscillatorNode
  gain: GainNode
}

let lead: LeadVoice | null = null
let engineRef: { ctx: AudioContext; music: GainNode } | null = null
let timer: number | null = null
let nextStepTime = 0
let step = 0
let intensity = 0
let bossMode = false

function pluck(
  f: number,
  time: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  filterFreq: number,
) {
  if (!engineRef) return
  const { ctx, music } = engineRef
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
  osc.connect(filter).connect(gain).connect(music)
  osc.start(time)
  osc.stop(time + dur + 0.05)
}

function kick(time: number, vol: number) {
  if (!engineRef) return
  const { ctx, music } = engineRef
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(150, time)
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.13)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22)
  osc.connect(gain).connect(music)
  osc.start(time)
  osc.stop(time + 0.24)
}

function noiseBurst(time: number, dur: number, vol: number, filterType: BiquadFilterType, filterFreq: number, q: number) {
  if (!engineRef) return
  const { ctx, music } = engineRef
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
  src.connect(filter).connect(gain).connect(music)
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
  osc1.type = 'sawtooth'
  const osc2 = ctx.createOscillator()
  osc2.type = 'triangle'
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
  osc1.start()
  osc2.start()
  vibrato.start()
  lead = { osc1, osc2, gain }
  return lead
}

function playLead(midi: number, time: number, lenSteps: number) {
  if (!engineRef) return
  const { ctx, music } = engineRef
  const l = ensureLead(ctx, music)
  const f = freq(midi)
  const glide = 0.05
  l.osc1.frequency.cancelScheduledValues(time)
  l.osc2.frequency.cancelScheduledValues(time)
  l.osc1.frequency.setTargetAtTime(f, time, glide)
  l.osc2.frequency.setTargetAtTime(f, time, glide)
  const dur = lenSteps * STEP_DUR
  const peak = 0.06 + intensity * 0.05 + (bossMode ? 0.03 : 0)
  l.gain.gain.cancelScheduledValues(time)
  l.gain.gain.setValueAtTime(0.0001, time)
  l.gain.gain.exponentialRampToValueAtTime(peak, time + 0.05)
  l.gain.gain.exponentialRampToValueAtTime(peak * 0.75, time + Math.max(dur * 0.6, 0.05))
  l.gain.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.15)
}

function scheduleStep(s: number, time: number) {
  const bar = Math.floor(s / STEPS_PER_BAR)
  const stepInBar = s % STEPS_PER_BAR
  const chord = CHORDS[bar]

  // sub bass: quarter notes, eighths once things heat up (boss = driving chase feel)
  const bassDiv = bossMode ? 2 : 4
  if (stepInBar % bassDiv === 0) {
    pluck(freq(chord[0] - 12), time, STEP_DUR * bassDiv * 0.85, 'sine', 0.22 + intensity * 0.1, 900)
  }

  // arpeggio: chord tones cycling up an octave and back, brightens with intensity
  if (intensity > 0.05 || bossMode) {
    const arpPattern = [0, 1, 2, 1]
    const midi = chord[arpPattern[stepInBar % 4]] + (stepInBar % 8 >= 4 ? 12 : 0)
    const cutoff = 700 + intensity * 2600 + (bossMode ? 800 : 0)
    pluck(freq(midi), time, STEP_DUR * 0.9, 'triangle', 0.05 + intensity * 0.05, cutoff)
  }

  // drums: kick always anchors the beat; hats/clap layer in as intensity rises
  if (stepInBar % 4 === 0) kick(time, 0.5 + intensity * 0.15)
  if (stepInBar % 4 === 2 && (intensity > 0.15 || bossMode)) clap(time, 0.16)
  const hatDiv = bossMode || intensity > 0.6 ? 1 : 2
  if (stepInBar % hatDiv === 0 && (intensity > 0.12 || bossMode)) {
    hat(time, stepInBar % 8 === 6, 0.05 + intensity * 0.05)
  }

  // lead melody: always sings the main phrase; fills join in once things get busy
  for (const [b, st, midi, len] of LEAD_MAIN) {
    if (b === bar && st === stepInBar) playLead(midi, time, len)
  }
  if (intensity > 0.45 || bossMode) {
    for (const [b, st, midi, len] of LEAD_FILL) {
      if (b === bar && st === stepInBar) playLead(midi, time, len)
    }
  }
}

function tick() {
  if (!engineRef) return
  const { ctx } = engineRef
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime)
    nextStepTime += STEP_DUR
    step = (step + 1) % TOTAL_STEPS
  }
}

export interface MusicHandle {
  setIntensity: (v: number) => void
  setBoss: (active: boolean) => void
  stop: () => void
}

/** Starts the score. Call once per run (from a user-gesture-adjacent effect). */
export function startMusic(): MusicHandle | null {
  const engine = getAudioEngine()
  if (!engine) return null
  engineRef = engine
  intensity = 0
  bossMode = false
  step = 0
  nextStepTime = engine.ctx.currentTime + 0.05
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
    stop() {
      if (timer !== null) {
        window.clearInterval(timer)
        timer = null
      }
      if (lead && engineRef) {
        lead.gain.gain.cancelScheduledValues(engineRef.ctx.currentTime)
        lead.gain.gain.setTargetAtTime(0.0001, engineRef.ctx.currentTime, 0.05)
      }
      engineRef = null
    },
  }
}
