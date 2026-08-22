import { BOARD_SIZE, DIRECTIONS } from './constants'
import { movementOptions, scanLikelihood } from './ghost'
import type { BeliefGrid, BeliefState, Direction, DirectionBelief, Position, ScanResult } from './types'

const EPSILON = 1e-12

function blankJoint(): number[][][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => Array.from({ length: DIRECTIONS.length }, () => 0)))
}

function cloneJoint(joint: number[][][]): number[][][] {
  return joint.map((row) => row.map((cell) => [...cell]))
}

function normalizeJoint(joint: number[][][]): number[][][] {
  const safe = joint.map((row) => row.map((cell) => cell.map((value) => Math.max(0, value))))
  const total = safe.flat(2).reduce((sum, value) => sum + value, 0)
  if (total <= EPSILON) return createUniformBelief().joint
  return safe.map((row) => row.map((cell) => cell.map((value) => value / total)))
}

function gridFromJoint(joint: number[][][]): BeliefGrid {
  return joint.map((row) => row.map((cell) => cell.reduce((sum, value) => sum + value, 0)))
}

function directionFromJoint(joint: number[][][]): DirectionBelief {
  return DIRECTIONS.reduce((result, direction, directionIndex) => {
    result[direction] = joint.reduce((rowTotal, row) => rowTotal + row.reduce((cellTotal, cell) => cellTotal + cell[directionIndex], 0), 0)
    return result
  }, {} as DirectionBelief)
}

export function beliefFromJoint(joint: number[][][]): BeliefState {
  const normalized = normalizeJoint(joint)
  return { joint: normalized, grid: gridFromJoint(normalized), direction: directionFromJoint(normalized) }
}

export function createUniformBelief(): BeliefState {
  const joint = blankJoint()
  const probability = 1 / (BOARD_SIZE * BOARD_SIZE * DIRECTIONS.length)
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (let direction = 0; direction < DIRECTIONS.length; direction += 1) joint[row][col][direction] = probability
    }
  }
  return beliefFromJoint(joint)
}

export function pointBelief(position: Position, direction: Direction): BeliefState {
  const joint = blankJoint()
  joint[position.row][position.col][DIRECTIONS.indexOf(direction)] = 1
  return beliefFromJoint(joint)
}

export function cloneBelief(belief: BeliefState): BeliefState {
  return beliefFromJoint(cloneJoint(belief.joint))
}

export function updateBeliefWithScan(belief: BeliefState, center: Position, result: ScanResult): BeliefState {
  const next = cloneJoint(belief.joint)
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const likelihood = scanLikelihood(center, { row, col }, result)
      for (let direction = 0; direction < DIRECTIONS.length; direction += 1) next[row][col][direction] *= likelihood
    }
  }
  return beliefFromJoint(next)
}

export function propagateBelief(belief: BeliefState): BeliefState {
  const next = blankJoint()
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      for (let directionIndex = 0; directionIndex < DIRECTIONS.length; directionIndex += 1) {
        const mass = belief.joint[row][col][directionIndex]
        if (mass <= 0) continue
        const direction = DIRECTIONS[directionIndex]
        for (const option of movementOptions({ row, col }, direction)) {
          next[option.position.row][option.position.col][DIRECTIONS.indexOf(option.direction)] += mass * option.weight
        }
      }
    }
  }
  return beliefFromJoint(next)
}

export function conditionOnMiss(belief: BeliefState, target: Position): BeliefState {
  const next = cloneJoint(belief.joint)
  for (let direction = 0; direction < DIRECTIONS.length; direction += 1) next[target.row][target.col][direction] = 0
  return beliefFromJoint(next)
}

export function nextSquareDistribution(belief: BeliefState): BeliefGrid {
  return propagateBelief(belief).grid
}

export function probabilityOfNextSquare(belief: BeliefState, target: Position): number {
  return nextSquareDistribution(belief)[target.row][target.col]
}

export function gridTotal(grid: BeliefGrid): number {
  return grid.flat().reduce((sum, value) => sum + value, 0)
}

export function normalisedEntropy(grid: BeliefGrid): number {
  const entropy = grid.flat().reduce((sum, probability) => probability > EPSILON ? sum - probability * Math.log(probability) : sum, 0)
  return entropy / Math.log(BOARD_SIZE * BOARD_SIZE)
}

export function expectedTrapValue(hitProbability: number, stake: number): number {
  return hitProbability * stake * 3 - stake
}
