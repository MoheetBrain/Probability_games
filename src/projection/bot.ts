import { BOARD_SIZE, MAX_EVIDENCE, MAX_STAKE } from './constants'
import { normalisedEntropy, nextPositionDistribution, positionMarginal } from './bayes'
import { chebyshevDistance, isLegalTrapTarget, legalHunterMoves } from './ghost'
import type { Action, BotContext, BotPersonality, Position } from './types'

const PERSONALITIES: Record<BotPersonality, { sampleEntropy: number; trapThreshold: number; highStake: number; name: string }> = {
  conservative: { sampleEntropy: .58, trapThreshold: .52, highStake: .82, name: 'CONSERVATIVE' },
  balanced: { sampleEntropy: .46, trapThreshold: .39, highStake: .72, name: 'BALANCED' },
  aggressive: { sampleEntropy: .32, trapThreshold: .29, highStake: .62, name: 'AGGRESSIVE' },
}

export function botPersonalityName(personality: BotPersonality): string { return PERSONALITIES[personality].name }

function weightedCentre(grid: number[][]): Position {
  let rowTotal = 0; let colTotal = 0; let total = 0
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) { rowTotal += row * grid[row][col]; colTotal += col * grid[row][col]; total += grid[row][col] }
  return total > 0 ? { row: rowTotal / total, col: colTotal / total } : { row: 3, col: 3 }
}

function bestTrap(context: BotContext, prediction: number[][]): { target: Position; probability: number } | undefined {
  const candidates: Array<{ target: Position; probability: number }> = []
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) {
    const target = { row, col }
    if (isLegalTrapTarget(context.bot.position, target)) candidates.push({ target, probability: prediction[row][col] })
  }
  return candidates.sort((a, b) => b.probability - a.probability)[0]
}

function moveToward(context: BotContext, prediction: number[][]): Action {
  const centre = weightedCentre(prediction)
  const moves = legalHunterMoves(context.bot.position, context.opponent.position)
  const target = moves.sort((a, b) => Math.hypot(a.row - centre.row, a.col - centre.col) - Math.hypot(b.row - centre.row, b.col - centre.col))[0] ?? context.bot.position
  return { type: 'move', to: target }
}

export function chooseBotAction(context: BotContext): Action {
  const profile = PERSONALITIES[context.personality]
  const prediction = nextPositionDistribution(context.belief, context.scenario.movement)
  const trap = bestTrap(context, prediction)
  const entropy = normalisedEntropy(positionMarginal(context.belief).flat())
  if (trap && trap.probability >= profile.trapThreshold && context.bot.chips >= 1) {
    const stake = trap.probability >= profile.highStake && context.bot.chips >= 3 ? 3 : trap.probability >= profile.trapThreshold + .15 && context.bot.chips >= 2 ? 2 : 1
    return { type: 'trap', target: trap.target, stake: Math.min(MAX_STAKE, stake) as 1 | 2 | 3 }
  }
  if (context.bot.chips > 1 && context.evidenceCount < MAX_EVIDENCE && entropy >= profile.sampleEntropy) return { type: 'sample' }
  return moveToward(context, prediction)
}

export function botHasNoGhost(context: BotContext): boolean { return !('ghost' in context) && !('hiddenState' in context) }
