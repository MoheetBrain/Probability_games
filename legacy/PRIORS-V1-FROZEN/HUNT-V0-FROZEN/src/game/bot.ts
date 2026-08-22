import { BOARD_SIZE } from './constants'
import { expectedTrapValue, nextSquareDistribution, normalisedEntropy } from './bayes'
import { isLegalTrapTarget, legalHunterMoves } from './ghost'
import type { Action, BotDecisionContext, Position } from './types'

function weightedCentre(grid: number[][]): Position {
  let rowTotal = 0
  let colTotal = 0
  let total = 0
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const weight = grid[row][col]
      rowTotal += row * weight
      colTotal += col * weight
      total += weight
    }
  }
  return total > 0 ? { row: rowTotal / total, col: colTotal / total } : { row: 3, col: 3 }
}

function distanceToCentre(position: Position, centre: Position): number {
  return Math.abs(position.row - centre.row) + Math.abs(position.col - centre.col)
}

function bestTrap(context: BotDecisionContext, nextGrid: number[][]): { target: Position; probability: number } | undefined {
  const candidates: Array<{ target: Position; probability: number }> = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const target = { row, col }
      if (isLegalTrapTarget(context.bot.position, target)) candidates.push({ target, probability: nextGrid[row][col] })
    }
  }
  return candidates.sort((a, b) => b.probability - a.probability)[0]
}

function stakeFor(energy: number, probability: number): 1 | 2 | 3 | undefined {
  if (energy >= 3 && probability >= 0.7) return 3
  if (energy >= 2 && probability >= 0.5) return 2
  if (energy >= 1 && probability >= 0.34) return 1
  return undefined
}

function moveTowardBelief(context: BotDecisionContext): Action {
  const centre = weightedCentre(context.belief.grid)
  const moves = legalHunterMoves(context.bot.position, context.opponent.position)
  const best = moves.sort((a, b) => distanceToCentre(a, centre) - distanceToCentre(b, centre))[0]
  return { type: 'move', to: best ?? context.bot.position }
}

/**
 * Fair V0 bot: this context contains the bot's private filter and public
 * events, but deliberately does not contain GameState or the true ghost.
 */
export function chooseBotAction(context: BotDecisionContext): Action {
  const entropy = normalisedEntropy(context.belief.grid)
  const nextGrid = nextSquareDistribution(context.belief)
  const trap = bestTrap(context, nextGrid)
  const stake = trap ? stakeFor(context.bot.energy, trap.probability) : undefined

  if (stake !== undefined && trap && expectedTrapValue(trap.probability, stake) > 0) {
    return { type: 'trap', target: trap.target, stake }
  }

  if (context.bot.energy > 1 && entropy >= 0.78) return { type: 'scan' }

  return moveTowardBelief(context)
}
