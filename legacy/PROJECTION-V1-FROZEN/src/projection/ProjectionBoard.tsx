import type { CSSProperties } from 'react'
import { BOARD_SIZE, DIRECTION_META, EVIDENCE_META } from './constants'
import { chebyshevDistance, inBounds, isLegalTrapTarget, legalHunterMoves, samePosition } from './ghost'
import { sectorForCell } from './sectors'
import type { GameState, Position } from './types'

export type BoardInteraction = 'idle' | 'move' | 'trap'

function coordinate(position: Position): string { return `${String.fromCharCode(65 + position.col)}${position.row + 1}` }

export function ProjectionBoard({ game, interaction, pendingTrap, nextPosition, onCellClick }: { game: GameState; interaction: BoardInteraction; pendingTrap?: Position; nextPosition?: number[][]; onCellClick: (position: Position) => void }) {
  const playerTurn = game.activePlayer === 'player' && !game.gameOver
  const legalMoves = new Set(legalHunterMoves(game.player.position, game.mode === 'duel' ? game.bot.position : undefined).map(coordinate))
  const reveal = game.lastResolution?.revealedGhost
  return <section className={`projection-board${game.lastResolution?.result === 'hit' ? ' capture-pulse' : ''}`} aria-label="PROJECTION hidden-state board">
    <div className="board-topline"><span>PROJECTION / 7 × 7 FIELD</span><span>SECTOR BOUNDARIES ARE PUBLIC</span><span>TURN {String(game.turn).padStart(2, '0')}</span></div>
    <div className="coordinate-row"><span />{Array.from({ length: BOARD_SIZE }, (_, col) => <b key={col}>{String.fromCharCode(65 + col)}</b>)}</div>
    <div className="board-body"><div className="coordinate-col">{Array.from({ length: BOARD_SIZE }, (_, row) => <b key={row}>{row + 1}</b>)}</div><div className="projection-grid">{Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
      const row = Math.floor(index / BOARD_SIZE); const col = index % BOARD_SIZE; const position = { row, col }; const sector = sectorForCell(row, col); const key = coordinate(position)
      const isMove = interaction === 'move' && legalMoves.has(key)
      const isTrap = interaction === 'trap' && isLegalTrapTarget(game.player.position, position)
      const isPlayer = samePosition(position, game.player.position)
      const isBot = game.mode === 'duel' && samePosition(position, game.bot.position)
      const isGhost = game.debug && samePosition(position, game.ghost.position)
      const isReveal = reveal && samePosition(position, reveal)
      const nextHeat = nextPosition?.[row]?.[col] ?? 0
      const rightBoundary = col < BOARD_SIZE - 1 && sectorForCell(row, col + 1) !== sector
      const bottomBoundary = row < BOARD_SIZE - 1 && sectorForCell(row + 1, col) !== sector
      return <button key={key} className={`projection-cell sector-${sector}${rightBoundary ? ' boundary-right' : ''}${bottomBoundary ? ' boundary-bottom' : ''}${isMove ? ' legal-move' : ''}${isTrap ? ' legal-trap' : ''}${pendingTrap && samePosition(position, pendingTrap) ? ' selected-trap' : ''}${isPlayer ? ' player-cell' : ''}${isBot ? ' bot-cell' : ''}${isGhost ? ' ghost-debug' : ''}${isReveal ? ' capture-cell' : ''}`} style={{ '--next-heat': game.debug ? nextHeat : 0 } as CSSProperties} disabled={!playerTurn || (interaction === 'move' ? !isMove : interaction === 'trap' ? !isTrap : true)} onClick={() => onCellClick(position)} aria-label={`${key}, sector ${String.fromCharCode(65 + sector)}${isPlayer ? ', you' : ''}${isBot ? ', bot' : ''}${isGhost ? ', ghost debug' : ''}`}>
        {isPlayer && <span className="player-mark">△</span>}{isBot && <span className="bot-mark">▲</span>}{isGhost && <span className="ghost-mark">●</span>}{isReveal && <span className="capture-mark">✦</span>}{pendingTrap && samePosition(position, pendingTrap) && <span className="trap-mark">◇</span>}
        {game.debug && <span className="heat-label">{Math.round(nextHeat * 100)}%</span>}
      </button>
    })}</div></div>
    <div className="board-bottomline"><span>△ YOU {coordinate(game.player.position)}</span><span>{game.mode === 'duel' ? `▲ BOT ${coordinate(game.bot.position)}` : '● GHOST HIDDEN'}</span><span>{game.debug ? `${DIRECTION_META.find((direction) => direction.id === game.ghost.direction)?.id} / PREDICTIVE HEAT` : 'MOVE · SAMPLE · TRAP'}</span></div>
  </section>
}

export function tokenForIndex(index: number): typeof EVIDENCE_META[number] { return EVIDENCE_META[index] ?? EVIDENCE_META[0] }
