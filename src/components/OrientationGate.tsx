import { useEffect, useState } from 'react'

/** Blocks the screen with a "rotate your device" prompt on touch devices held
 * in portrait — the game is landscape-only (PWA manifest already locks this,
 * but that only applies once installed; this covers the plain browser tab). */
export default function OrientationGate() {
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse) and (orientation: portrait)')
    const update = () => setBlocked(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (!blocked) return null
  return (
    <div className="orientation-gate">
      <div className="rotate-icon">⟳</div>
      <p>Rotate your device to play</p>
      <p className="orientation-sub">Neon Survival Arena is a landscape game</p>
    </div>
  )
}
