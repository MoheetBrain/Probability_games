import type { Position } from '../game/types'
import type { BoardMode } from './Board'

type ControlsProps = {
  enabled: boolean
  mode: BoardMode
  trapTarget?: Position
  stake: 1 | 2 | 3
  energy: number
  onMode: (mode: BoardMode) => void
  onConfirmScan: () => void
  onStake: (stake: 1 | 2 | 3) => void
  onPlaceTrap: () => void
}

export function Controls({ enabled, mode, trapTarget, stake, energy, onMode, onConfirmScan, onStake, onPlaceTrap }: ControlsProps) {
  return (
    <section className="controls-shell">
      <div className="action-buttons">
        <button className={mode === 'move' ? 'selected' : ''} disabled={!enabled} onClick={() => onMode(mode === 'move' ? 'idle' : 'move')}><span className="control-glyph">✣</span><b>MOVE</b><small>FREE</small></button>
        <button className={mode === 'scan' ? 'selected' : ''} disabled={!enabled || energy < 1} onClick={() => onMode(mode === 'scan' ? 'idle' : 'scan')}><span className="control-glyph">◎</span><b>SCAN</b><small>−1 ENERGY</small></button>
        <button className={mode === 'trap' ? 'selected' : ''} disabled={!enabled || energy < 1} onClick={() => onMode(mode === 'trap' ? 'idle' : 'trap')}><span className="control-glyph">◇</span><b>TRAP</b><small>STAKE 1–3</small></button>
      </div>
      <div className="inline-action-area">
        {!enabled && <span className="action-note">{energy <= 0 ? 'RUINED' : 'BOT IS THINKING · GHOST IN MOTION'}</span>}
        {enabled && mode === 'idle' && <span className="action-note">Choose one action. The Ghost moves next.</span>}
        {enabled && mode === 'move' && <span className="action-note">Select one adjacent square.</span>}
        {enabled && mode === 'scan' && <button className="confirm-action" onClick={onConfirmScan}>CONFIRM SCAN <span>−1</span></button>}
        {enabled && mode === 'trap' && !trapTarget && <span className="action-note">Select any square within 2.</span>}
        {enabled && mode === 'trap' && trapTarget && (
          <div className="stake-control">
            <span>STAKE</span>
            <button className={stake === 1 ? 'stake-selected' : ''} disabled={energy < 1} onClick={() => onStake(1)}>●</button>
            <button className={stake === 2 ? 'stake-selected' : ''} disabled={energy < 2} onClick={() => onStake(2)}>●●</button>
            <button className={stake === 3 ? 'stake-selected' : ''} disabled={energy < 3} onClick={() => onStake(3)}>●●●</button>
            <button className="confirm-action trap-confirm" onClick={onPlaceTrap}>PLACE TRAP <span>→</span></button>
          </div>
        )}
      </div>
    </section>
  )
}
