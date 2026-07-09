// The game loop. Owns the canvas, requestAnimationFrame, and the mutable
// GameState. React talks to it only through the returned controls and the
// GameCallbacks — no React state inside the hot path.

import { CHARACTERS, CHEST, EVOLUTIONS, PALETTE, UPGRADES, comboMultiplier, defaultRunMods, xpForLevel } from './config'
import { ENVIRONMENTS, nextEnvIndex, randomEnvDuration } from './environments'
import { seedRng } from './rng'
import { createInput } from './input'
import { createPlayer, updatePlayer } from './entities/player'
import { firePlayerWeapon, updateBullets, updateDrones } from './entities/bullet'
import { updateEnemies } from './entities/enemy'
import { updateBoss } from './entities/boss'
import { updateGems } from './entities/gem'
import { resolveCollisions } from './systems/collision'
import { applyUpgrade, rollChestRewards, rollChoices } from './systems/upgrade'
import { updateSpawner } from './systems/spawn'
import { updatePickups } from './systems/pickup'
import { addText, spawnBurst, updateParticles } from './systems/particles'
import { resetAmbient, updateAmbient } from './systems/ambient'
import { render } from './render'
import { sfx } from './audio'
import { haptics } from './haptics'
import type { DailyModDef, EvolutionDef, GameCallbacks, GameState, RunStats, UpgradeDef } from './types'

export interface GameOptions {
  characterId: string
  shakeScale: number
  bestTime: number
  lowEffects: boolean
  /** fixed seed for the sim's RNG (daily challenge); null = entropy */
  seed: number | null
  /** active daily-challenge modifier; null for normal runs */
  dailyMod: DailyModDef | null
  /** rank per permanent-upgrade id (SaveData.permUpgrades) */
  permUpgrades: Record<string, number>
  callbacks: GameCallbacks
}

export interface GameControls {
  pause: () => void
  resume: () => void
  isPaused: () => boolean
  chooseUpgrade: (def: UpgradeDef | EvolutionDef) => void
  /** apply the rolled chest rewards and resume the sim */
  claimChest: () => void
  destroy: () => void
}

const MAX_DT = 1 / 30
const HUD_INTERVAL = 0.1

