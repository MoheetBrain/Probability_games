import { BOARD_SIZE } from '../game/constants'
import { chebyshevDistance, inBounds, isLegalTrapTarget, legalHunterMoves, samePosition, scanRegionContains } from '../game/ghost'
import type { Action, BeliefGrid, GameState, Position } from '../game/types'

export type BoardMode = 'idle' | 'move' | 'scan' | 'trap'

type BoardProps = {
  game: GameState
  mode: BoardMode
  pendingTrap?: Position
  captureReveal?: Position
  playerBelief?: BeliefGrid
  botBelief?: BeliefGrid
  onCellClick: (position: Position) => void
}

function coordinate(position: Position): string {
  return `${String.fromCharCode(65 + position.col)}${position.row + 1}`
}

export function Board({ game, mode, pendingTrap, captureReveal, playerBelief, botBelief, onCellClick }: BoardProps) {
  const playerMoves = new Set(legalHunterMoves(game.player.position, game.bot.position).map(coordinate))
  const cells: Position[] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => ({ row: Math.floor(index / BOARD_SIZE), col: index % BOARD_SIZE }))
  const ghostVisible = game.debug

  return (
    <section className={`board-frame ${game.lastResolution?.result === 'hit' ? 'hit-state' : ''}`} aria-label="HUNT board">
      <div className="board-topline"><span>FIELD 07 × 07</span><span className="board-rule">THE GHOST MOVES AFTER EVERY ACTION</span><span>NO MAP / NO CERTAINTY</span></div>
      <div className="board-coordinate-row"><span className="coordinate-corner" />{Array.from({ length: BOARD_SIZE }, (_, index) => <span key={index}>{String.fromCharCode(65 + index)}</span>)}</div>
      <div className="board-body">
        <div className="board-coordinate-column">{Array.from({ length: BOARD_SIZE }, (_, index) => <span key={index}>{index + 1}</span>)}</div>
        <div className="board-grid">
          {cells.map((position) => {
            const key = coordinate(position)
            const isPlayer = samePosition(position, game.player.position)
            const isBot = samePosition(position, game.bot.position)
            const isGhost = ghostVisible && samePosition(position, game.ghost.position)
            const isReveal = captureReveal ? samePosition(position, captureReveal) : false
            const isScanCell = mode === 'scan' && scanRegionContains(game.player.position, position)
            const isMoveCell = mode === 'move' && playerMoves.has(key)
            const isTrapCell = mode === 'trap' && isLegalTrapTarget(game.player.position, position)
            const isSelected = pendingTrap ? samePosition(position, pendingTrap) : false
            const playerHeat = playerBelief?.[position.row]?.[position.col] ?? 0
            const botHeat = botBelief?.[position.row]?.[position.col] ?? 0
            const clickable = !game.gameOver && game.activePlayer === 'player' && (isMoveCell || isScanCell || isTrapCell)
            const cellClass = [
              'board-cell',
              isPlayer ? 'player-cell' : '',
              isBot ? 'bot-cell' : '',
              isGhost ? 'ghost-cell' : '',
              isReveal ? 'reveal-cell' : '',
              isScanCell ? 'scan-cell' : '',
              isMoveCell ? 'move-cell' : '',
              isTrapCell ? 'trap-cell' : '',
              isSelected ? 'selected-cell' : '',
            ].filter(Boolean).join(' ')
            return (
              <button
                className={cellClass}
                key={key}
                disabled={!clickable}
                onClick={() => onCellClick(position)}
                aria-label={`${key}${isPlayer ? ', you' : ''}${isBot ? ', bot' : ''}${isGhost ? ', ghost debug' : ''}`}
                style={{ '--player-heat': game.debug ? playerHeat : 0, '--bot-heat': game.debug ? botHeat : 0 } as React.CSSProperties}
              >
                {isReveal && <span className="capture-star">✦</span>}
                {isGhost && <span className="ghost-mark">●</span>}
                {isPlayer && <span className="hunter-mark player-hunter">△</span>}
                {isBot && <span className="hunter-mark bot-hunter">▲</span>}
                {isSelected && <span className="trap-mark">◇</span>}
                {game.debug && <span className="debug-cell-label">{Math.round(playerHeat * 100)}</span>}
              </button>
            )
          })}
        </div>
      </div>
      <div className="board-bottomline"><span>△ YOU</span><span>▲ BOT</span><span>◇ TRAP</span>{game.debug && <span>HEAT: PLAYER / BOT BORDER</span>}</div>
    </section>
  )
}

export function legalTrapCells(position: Position): Position[] {
  const result: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const target = { row, col }
      if (inBounds(target) && chebyshevDistance(position, target) <= 2) result.push(target)
    }
  }
  return result
}

export function actionLabel(action: GameState['lastAction']): string {
  if (!action) return 'THE HUNT BEGINS'
  const actor = action.actor === 'player' ? 'YOU' : 'BOT'
  if (action.type === 'move') return `${actor} MOVED TO ${coordinate(action.to)}`
  if (action.type === 'scan') return `${actor} SCANNED`
  return `${actor} TRAPPED ${coordinate(action.target)} · STAKE ${action.stake}`
}

export function isActionTarget(action: Action | undefined, position: Position): boolean {
  if (!action) return false
  if (action.type === 'move') return samePosition(action.to, position)
  if (action.type === 'trap') return samePosition(action.target, position)
  return false
}
