import type { EvolutionDef, UpgradeChoice, UpgradeDef } from '../game/types'

export default function UpgradeCards({
  choices,
  onPick,
}: {
  choices: UpgradeChoice[]
  onPick: (def: UpgradeDef | EvolutionDef) => void
}) {
  return (
    <div className="overlay">
      <h2 className="overlay-title glow-text">LEVEL UP</h2>
      <p className="overlay-sub">choose an upgrade</p>
      <div className="cards">
        {choices.map((c) => (
          <button
            key={c.def.id}
            className={c.isEvolution ? 'card evolution' : 'card'}
            style={{ ['--card-color' as string]: c.def.color }}
            onClick={() => onPick(c.def)}
          >
            <span className="card-icon">{c.def.icon}</span>
            <span className="card-name">{c.def.name}</span>
            <span className="card-level">
              {c.isEvolution ? 'EVOLUTION' : c.nextLevel > 1 ? `LV ${c.nextLevel}` : 'NEW'}
            </span>
            <span className="card-desc">{c.def.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