export function createGame(canvas: HTMLCanvasElement, opts: GameOptions): GameControls {
  const ctx = canvas.getContext('2d')!
  const input = createInput(canvas)
  const character = CHARACTERS.find((c) => c.id === opts.characterId) ?? CHARACTERS[0]

  // seed once per run, before anything draws from the sim RNG
  seedRng(opts.seed)
  const mods = defaultRunMods()

  const state: GameState = {
    time: 0,
    kills: 0,
    level: 1,
    xp: 0,
    xpNeeded: xpForLevel(2),
    coins: 0,
    damageDealt: 0,
    bossesKilled: 0,
    running: true,
    paused: false,
    over: false,
    player: createPlayer(character, opts.permUpgrades, opts.dailyMod, mods),
    enemies: [],
    bullets: [],
    enemyBullets: [],
    gems: [],
    pickups: [],
    burnPatches: [],
    particles: [],
    texts: [],
    droneUnits: [],
    boss: null,
    bossCycle: 0,
    bossWarnT: 0,
    spawnT: 0.5,
    shake: 0,
    nextId: 1,
    upgradesTaken: {},
    ambientParticles: [],
    envIndex: 0,
    envT: randomEnvDuration(),
    envBannerT: 2.6,
    lowEffects: opts.lowEffects,
    combo: 0,
    comboT: 0,
    maxCombo: 0,
    hitStop: 0,
    timeScale: 1,
    dying: false,
    deathT: 0,
    zoom: 1,
    lastHitBy: 'THE SWARM',
    evolutions: [],
    chestPendingRewards: 0,
    flashT: 0,
    mods,
    eliteKills: 0,
    dashes: 0,
    nukesUsed: 0,
    chestsOpened: 0,
    pbBeaten: false,
    pbBannerT: 0,
  }
  resetAmbient(state, ENVIRONMENTS[state.envIndex].ambient, state.lowEffects)

  // Head Start perm upgrade: enough starting XP for one free level-up per
  // rank — the normal level-up flow fires immediately and offers the picks
  const headStart = opts.permUpgrades['headstart'] ?? 0
  for (let i = 0; i < headStart; i++) state.xp += xpForLevel(2 + i)

  let viewW = 0
  let viewH = 0
  let raf = 0
  let last = performance.now()
  let hudT = 0
  let fps = 60
  /** seconds of sustained sub-38fps; trips the low-effects fallback at 4s */
  let lowFpsT = 0
  let levelUpPending = false
  let chestOpen = false
  /** rolled-but-unclaimed chest contents; null entries = coin fallback */
  let chestDefs: (UpgradeDef | null)[] = []

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    viewW = canvas.clientWidth
    viewH = canvas.clientHeight
    canvas.width = Math.round(viewW * dpr)
    canvas.height = Math.round(viewH * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize)

  function pushHud() {
    // danger drives the music's intensity: swarm density + an active boss
    const danger = Math.min(
      1,
      state.enemies.length / 120 + (state.boss && !state.boss.dead ? 0.45 : 0),
    )
    opts.callbacks.onHud({
      hp: state.player.hp,
      maxHp: state.player.maxHp,
      xp: state.xp,
      xpNeeded: state.xpNeeded,
      level: state.level,
      time: state.time,
      kills: state.kills,
      coins: state.coins,
      bossHp: state.boss && !state.boss.dead ? state.boss.hp : 0,
      bossMaxHp: state.boss ? state.boss.maxHp : 0,
      bossName: state.boss ? state.boss.name : '',
      fps,
      envId: ENVIRONMENTS[state.envIndex].id,
      envName: ENVIRONMENTS[state.envIndex].name,
      combo: state.combo,
      comboMult: comboMultiplier(state.combo),
      maxCombo: state.maxCombo,
      evolutions: state.evolutions.length,
      bestTime: opts.bestTime,
      danger,
    })
  }

  function buildRunStats(): RunStats {
    const upgrades = Object.entries(state.upgradesTaken).map(([id, level]) => {
      const def = UPGRADES.find((u) => u.id === id)!
      return { name: def.name, level, icon: def.icon, color: def.color }
    })
    for (const id of state.evolutions) {
      const def = EVOLUTIONS.find((e) => e.id === id)!
      upgrades.push({ name: def.name, level: 1, icon: def.icon, color: def.color })
    }
    return {
      time: state.time,
      kills: state.kills,
      level: state.level,
      coins: state.coins,
      bossesKilled: state.bossesKilled,
      damageDealt: Math.round(state.damageDealt),
      maxCombo: state.maxCombo,
      evolutions: state.evolutions.length,
      eliteKills: state.eliteKills,
      dashes: state.dashes,
      nukesUsed: state.nukesUsed,
      chestsOpened: state.chestsOpened,
      killedBy: state.lastHitBy,
      upgrades,
      newBest: state.time > opts.bestTime,
    }
  }

  function update(dt: number) {
    state.time += dt

    const inp = input.poll(viewW / 2, viewH / 2)
    updatePlayer(state, inp, input.consumeDash(), dt)
    if (!state.dying) firePlayerWeapon(state, dt)
    updateDrones(state, dt)
    updateBullets(state, dt)
    updateEnemies(state, dt)
    updateBoss(state, dt)
    updateGems(state, dt)
    updatePickups(state, dt, viewW, viewH)
    updateSpawner(state, dt, viewW, viewH)
    resolveCollisions(state, dt)
    updateParticles(state, dt)
    state.flashT = Math.max(0, state.flashT - dt)

    // environment cycling: every 60-120s the arena (and its music theme) changes
    state.envT -= dt
    if (state.envT <= 0) {
      state.envIndex = nextEnvIndex(state.envIndex)
      state.envT = randomEnvDuration()
      state.envBannerT = 3.2
      resetAmbient(state, ENVIRONMENTS[state.envIndex].ambient, state.lowEffects)
    }
    state.envBannerT = Math.max(0, state.envBannerT - dt)
    updateAmbient(state, dt, ENVIRONMENTS[state.envIndex].ambient)

    // live PB marker: the moment this run outlasts the previous best
    // (only for established bests — a 20s first run isn't a record)
    if (!state.pbBeaten && opts.bestTime >= 60 && state.time > opts.bestTime) {
      state.pbBeaten = true
      state.pbBannerT = 3
      sfx.newRecord()
      haptics.newRecord()
    }
    state.pbBannerT = Math.max(0, state.pbBannerT - dt)

    // combo window: streak decays if the kills stop coming
    if (state.comboT > 0) {
      state.comboT -= dt
      if (state.comboT <= 0) {
        state.combo = 0
      }
    }

    // chest touched: pause the sim, roll rewards, hand them to React.
    // Waits its turn if a level-up picker is already open.
    if (state.chestPendingRewards > 0 && !levelUpPending && !chestOpen && !state.dying) {
      const n = state.chestPendingRewards
      state.chestPendingRewards = 0
      chestDefs = []
      const rewards = rollChestRewards(state, n).map((r) => {
        chestDefs.push(r.def)
        return r.def
          ? { name: r.def.name, icon: r.def.icon, color: r.def.color, desc: r.def.desc, level: r.level }
          : { name: `+${CHEST.coinFallback} COINS`, icon: '💰', color: PALETTE.coin, desc: 'Everything is maxed — take the money', level: 0 }
      })
      chestOpen = true
      state.paused = true
      sfx.chestOpen()
      pushHud()
      opts.callbacks.onChest(rewards)
    }

    // level-up: pause the sim and hand choices to React
    if (state.xp >= state.xpNeeded && !levelUpPending && !chestOpen && !state.dying) {
      state.xp -= state.xpNeeded
      state.level++
      state.xpNeeded = xpForLevel(state.level + 1)
      levelUpPending = true
      state.paused = true
      sfx.levelUp()
      haptics.levelUp()
      pushHud()
      opts.callbacks.onLevelUp(rollChoices(state))
    }

    // death: don't cut straight to the recap — 1.3s of slow-mo zoom first
    if (state.player.hp <= 0 && !state.dying && !state.over) {
      state.dying = true
      state.deathT = 1.3
      state.hitStop = Math.max(state.hitStop, 0.12)
      sfx.gameOver()
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const rawDt = (now - last) / 1000
    last = now
    if (rawDt > 0) fps = fps * 0.95 + (1 / rawDt) * 0.05

    // struggling device: drop to low-effects for the rest of the run
    // (one-way — flapping back and forth would be more distracting than help)
    if (!state.lowEffects && state.running && !state.paused) {
      lowFpsT = fps < 38 ? lowFpsT + rawDt : 0
      if (lowFpsT > 4) {
        state.lowEffects = true
        resetAmbient(state, ENVIRONMENTS[state.envIndex].ambient, true)
      }
    }

    if (input.consumePause() && !levelUpPending && !chestOpen && !state.over && !state.dying) {
      state.paused = !state.paused
    }

    if (state.running && !state.paused) {
      // death cinematic: sim crawls, camera pushes in, then the recap fires
      if (state.dying) {
        state.timeScale += (0.22 - state.timeScale) * Math.min(1, rawDt * 10)
        state.zoom += (1.35 - state.zoom) * Math.min(1, rawDt * 3)
        state.deathT -= rawDt
        if (state.deathT <= 0 && !state.over) {
          state.over = true
          state.running = false
          pushHud()
          opts.callbacks.onGameOver(buildRunStats())
        }
      }

      // impact frames: freeze the sim for a few ms but keep rendering
      if (state.hitStop > 0) {
        state.hitStop -= rawDt
      } else {
        update(Math.min(rawDt, MAX_DT) * state.timeScale)
      }
      hudT -= rawDt
      if (hudT <= 0) {
        hudT = HUD_INTERVAL
        pushHud()
      }
    }

    render(ctx, state, input.state, viewW, viewH, opts.shakeScale)
  }
  raf = requestAnimationFrame(frame)

  return {
    pause: () => {
      if (!state.over) state.paused = true
    },
    resume: () => {
      if (!levelUpPending && !chestOpen) state.paused = false
    },
    isPaused: () => state.paused,
    chooseUpgrade: (def: UpgradeDef | EvolutionDef) => {
      const isEvolution = 'requires' in def
      applyUpgrade(state, def)
      if (isEvolution) {
        sfx.evolution()
        haptics.evolution()
        const p = state.player
        addText(state, p.x, p.y - 40, `${def.name.toUpperCase()}!`, def.color, 20)
        for (let i = 0; i < 4; i++) spawnBurst(state, p.x, p.y, def.color, 16, 280, 4.5, 0.8, true)
        spawnBurst(state, p.x, p.y, '#ffffff', 12, 200, 3, 0.5, true)
      } else {
        sfx.pick()
      }
      levelUpPending = false
      state.paused = false
      pushHud()
    },
    claimChest: () => {
      // rewards apply here, not at roll time — mirrors chooseUpgrade so the
      // sim only mutates once the player confirms
      for (const def of chestDefs) {
        if (def) applyUpgrade(state, def)
        else state.coins += CHEST.coinFallback
      }
      chestDefs = []
      chestOpen = false
      state.paused = false
      pushHud()
    },
    destroy: () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      input.destroy()
    },
  }
}
