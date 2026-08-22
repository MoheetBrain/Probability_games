export const STATE_IDS = ['A', 'B', 'C', 'D', 'E'] as const
export type StateId = (typeof STATE_IDS)[number]

export const EVIDENCE_IDS = ['triangle', 'circle', 'square', 'diamond', 'cross'] as const
export type EvidenceId = (typeof EVIDENCE_IDS)[number]

export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type Confidence = 'low' | 'medium' | 'high'
export type GamePhase = 'playing' | 'roundResolved' | 'gameOver'
export type GameMode = 'solo' | 'duel'

export interface EvidenceToken {
  id: number
  type: EvidenceId
}

export interface RoundState {
  number: number
  difficulty: DifficultyLevel
  priors: number[]
  hiddenState: number
  likelihoods: number[][]
  reliability: number
  evidence: EvidenceToken[]
  posterior: number[]
  posteriorHistory: number[][]
}

export interface RoundOutcome {
  chosenState: number
  hiddenState: number
  correct: boolean
  stake: 1 | 2 | 3
  multiplier: number
  posterior: number[]
  expectedValue: number
  chipsBefore: number
  chipsAfter: number
  pointsBefore: number
  pointsAfter: number
}

export interface GameState {
  mode: GameMode
  phase: GamePhase
  chips: number
  points: number
  roundNumber: number
  round: RoundState
  coachMode: boolean
  debug: boolean
  lastAction?: 'sample' | 'bet' | 'nextRound'
  lastOutcome?: RoundOutcome
}

export interface BotContext {
  chips: number
  points: number
  priors: number[]
  likelihoods: number[][]
  posterior: number[]
  evidenceCount: number
  roundNumber: number
}

export interface DuelPlayerState {
  chips: number
  score: number
  evidence: EvidenceToken[]
  posterior: number[]
}

export interface DuelOutcome {
  winner: 'player' | 'bot'
  actor: 'player' | 'bot'
  hiddenState: number
  chosenState: number
  correct: boolean
  stake: 1 | 2 | 3
  multiplier: number
  posterior: number[]
}

export interface DuelGameState {
  mode: 'duel'
  phase: 'playerTurn' | 'botTurn' | 'roundResolved' | 'gameOver'
  roundNumber: number
  round: RoundState
  player: DuelPlayerState
  bot: DuelPlayerState
  lastPublicAction?: string
  outcome?: DuelOutcome
}

export type PlayerAction =
  | { type: 'sample' }
  | { type: 'bet'; state: number; stake: 1 | 2 | 3 }
  | { type: 'nextRound' }
