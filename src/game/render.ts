// Canvas renderer. Neon look = additive-composited radial-gradient glow
// sprites (pre-rendered and cached per color — ctx.shadowBlur is far too slow
// for hundreds of entities), dark grid arena, camera locked to the player
// with decaying screen shake.

import { ENEMY_COLORS, PALETTE } from './config'
import type { Boss, Enemy, GameState } from './types'
import type { InputState } from './input'

const glowCache = new Map<string, HTMLCanvasElement>()

function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color)
  if (c) return c
  const size = 64
  c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, color)
  grad.addColorStop(0.35, color + 'aa')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  glowCache.set(color, c)
  return c
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2)
  ctx.globalAlpha = 1
}

function drawPoly(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  sides: number,
  angle: number,
  color: string,
  fill: boolean,
) {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const a = angle + (i / sides) * Math.PI * 2
    const px = x + Math.cos(a) * r
    const py = y + Math.sin(a) * r
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  if (fill) {
    ctx.fillStyle = color
    ctx.fill()
  } else {
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.stroke()
  }
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const color = ENEMY_COLORS[e.kind]
  const flash = e.hitFlash > 0
  const c = flash ? '#ffffff' : color
  drawGlow(ctx, e.x, e.y, e.radius * 2.4, color, 0.5)
  switch (e.kind) {
    case 'bug':
      drawPoly(ctx, e.x, e.y, e.radius, 3, e.angle, c, true)
      break
    case 'tank':
      drawPoly(ctx, e.x, e.y, e.radius, 4, e.angle + Math.PI / 4, c, true)
      drawPoly(ctx, e.x, e.y, e.radius * 0.55, 4, e.angle + Math.PI / 4, PALETTE.bg, true)
      break
    case 'sniper':
      drawPoly(ctx, e.x, e.y, e.radius, 5, e.angle, c, false)
      ctx.beginPath()
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
      break
    case 'drone': {
      drawPoly(ctx, e.x, e.y, e.radius, 6, e.t * 3, c, false)
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius * 0.4, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
      break
    }
    case 'boomer': {
      const pulse = e.phase === 1 ? 1 + Math.sin(e.t * 40) * 0.15 : 1
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius * pulse, 0, Math.PI * 2)
      ctx.fillStyle = e.phase === 1 && Math.sin(e.t * 40) > 0 ? '#ffffff' : c
      ctx.fill()
      break
    }
    case 'ninja':
      drawPoly(ctx, e.x, e.y, e.radius, 3, e.angle + Math.PI, c, false)
      drawPoly(ctx, e.x, e.y, e.radius * 0.5, 3, e.angle, c, true)
      break
    case 'shield': {
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2)
      ctx.fillStyle = c
      ctx.fill()
      // frontal shield arc
      ctx.beginPath()
      ctx.arc(e.x, e.y, e.radius + 3, e.angle - Math.PI / 3, e.angle + Math.PI / 3)
      ctx.strokeStyle = flash ? '#ffffff' : '#b8ccff'
      ctx.lineWidth = 3.5
      ctx.stroke()
      break
    }
  }
  // hp bar for damaged non-swarm enemies
  if (e.hp < e.maxHp && e.radius >= 11) {
    const w = e.radius * 2
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w, 3)
    ctx.fillStyle = PALETTE.hp
    ctx.fillRect(e.x - w / 2, e.y - e.radius - 8, w * Math.max(0, e.hp / e.maxHp), 3)
  }
}

