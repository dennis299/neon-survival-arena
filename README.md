# ⚡ Neon Survival Arena

> A top-down neon survival shooter for desktop **and** mobile web. Move, auto-fire,
> collect XP, level up, pick upgrades, survive the swarm. There is no ending —
> **the clock is the score.**

**🎮 Play it live: [neon-survival-arena.vercel.app](https://neon-survival-arena.vercel.app)** — works on desktop and phones

![Gameplay](docs/screenshots/gameplay.png)

## How it plays

You're a glowing orb in an endless neon arena. Enemies close in from every side;
your weapon fires on its own — your job is to move, aim, and make build decisions:

**Kill → collect XP gems → level up → pick 1 of 3 random upgrades → grow stronger →
enemies scale up → boss every 3 minutes → repeat, harder each cycle.**

Random upgrade choices mean no two runs play the same. *"I survived 18 minutes...
I can beat 20."*

![Level up](docs/screenshots/levelup.png)

## Features

- **12+ stacking upgrades** — Fire / Ice / Lightning-chain / Explosive / Ricochet
  bullet mods, Triple Shot, Railgun Pierce, Drone Companions, regen, speed… late
  picks unlock exotic combos (Explosive + Ricochet is a personal favorite)
- **7 enemy types** — swarming bugs, tanks, ranged snipers, erratic flyers,
  exploding rushers, teleporting ninjas, and shield-bearers that must be flanked
- **3 bosses on a 3-minute clock** — Giant Robot (rockets + radial slam),
  Cyber Worm (burrows and erupts under you), Alien Queen (minion swarms +
  projectile bursts) — each cycle they return stronger
- **Meta progression** — coins persist between runs to unlock 4 characters with
  different starting builds; local top-10 leaderboard; 9 achievements
- **All juice, no assets** — every visual is procedural canvas glow (additive
  compositing, particle bursts, screen shake, floating damage numbers) and every
  sound is synthesized live with the Web Audio API. Zero image/audio files.
- **Desktop + mobile** — WASD + mouse on PC, dual virtual thumbsticks on phones,
  auto-detected. Installable as a PWA ("Add to Home Screen").

## Controls

| | Move | Aim | Fire | Pause |
|---|---|---|---|---|
| **Desktop** | WASD / arrows | mouse | automatic | P / Esc |
| **Mobile** | left thumbstick | right thumbstick | automatic | — |

## Tech stack

- **React 19 + Vite + TypeScript** — menus, HUD, upgrade picker, run recap
- **HTML5 Canvas** — the actual game, driven by a raw `requestAnimationFrame`
  loop inside a React ref. Canvas owns the frame loop for performance; React owns
  everything around it and never touches the hot path.
- **Web Audio API** — procedural synthesis for every sound effect
- **localStorage** — coins, unlocks, leaderboard, achievements. No backend at all.
- **Vercel** — deploys as a static site, zero server config

## Architecture

```
src/
  App.tsx              — root shell: menu / game / recap routing, save data
  GameScreen.tsx       — mounts the canvas, bridges engine ↔ React overlays
  game/
    loop.ts            — the game loop (rAF), owns the mutable GameState
    render.ts          — canvas renderer (cached glow sprites, additive pass)
    input.ts           — desktop + mobile input adapters
    audio.ts           — Web Audio sound synthesis
    storage.ts         — localStorage save/load
    config.ts          — ALL tuning: enemies, bosses, upgrades, difficulty curve
    entities/          — player, enemy AI, boss AI, bullets, gems
    systems/           — spawn director, collision + damage, upgrades, particles
  components/          — HUD, upgrade cards, menus, pause, game over (React)
public/                — PWA manifest + icons
```

The design rule: **the simulation never allocates React state.** The engine pushes
throttled HUD snapshots and lifecycle events (level-up choices, run stats) out
through callbacks; React pushes commands (chosen upgrade, pause/resume) back in
through a small controls API. That separation is what keeps hundreds of entities +
particles at 60 fps while the UI stays declarative.

Performance notes:
- Glow is pre-rendered radial-gradient sprites composited with `lighter` —
  `ctx.shadowBlur` is 10x too slow for this many entities
- Spatial-hash broad phase for all collision queries (bullets, chains, splash,
  separation) — no O(n²) sweeps
- Entity arrays use swap-remove; particle/text/gem counts are capped

## Difficulty scaling

Spawn interval eases from 1.1s → 0.16s over 13 minutes; enemy HP/speed scale on a
gentle per-minute curve (not a spike); new enemy types unlock at time thresholds;
bosses act as a periodic skill check with an HP multiplier per cycle.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

No env vars, no backend, no accounts. Clone and play.

## Lessons learned

- **Canvas-in-React works great if you draw a hard line.** One `useEffect` mounts
  the engine, one callback surface crosses the boundary. The moment game state
  leaks into React state, the frame budget is gone.
- **`ctx.shadowBlur` does not survive contact with 200 entities.** Pre-rendered
  gradient sprites + additive compositing give the same neon look ~10x faster.
- **Web Audio needs a rate limiter.** 30 simultaneous hit sounds in one frame is
  just clipping — throttling identical SFX to one per ~60ms *sounds* better.
- **Balance lives in one file on purpose** (`config.ts`) — every playtest tweak
  is a one-line diff.

## More screenshots

| Main menu | Run recap |
|---|---|
| ![Menu](docs/screenshots/menu.png) | ![Recap](docs/screenshots/recap.png) |

## Future improvements

- Weapon evolutions (max an upgrade + boss kill → evolved form)
- Seeded daily challenge runs
- Kill-streak multiplier + screen-clear "nova" panic button
- Colorblind-safe palette option
- Gamepad support

## License

[MIT](LICENSE) — do whatever you want with it.
