import { BOARD_SIZE, DIRECTIONS, DIRECTION_VECTORS, GHOST_MOVE_WEIGHTS, SCAN_LIKELIHOODS, turnLeft, turnRight } from './constants'
import type { Direction, GhostState, Position, ScanResult } from './types'

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`
}

export function samePosition(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col
}

export function inBounds(position: Position): boolean {
  return position.row >= 0 && position.row < BOARD_SIZE && position.col >= 0 && position.col < BOARD_SIZE
}

export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col))
}

export function isLegalMove(from: Position, to: Position, occupied: Position): boolean {
  return inBounds(to) && !samePosition(to, occupied) && chebyshevDistance(from, to) === 1
}

export function legalHunterMoves(from: Position, occupied: Position): Position[] {
  const result: Position[] = []
  for (let row = from.row - 1; row <= from.row + 1; row += 1) {
    for (let col = from.col - 1; col <= from.col + 1; col += 1) {
      const target = { row, col }
      if (isLegalMove(from, target, occupied)) result.push(target)
    }
  }
  return result
}

export function isLegalTrapTarget(hunter: Position, target: Position): boolean {
  return inBounds(target) && chebyshevDistance(hunter, target) <= 2
}

export function scanRegionContains(center: Position, target: Position): boolean {
  return Math.abs(center.row - target.row) <= 1 && Math.abs(center.col - target.col) <= 1
}

export function scanRegion(center: Position): Position[] {
  const result: Position[] = []
  for (let row = center.row - 1; row <= center.row + 1; row += 1) {
    for (let col = center.col - 1; col <= center.col + 1; col += 1) {
      const cell = { row, col }
      if (inBounds(cell)) result.push(cell)
    }
  }
  return result
}

export function positionAfterDirection(position: Position, direction: Direction): Position {
  const vector = DIRECTION_VECTORS[direction]
  return { row: position.row + vector.row, col: position.col + vector.col }
}

export type MovementOption = {
  direction: Direction
  position: Position
  weight: number
}

/**
 * Returns the public 60/20/20 movement law after edge renormalisation. If all
 * three momentum options point off-board at a corner, use legal neighbours
 * equally; this keeps the ghost moving without teleporting or stalling.
 */
export function movementOptions(position: Position, direction: Direction): MovementOption[] {
  const raw = [
    { direction, weight: GHOST_MOVE_WEIGHTS.continue },
    { direction: turnLeft(direction), weight: GHOST_MOVE_WEIGHTS.left },
    { direction: turnRight(direction), weight: GHOST_MOVE_WEIGHTS.right },
  ]
  const legal = raw
    .map((option) => ({ ...option, position: positionAfterDirection(position, option.direction) }))
    .filter((option) => inBounds(option.position))
  if (legal.length > 0) {
    const total = legal.reduce((sum, option) => sum + option.weight, 0)
    return legal.map((option) => ({ ...option, weight: option.weight / total }))
  }

  const fallback = DIRECTIONS
    .map((candidate) => ({ direction: candidate, position: positionAfterDirection(position, candidate), weight: 1 }))
    .filter((option) => inBounds(option.position))
  const total = fallback.reduce((sum, option) => sum + option.weight, 0)
  return fallback.map((option) => ({ ...option, weight: option.weight / total }))
}

export function sampleWeighted<T>(items: Array<{ item: T; weight: number }>, random: () => number): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let cursor = random() * total
  for (const item of items) {
    cursor -= item.weight
    if (cursor <= 0) return item.item
  }
  return items[items.length - 1].item
}

export function moveGhost(ghost: GhostState, random: () => number): GhostState {
  const option = sampleWeighted(movementOptions(ghost.position, ghost.direction).map((item) => ({ item, weight: item.weight })), random)
  return { position: { ...option.position }, direction: option.direction }
}

export function sampleScan(ghostPosition: Position, hunterPosition: Position, random: () => number): ScanResult {
  const inside = scanRegionContains(hunterPosition, ghostPosition)
  const warmChance = inside ? SCAN_LIKELIHOODS.inside.warm : SCAN_LIKELIHOODS.outside.warm
  return random() < warmChance ? 'warm' : 'cold'
}

export function scanLikelihood(center: Position, cell: Position, result: ScanResult): number {
  const inside = scanRegionContains(center, cell)
  return inside ? SCAN_LIKELIHOODS.inside[result] : SCAN_LIKELIHOODS.outside[result]
}

export function randomPosition(random: () => number, blocked: Position[] = []): Position {
  const available: Position[] = []
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const position = { row, col }
      if (!blocked.some((item) => samePosition(item, position))) available.push(position)
    }
  }
  return { ...available[Math.min(available.length - 1, Math.floor(random() * available.length))] }
}

export function randomGhost(random: () => number, blocked: Position[] = []): GhostState {
  return { position: randomPosition(random, blocked), direction: DIRECTIONS[Math.floor(random() * DIRECTIONS.length)] }
}
