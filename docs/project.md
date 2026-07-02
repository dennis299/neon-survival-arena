# Neon Survival Arena — Project Spec

> Cyber Survivor — top-down neon survival shooter. Vampire-Survivors-style roguelite:
> move, auto-fire, kill enemies, collect XP, level up, pick upgrades, survive as long as
> possible. No ending — the clock is the score.

**Status:** 🚧 Planning → build starts next session
**Repo:** standalone GitHub repo (not part of the weekly AI-portfolio monorepo)
**Deploy target:** Vercel (PC + mobile web), custom domain later

## The Pitch
Open the site, tap Play, a glowing blue orb appears in a neon arena. Enemies close in;
the player moves + aims, the weapon auto-fires. Kill enemies → collect XP gems → level
up → choose 1 of 3 random upgrades → grow stronger → enemies scale up → boss every 3
minutes. Repeat, harder each cycle. "I survived 18 minutes... I can beat 20."

## Tech Stack
- **React + Vite + TypeScript** — menus, HUD, upgrade-card picker, pause/run-recap UI
- **HTML5 Canvas**, driven by a raw render loop inside a React ref — the actual game
  (entities, particles, glow). Canvas owns the frame loop for performance; React owns
  everything around it. (Upgraded from the GDD's plain-vanilla-JS suggestion for a more
  polished, engaging PC + mobile experience.)
- No backend — **localStorage** for scores, coins, unlocks
- PWA manifest so mobile players can "Add to Home Screen"
- Deploys as a static site on Vercel, zero server config

## Controls (auto-detected at load)
- **Mobile:** left-thumb virtual joystick = move, right-thumb joystick = aim, auto-fire
- **Desktop:** WASD = move, mouse = aim, auto-fire (or click)

## Core Gameplay Loop
Spawn → kill enemies → collect XP gems → level up → choose 1 of 3 upgrades → grow
stronger → enemies scale up → boss fight → repeat, harder each cycle. Random upgrade
choices mean no two runs play the same.

## Upgrades (stack for emergent builds)
Fire / Ice / Lightning-chain / Explosive / Ricochet bullet mods, Triple Shot, Drone
Companion, Health Regen, Faster Movement, Double Fire Rate, Bigger Explosions. Early
levels favor foundational picks; later levels unlock exotic combos (e.g. Explosive +
Ricochet).

## Enemy Types
Tiny Fast Bugs (swarm, low HP), Slow Tanks (high HP), Snipers (ranged), Flying Drones
(erratic), Exploding Robots (rush + detonate), Teleporting Ninjas (blink), Shield
Enemies (must be flanked).

## Bosses (every 3 min — warning tone + screen pulse)
Giant Robot (rockets + ground-slam shockwaves), Cyber Worm (burrows + erupts), Alien
Queen (minion swarms + radial projectile bursts).

## Difficulty Scaling
Spawn rate rises with elapsed time; HP/speed scale on a curve, not a spike; new enemy
types unlock at time thresholds; bosses act as a periodic skill check.

## Juice (where retention lives)
Dark background, neon blue/purple/pink, orange explosions, glow + particle bursts,
screen shake, floating damage numbers, XP gem pickups. Procedural audio via the Web
Audio API — hit pop, level-up chime, boss warning tone, explosion bass.

## Meta Progression
Coins earned per run persist in localStorage → unlock new characters, weapons, skins,
difficulty modes, a seeded daily challenge, achievements, and a local leaderboard.

## Architecture
```
index.html
/src
  App.tsx            — root React shell, routes menu/game/gameover states
  game/loop.ts        — game loop (requestAnimationFrame), owns the canvas
  input.ts            — desktop + mobile input adapters
  entities/           — player, enemy, bullet, boss, gem
  systems/            — spawn, collision, upgrade, particles
  audio.ts            — Web Audio sound synthesis
  storage.ts          — localStorage save/load
  components/         — HUD, upgrade cards, menus (React)
/public               — manifest.json, icons (PWA)
```

## Build Roadmap
1. **Core** — player moves, auto-shoots, enemies spawn & die
2. **Loop** — XP gems, level-up, 3-card upgrade picker
3. **Content** — enemy variety, bosses, difficulty scaling
4. **Juice** — particles, screen shake, Web Audio sounds
5. **Meta** — coins, unlocks, leaderboard, achievements
6. **Polish** — mobile controls, PWA install, accessibility, README + deploy

## Stretch Features
Weapon evolutions, kill-streak multiplier, pause-menu build summary, screen-clear "nova"
panic button, colorblind-safe palette + screen-shake slider, seeded daily runs, run
recap screen (time, kills, level, damage, coins).

---
Full detail: `Neon_Survival_Arena_GDD.pdf` (this folder).
