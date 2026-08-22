import type { DifficultyLevel, EvidenceId, StateId } from './types'

export const INITIAL_CHIPS = 10
export const POINTS_TO_WIN = 20
export const MAX_STAKE = 3
export const MAX_EVIDENCE_PER_ROUND = 8

export const STATE_META: Array<{ id: StateId; index: number }> = [
  { id: 'A', index: 0 },
  { id: 'B', index: 1 },
  { id: 'C', index: 2 },
  { id: 'D', index: 3 },
  { id: 'E', index: 4 },
]

export const EVIDENCE_META: Array<{ id: EvidenceId; symbol: string; name: string; className: string }> = [
  { id: 'triangle', symbol: '△', name: 'triangle', className: 'evidence-triangle' },
  { id: 'circle', symbol: '○', name: 'circle', className: 'evidence-circle' },
  { id: 'square', symbol: '□', name: 'square', className: 'evidence-square' },
  { id: 'diamond', symbol: '◇', name: 'diamond', className: 'evidence-diamond' },
  { id: 'cross', symbol: '✚', name: 'cross', className: 'evidence-cross' },
]

export const DIFFICULTY_PROFILES: Record<DifficultyLevel, {
  label: string
  activeStates: number
  basePriors: number[]
  reliabilityMin: number
  reliabilityMax: number
}> = {
  1: { label: 'TWO SIGNALS', activeStates: 2, basePriors: [.55, .45, 0, 0, 0], reliabilityMin: .82, reliabilityMax: .9 },
  2: { label: 'THREE SIGNALS', activeStates: 3, basePriors: [.45, .35, .2, 0, 0], reliabilityMin: .76, reliabilityMax: .88 },
  3: { label: 'EVEN FIELD', activeStates: 5, basePriors: [.3, .25, .2, .15, .1], reliabilityMin: .7, reliabilityMax: .86 },
  4: { label: 'UNEVEN FIELD', activeStates: 5, basePriors: [.4, .25, .15, .12, .08], reliabilityMin: .64, reliabilityMax: .84 },
  5: { label: 'HEAVY FAVOURITE', activeStates: 5, basePriors: [.55, .2, .12, .08, .05], reliabilityMin: .6, reliabilityMax: .8 },
  6: { label: 'RARE STATES', activeStates: 5, basePriors: [.72, .1, .06, .07, .05], reliabilityMin: .56, reliabilityMax: .78 },
  7: { label: 'CONFLICTING SIGNALS', activeStates: 5, basePriors: [.8, .08, .05, .04, .03], reliabilityMin: .55, reliabilityMax: .72 },
  8: { label: 'THE LONG ODDS', activeStates: 5, basePriors: [.62, .14, .1, .08, .06], reliabilityMin: .55, reliabilityMax: .9 },
}
