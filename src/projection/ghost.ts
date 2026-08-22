import { BOARD_SIZE, DIRECTION_META, MOVE_TURN_WEIGHTS } from './constants'
import { SECTOR_CELLS, sectorForCell } from './sectors'
import type { Direction, GhostState, MovementMode, Position, Scenario } from './types'

export function inBounds(position: Position): boolean { return position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE }
export function samePosition(a: Position, b: Position): boolean { return a.row === b.row && a.col === b.col }
export function directionIndex(direction: Direction): number { return DIRECTION_META.findIndex((item) => item.id === direction) }

export function movementOptions(ghost: GhostState, movement: MovementMode = 'full'): Array<{ state: GhostState; weight: number }> {
  if (movement === 'still') return [{ state: { position: { ...ghost.position }, direction: ghost.direction }, weight: 1 }]
  const turnWeights = MOVE_TURN_WEIGHTS[movement]
  const current = directionIndex(ghost.direction)
  const candidateDirections = [(current + 7) % 8, current, (current + 1) % 8]
  const legal = candidateDirections.map((direction, index) => {
    const vector = DIRECTION_META[direction]
    const position = { row: ghost.position.row + vector.row, col: ghost.position.col + vector.col }
    return inBounds(position) ? { state: { position, direction: vector.id }, weight: turnWeights[index] } : undefined
  }).filter((option): option is { state: GhostState; weight: number } => option !== undefined)
  if (legal.length > 0) {
    const total = legal.reduce((sum, option) => sum + option.weight, 0)
    return legal.map((option) => ({ ...option, weight: option.weight / total }))
  }
  const fallback = DIRECTION_META.map((vector) => {
    const position = { row: ghost.position.row + vector.row, col: ghost.position.col + vector.col }
    return inBounds(position) ? { state: { position, direction: vector.id }, weight: 1 } : undefined
  }).filter((option): option is { state: GhostState; weight: number } => option !== undefined)
  const weight = 1 / fallback.length
  return fallback.map((option) => ({ ...option, weight }))
}

export function moveGhost(ghost: GhostState, movement: MovementMode, random: () => number = Math.random): GhostState {
  const options = movementOptions(ghost, movement)
  let cursor = Math.min(.999999999, Math.max(0, random()))
  for (const option of options) {
    cursor -= option.weight
    if (cursor <= 0) return option.state
  }
  return options[options.length - 1].state
}

export function weightedChoice(weights: number[], random: () => number = Math.random): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return 0
  let cursor = Math.min(.999999999, Math.max(0, random())) * total
  for (let index = 0; index < weights.length; index += 1) { cursor -= Math.max(0, weights[index]); if (cursor <= 0) return index }
  return weights.length - 1
}

export function randomGhost(scenario: Scenario, random: () => number = Math.random): GhostState {
  const sector = weightedChoice(scenario.priors, random)
  const cells = SECTOR_CELLS[sector]
  const position = cells[Math.floor(Math.min(.999999999, Math.max(0, random())) * cells.length)]
  const direction = DIRECTION_META[Math.floor(Math.min(.999999999, Math.max(0, random())) * DIRECTION_META.length)].id
  return { position: { ...position }, direction }
}

export function sampleEvidence(ghost: GhostState, scenario: Scenario, random: () => number = Math.random): number {
  return weightedChoice(scenario.likelihoods[sectorForCell(ghost.position.row, ghost.position.col)], random)
}

export function legalHunterMoves(position: Position, opponent?: Position): Position[] {
  const moves: Position[] = []
  for (let rowDelta = -1; rowDelta <= 1; rowDelta += 1) for (let colDelta = -1; colDelta <= 1; colDelta += 1) {
    if (rowDelta === 0 && colDelta === 0) continue
    const target = { row: position.row + rowDelta, col: position.col + colDelta }
    if (inBounds(target) && (!opponent || !samePosition(target, opponent))) moves.push(target)
  }
  return moves
}

export function chebyshevDistance(a: Position, b: Position): number { return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col)) }
export function isLegalTrapTarget(position: Position, target: Position): boolean { return inBounds(target) && chebyshevDistance(position, target) <= 2 }
