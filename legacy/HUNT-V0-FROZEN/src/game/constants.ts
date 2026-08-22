import type { Direction, Position } from './types'

export const BOARD_SIZE = 7
export const INITIAL_ENERGY = 12
export const CAPTURES_TO_WIN = 5

export const DIRECTIONS: Direction[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export const DIRECTION_VECTORS: Record<Direction, Position> = {
  N: { row: -1, col: 0 },
  NE: { row: -1, col: 1 },
  E: { row: 0, col: 1 },
  SE: { row: 1, col: 1 },
  S: { row: 1, col: 0 },
  SW: { row: 1, col: -1 },
  W: { row: 0, col: -1 },
  NW: { row: -1, col: -1 },
}

export const PLAYER_START: Position = { row: 6, col: 3 }
export const BOT_START: Position = { row: 0, col: 3 }

export const SCAN_LIKELIHOODS = {
  inside: { warm: 0.8, cold: 0.2 },
  outside: { warm: 0.2, cold: 0.8 },
} as const

export const GHOST_MOVE_WEIGHTS = {
  continue: 0.6,
  left: 0.2,
  right: 0.2,
} as const

export const STATS_KEY = 'hunt-stats-v0'

export const DEFAULT_STATS = {
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  captures: 0,
  ruins: 0,
  averageEnergyRemaining: 0,
}

export function turnLeft(direction: Direction): Direction {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + 7) % DIRECTIONS.length]
}

export function turnRight(direction: Direction): Direction {
  return DIRECTIONS[(DIRECTIONS.indexOf(direction) + 1) % DIRECTIONS.length]
}