function drawBoss(ctx: CanvasRenderingContext2D, b: Boss, time: number) {
  if (b.hidden) {
    // rumbling ground marker
    const pulse = 1 + Math.sin(time * 18) * 0.2
    ctx.beginPath()
    ctx.arc(b.x, b.y, 18 * pulse, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(180, 100, 255, 0.6)'
    ctx.lineWidth = 3
    ctx.stroke()
    drawGlow(ctx, b.x, b.y, 40, '#b464ff', 0.35)
    return
  }
  const colors: Record<Boss['kind'], string> = {
    robot: '#ff9a3d',
    worm: '#b464ff',
    queen: '#ff5db1',
  }
  const c = b.hitFlash > 0 ? '#ffffff' : colors[b.kind]
  drawGlow(ctx, b.x, b.y, b.radius * 2.6, colors[b.kind], 0.6)
  switch (b.kind) {
    case 'robot':
      drawPoly(ctx, b.x, b.y, b.radius, 4, Math.PI / 4, c, true)
      drawPoly(ctx, b.x, b.y, b.radius * 0.6, 4, Math.PI / 4, PALETTE.bg, true)
      drawPoly(ctx, b.x, b.y, b.radius * 0.3, 4, time * 2, c, true)
      break
    case 'worm':
      for (let i = 0; i < 5; i++) {
        const seg = b.radius * (1 - i * 0.15)
        const sx = b.x - Math.cos(b.angle) * i * seg * 0.9
        const sy = b.y - Math.sin(b.angle) * i * seg * 0.9
        ctx.beginPath()
        ctx.arc(sx, sy, seg, 0, Math.PI * 2)
        ctx.fillStyle = i === 0 ? c : colors.worm + (i % 2 ? '99' : 'cc')
        ctx.fill()
      }
      break
    case 'queen':
      drawPoly(ctx, b.x, b.y, b.radius, 6, time * 0.8, c, true)
      drawPoly(ctx, b.x, b.y, b.radius * 0.55, 6, -time * 1.2, PALETTE.bg, true)
      drawPoly(ctx, b.x, b.y, b.radius * 0.3, 3, time * 2, c, true)
      break
  }
  ctx.lineWidth = 1
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  input: InputState,
  w: number,
  h: number,
  shakeScale: number,
) {
  const p = state.player

  ctx.fillStyle = PALETTE.bg
  ctx.fillRect(0, 0, w, h)

  const shakeX = (Math.random() - 0.5) * state.shake * shakeScale
  const shakeY = (Math.random() - 0.5) * state.shake * shakeScale
  const camX = p.x - w / 2 + shakeX
  const camY = p.y - h / 2 + shakeY

  ctx.save()
  ctx.translate(-camX, -camY)

  // grid
  const grid = 56
  ctx.strokeStyle = PALETTE.grid
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let x = Math.floor(camX / grid) * grid; x < camX + w + grid; x += grid) {
    ctx.moveTo(x, camY)
    ctx.lineTo(x, camY + h)
  }
  for (let y = Math.floor(camY / grid) * grid; y < camY + h + grid; y += grid) {
    ctx.moveTo(camX, y)
    ctx.lineTo(camX + w, y)
  }
  ctx.stroke()

  // additive pass for everything glowy
  ctx.globalCompositeOperation = 'lighter'

  // gems & coins
  for (const g of state.gems) {
    const color = g.isCoin ? PALETTE.coin : PALETTE.xp
    const bob = Math.sin(g.t * 6) * 2
    drawGlow(ctx, g.x, g.y + bob, g.radius * 2.2, color, 0.6)
    drawPoly(ctx, g.x, g.y + bob, g.radius, 4, g.t * 2, color, true)
  }

  // enemy bullets
  for (const b of state.enemyBullets) {
    drawGlow(ctx, b.x, b.y, b.radius * 3, '#ff5d5d', 0.8)
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#ffb3b3'
    ctx.fill()
  }

  // player bullets
  for (const b of state.bullets) {
    const color = b.fire ? PALETTE.fire : b.ice ? PALETTE.ice : PALETTE.bullet
    drawGlow(ctx, b.x, b.y, b.radius * 3.2, color, 0.9)
    ctx.beginPath()
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }

  // enemies
  for (const e of state.enemies) drawEnemy(ctx, e)

  // boss
  if (state.boss) drawBoss(ctx, state.boss, state.time)

  // drones
  for (const d of state.droneUnits) {
    const dx = p.x + Math.cos(d.angle) * 52
    const dy = p.y + Math.sin(d.angle) * 52
    drawGlow(ctx, dx, dy, 16, '#64ffda', 0.8)
    drawPoly(ctx, dx, dy, 6, 3, d.angle, '#64ffda', true)
  }

  // player — glowing orb
  const flash = p.hurtFlash > 0 && Math.sin(state.time * 40) > 0
  drawGlow(ctx, p.x, p.y, 34, PALETTE.player, flash ? 0.4 : 1)
  ctx.beginPath()
  ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
  ctx.fillStyle = flash ? PALETTE.hp : PALETTE.playerCore
  ctx.fill()
  // aim indicator
  ctx.beginPath()
  ctx.moveTo(p.x + Math.cos(p.aim) * 14, p.y + Math.sin(p.aim) * 14)
  ctx.lineTo(p.x + Math.cos(p.aim) * 24, p.y + Math.sin(p.aim) * 24)
  ctx.strokeStyle = PALETTE.player
  ctx.lineWidth = 3
  ctx.stroke()

  // particles
  for (const pt of state.particles) {
    const a = Math.max(0, pt.life / pt.maxLife)
    if (pt.glow) {
      drawGlow(ctx, pt.x, pt.y, pt.size * 2.5, pt.color, a * 0.9)
    } else {
      ctx.globalAlpha = a
      ctx.fillStyle = pt.color
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size)
      ctx.globalAlpha = 1
    }
  }

  ctx.globalCompositeOperation = 'source-over'

  // floating damage numbers
  ctx.textAlign = 'center'
  for (const t of state.texts) {
    ctx.globalAlpha = Math.min(1, t.life * 2.5)
    ctx.fillStyle = t.color
    ctx.font = `bold ${t.size}px 'Courier New', monospace`
    ctx.fillText(t.text, t.x, t.y)
  }
  ctx.globalAlpha = 1

  ctx.restore()

  // boss incoming warning — red pulse frame
  if (state.bossWarnT > 0) {
    const pulse = Math.abs(Math.sin(state.time * 8))
    ctx.strokeStyle = `rgba(255, 61, 110, ${0.35 + pulse * 0.5})`
    ctx.lineWidth = 8 + pulse * 8
    ctx.strokeRect(0, 0, w, h)
    ctx.fillStyle = `rgba(255, 61, 110, ${0.6 + pulse * 0.4})`
    ctx.font = "bold 26px 'Courier New', monospace"
    ctx.textAlign = 'center'
    ctx.fillText('⚠ BOSS INCOMING ⚠', w / 2, h * 0.22)
  }

  // low-hp vignette
  if (p.hp / p.maxHp < 0.3) {
    const a = (0.3 - p.hp / p.maxHp) * 1.4
    const grad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.75)
    grad.addColorStop(0, 'rgba(255,0,60,0)')
    grad.addColorStop(1, `rgba(255,0,60,${Math.min(0.45, a)})`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  // touch joysticks
  if (input.touchMode) {
    for (const stick of [input.left, input.right]) {
      if (!stick.active) continue
      ctx.beginPath()
      ctx.arc(stick.ox, stick.oy, 56, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(140, 200, 255, 0.25)'
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(stick.ox + stick.dx * 56, stick.oy + stick.dy * 56, 22, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(140, 200, 255, 0.35)'
      ctx.fill()
    }
  }
}
