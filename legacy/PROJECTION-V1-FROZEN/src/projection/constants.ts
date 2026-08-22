import type { DifficultyLevel, Direction, EvidenceId } from './types'

export const BOARD_SIZE = 7
export const INITIAL_CHIPS = 10
export const CAPTURES_TO_WIN = 5
export const MAX_STAKE = 3
export const MAX_EVIDENCE = 10
export const EVIDENCE_IDS = ['triangle', 'square', 'circle', 'diamond', 'star'] as const

export const DIRECTION_META: Array<{ id: Direction; row: number; col: number }> = [
  { id: 'N', row: -1, col: 0 }, { id: 'NE', row: -1, col: 1 }, { id: 'E', row: 0, col: 1 }, { id: 'SE', row: 1, col: 1 },
  { id: 'S', row: 1, col: 0 }, { id: 'SW', row: 1, col: -1 }, { id: 'W', row: 0, col: -1 }, { id: 'NW', row: -1, col: -1 },
]

export const EVIDENCE_META: Array<{ id: EvidenceId; symbol: string; name: string; className: string }> = [
  { id: 'triangle', symbol: '△', name: 'triangle', className: 'token-triangle' },
  { id: 'square', symbol: '□', name: 'square', className: 'token-square' },
  { id: 'circle', symbol: '○', name: 'circle', className: 'token-circle' },
  { id: 'diamond', symbol: '◇', name: 'diamond', className: 'token-diamond' },
  { id: 'star', symbol: '☆', name: 'star', className: 'token-star' },
]

export const LEVEL_PROFILES: Record<DifficultyLevel, {
  label: string
  activeSectors: number
  priors: number[]
  reliabilityMin: number
  reliabilityMax: number
  movement: 'still' | 'slow' | 'full'
}> = {
  1: { label: 'FIRST SIGNAL', activeSectors: 2, priors: [.5, .5, 0, 0, 0], reliabilityMin: .9, reliabilityMax: .9, movement: 'still' },
  2: { label: 'CARRY THE CLUE', activeSectors: 3, priors: [.34, .33, .33, 0, 0], reliabilityMin: .78, reliabilityMax: .82, movement: 'slow' },
  3: { label: 'PROJECT FORWARD', activeSectors: 3, priors: [.34, .33, .33, 0, 0], reliabilityMin: .68, reliabilityMax: .72, movement: 'full' },
  4: { label: 'FOUR CORNERS', activeSectors: 4, priors: [.3, .28, .22, .2, 0], reliabilityMin: .68, reliabilityMax: .72, movement: 'full' },
  5: { label: 'FULL FIELD', activeSectors: 5, priors: [.2, .2, .2, .2, .2], reliabilityMin: .68, reliabilityMax: .72, movement: 'full' },
  6: { label: 'WEAK SIGNAL', activeSectors: 5, priors: [.2, .2, .2, .2, .2], reliabilityMin: .55, reliabilityMax: .6, movement: 'full' },
  7: { label: 'CONFLICTING SIGNAL', activeSectors: 5, priors: [.2, .2, .2, .2, .2], reliabilityMin: .62, reliabilityMax: .68, movement: 'full' },
  8: { label: 'BASE RATE TRAP', activeSectors: 5, priors: [.8, .08, .05, .04, .03], reliabilityMin: .62, reliabilityMax: .7, movement: 'full' },
  9: { label: 'FULL OPPOSITION', activeSectors: 5, priors: [.6, .15, .1, .1, .05], reliabilityMin: .55, reliabilityMax: .65, movement: 'full' },
}

export const MOVE_TURN_WEIGHTS = { full: [0.2, 0.6, 0.2], slow: [0.1, 0.8, 0.1] }
