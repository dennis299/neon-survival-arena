// Input adapters. Desktop: WASD/arrows move, mouse aims. Mobile: left virtual
// joystick moves, right joystick aims. The loop polls this every frame; touch
// joystick state is also read by the renderer to draw the sticks.

export interface JoystickState {
  active: boolean
  /** screen-space origin (where the finger went down) */
  ox: number
  oy: number
  /** current normalized offset, each axis in [-1, 1] */
  dx: number
  dy: number
  pointerId: number
}

export interface InputState {
  moveX: number
  moveY: number
  /** aim angle in radians, world-relative to the player */
  aim: number
  /** whether the player is actively aiming (mobile right stick / any desktop) */
  aiming: boolean
  touchMode: boolean
  left: JoystickState
  right: JoystickState
  pausePressed: boolean
}

const JOY_RADIUS = 56

export function detectTouchMode(): boolean {
  return window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

export function createInput(canvas: HTMLCanvasElement) {
  const keys = new Set<string>()
  let mouseX = 0
  let mouseY = 0
  const state: InputState = {
    moveX: 0,
    moveY: 0,
    aim: 0,
    aiming: false,
    touchMode: detectTouchMode(),
    left: { active: false, ox: 0, oy: 0, dx: 0, dy: 0, pointerId: -1 },
    right: { active: false, ox: 0, oy: 0, dx: 0, dy: 0, pointerId: -1 },
    pausePressed: false,
  }

  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code)
    if (e.code === 'Escape' || e.code === 'KeyP') state.pausePressed = true
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault()
    }
  }
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
  const onMouseMove = (e: MouseEvent) => {
    const r = canvas.getBoundingClientRect()
    mouseX = e.clientX - r.left
    mouseY = e.clientY - r.top
  }

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    state.touchMode = true
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const stick = x < r.width / 2 ? state.left : state.right
    if (stick.active) return
    stick.active = true
    stick.ox = x
    stick.oy = y
    stick.dx = 0
    stick.dy = 0
    stick.pointerId = e.pointerId
    e.preventDefault()
  }
  const onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    const r = canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    for (const stick of [state.left, state.right]) {
      if (stick.active && stick.pointerId === e.pointerId) {
        const dx = x - stick.ox
        const dy = y - stick.oy
        const len = Math.hypot(dx, dy)
        const clamped = Math.min(len, JOY_RADIUS)
        if (len > 0) {
          stick.dx = (dx / len) * (clamped / JOY_RADIUS)
          stick.dy = (dy / len) * (clamped / JOY_RADIUS)
        }
      }
    }
  }
  const onPointerUp = (e: PointerEvent) => {
    for (const stick of [state.left, state.right]) {
      if (stick.pointerId === e.pointerId) {
        stick.active = false
        stick.dx = 0
        stick.dy = 0
        stick.pointerId = -1
      }
    }
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerUp)

  /** Poll current input. playerScreenX/Y = where the player is drawn, for mouse aim. */
  function poll(playerScreenX: number, playerScreenY: number): InputState {
    if (state.touchMode && (state.left.active || state.right.active)) {
      state.moveX = state.left.dx
      state.moveY = state.left.dy
      if (state.right.active && Math.hypot(state.right.dx, state.right.dy) > 0.25) {
        state.aim = Math.atan2(state.right.dy, state.right.dx)
        state.aiming = true
      } else {
        state.aiming = false
      }
      return state
    }
    let mx = 0
    let my = 0
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1
    const len = Math.hypot(mx, my)
    state.moveX = len > 0 ? mx / len : 0
    state.moveY = len > 0 ? my / len : 0
    state.aim = Math.atan2(mouseY - playerScreenY, mouseX - playerScreenX)
    state.aiming = true
    return state
  }

  function consumePause(): boolean {
    const p = state.pausePressed
    state.pausePressed = false
    return p
  }

  function destroy() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerUp)
  }

  return { poll, consumePause, destroy, state }
}

export type Input = ReturnType<typeof createInput>
