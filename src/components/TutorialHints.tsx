// First-run control hints. Non-blocking: the sim keeps running behind them.
// Shown once ever (SaveData.seenTutorial); dismissed by the button or the timer.

import { useEffect, useState } from 'react'
import { detectTouchMode } from '../game/input'

const AUTO_DISMISS_MS = 14000

export default function TutorialHints({ onDismiss }: { onDismiss: () => void }) {
  const [touch] = useState(detectTouchMode)

  useEffect(() => {
    const t = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="tutorial-hints">
      {touch ? (
        <>
          <div>👈 left thumb — move</div>
          <div>👉 right thumb — aim (fire is automatic)</div>
          <div>⚡ DASH button — quick escape with a moment of invulnerability</div>
        </>
      ) : (
        <>
          <div>⌨️ WASD — move · 🖱️ mouse — aim (fire is automatic)</div>
          <div>⚡ SPACE or right-click — dash through danger</div>
        </>
      )}
      <div>💎 gems level you up — chain kills for combo bonuses</div>
      <button className="mini-btn" onClick={onDismiss}>
        GOT IT
      </button>
    </div>
  )
}
