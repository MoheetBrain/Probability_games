type EnergyProps = {
  label: string
  energy: number
  captures: number
  accent: 'player' | 'bot'
}

export function CapturePips({ captures }: { captures: number }) {
  return (
    <span className="capture-pips" aria-label={`${captures} captures`}>
      {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < captures ? 'filled' : ''} />)}
    </span>
  )
}

export function Energy({ label, energy, captures, accent }: EnergyProps) {
  const visible = Math.min(18, Math.max(0, Math.floor(energy)))
  const overflow = Math.max(0, Math.floor(energy) - visible)
  return (
    <div className={`energy-readout ${accent}`}>
      <div className="energy-heading"><span>{label}</span><strong>{Math.max(0, Math.floor(energy))}</strong><small>ENERGY</small></div>
      <div className="energy-chips" aria-label={`${energy} energy`}>
        {Array.from({ length: visible }, (_, index) => <i key={index} className="energy-chip" />)}
        {overflow > 0 && <b>+{overflow}</b>}
      </div>
      <div className="capture-line"><span>CAPTURES</span><CapturePips captures={captures} /></div>
    </div>
  )
}
