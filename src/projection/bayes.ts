import { BOARD_SIZE, DIRECTION_META, EVIDENCE_META } from './constants'
import { movementOptions } from './ghost'
import { sectorForCell } from './sectors'
import type { BeliefState, Direction, MovementMode } from './types'

export function createPriorBelief(priors: number[]): BeliefState {
  const counts = Array.from({ length: 5 }, (_, sector) => {
    let count = 0
    for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) if (sectorForCell(row, col) === sector) count += 1
    return count
  })
  return Array.from({ length: BOARD_SIZE }, (_, row) => Array.from({ length: BOARD_SIZE }, (_, col) => Array.from({ length: DIRECTION_META.length }, () => (priors[sectorForCell(row, col)] ?? 0) / counts[sectorForCell(row, col)] / DIRECTION_META.length)))
}

export function cloneBelief(belief: BeliefState): BeliefState { return belief.map((row) => row.map((cell) => [...cell])) }
export function beliefTotal(belief: BeliefState): number { return belief.flat(2).reduce((sum, value) => sum + value, 0) }

export function normaliseBelief(belief: BeliefState): BeliefState {
  const total = beliefTotal(belief)
  if (total <= 0) return createPriorBelief([.2, .2, .2, .2, .2])
  return belief.map((row) => row.map((cell) => cell.map((value) => Math.max(0, value) / total)))
}

export function updateBeliefWithEvidence(belief: BeliefState, evidenceIndex: number, likelihoods: number[][]): BeliefState {
  return normaliseBelief(belief.map((row, rowIndex) => row.map((cell, colIndex) => cell.map((value) => value * (likelihoods[sectorForCell(rowIndex, colIndex)]?.[evidenceIndex] ?? 0)))))
}

export function applyEvidence(belief: BeliefState, evidenceIndex: number, likelihoods: number[][]): BeliefState { return updateBeliefWithEvidence(belief, evidenceIndex, likelihoods) }

export function propagateBelief(belief: BeliefState, movement: MovementMode): BeliefState {
  const next = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => Array(DIRECTION_META.length).fill(0))) as BeliefState
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) for (let direction = 0; direction < DIRECTION_META.length; direction += 1) {
    const probability = belief[row][col][direction]
    if (probability <= 0) continue
    const ghost = { position: { row, col }, direction: DIRECTION_META[direction].id as Direction }
    for (const option of movementOptions(ghost, movement)) next[option.state.position.row][option.state.position.col][DIRECTION_META.findIndex((item) => item.id === option.state.direction)] += probability * option.weight
  }
  return normaliseBelief(next)
}

export function positionMarginal(belief: BeliefState): number[][] { return belief.map((row) => row.map((cell) => cell.reduce((sum, value) => sum + value, 0))) }
export function sectorMarginal(belief: BeliefState): number[] {
  const result = [0, 0, 0, 0, 0]
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) result[sectorForCell(row, col)] += belief[row][col].reduce((sum, value) => sum + value, 0)
  return result
}

export function nextPositionDistribution(belief: BeliefState, movement: MovementMode): number[][] { return positionMarginal(propagateBelief(belief, movement)) }
export function probabilityOfNextPosition(belief: BeliefState, target: { row: number; col: number }, movement: MovementMode): number { return nextPositionDistribution(belief, movement)[target.row]?.[target.col] ?? 0 }
export function conditionOnMiss(belief: BeliefState, target: { row: number; col: number }): BeliefState { return normaliseBelief(belief.map((row, rowIndex) => row.map((cell, colIndex) => cell.map((value) => rowIndex === target.row && colIndex === target.col ? 0 : value)))) }
export function entropy(probabilities: number[]): number { return probabilities.reduce((sum, value) => value > 0 ? sum - value * Math.log2(value) : sum, 0) }
export function normalisedEntropy(probabilities: number[]): number { const active = probabilities.filter((value) => value > 0).length; return active <= 1 ? 0 : entropy(probabilities) / Math.log2(active) }
export function evidenceLabel(index: number): string { return EVIDENCE_META[index]?.symbol ?? '?' }
