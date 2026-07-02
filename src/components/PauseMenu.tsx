export default function PauseMenu({
  muted,
  onResume,
  onToggleMute,
  onQuit,
}: {
  muted: boolean
  onResume: () => void
  onToggleMute: () => void
  onQuit: () => void
}) {
  return (
    <div className="overlay">
      <h2 className="overlay-title glow-text">PAUSED</h2>
      <div className="overlay-btns">
        <button className="btn primary" onClick={onResume}>
          RESUME
        </button>
        <button className="btn" onClick={onToggleMute}>
          {muted ? '🔇 UNMUTE' : '🔊 MUTE'}
        </button>
        <button className="btn danger" onClick={onQuit}>
          ABANDON RUN
        </button>
      </div>
    </div>
  )
}
