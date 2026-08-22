export const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type Direction = (typeof DIRECTIONS)[number]

export const EVIDENCE_IDS = ['triangle', 'square', 'circle', 'diamond', 'star'] as const
export type EvidenceId = (typeof EVIDENCE_IDS)[number]
export const SECTOR_IDS = ['A', 'B', 'C', 'D', 'E'] as const
export type SectorId = (typeof SECTOR_IDS)[number]

export type PlayerId = 'player' | 'bot'
export type Mode = 'solo' | 'duel'
export type MovementMode = 'still' | 'slow' | 'full'
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface Position { row: number; col: number }
export interface GhostState { position: Position; direction: Direction }
export type BeliefState = number[][][]

export interface EvidenceToken {
  id: number
  type: EvidenceId
  age: number
}

export interface Scenario {
  level: DifficultyLevel
  label: string
  activeSectors: number
  priors: number[]
  likelihoods: number[][]
  reliability: number
  movement: MovementMode
}

export interface PlayerState {
  position: Position
  chips: number
  captures: number
}

export type Action =
  | { type: 'move'; to: Position }
  | { type: 'sample' }
  | { type: 'trap'; target: Position; stake: 1 | 2 | 3 }

export interface PublicEvent {
  id: string
  turn: number
  actor: PlayerId
  action: Action['type']
  from?: Position
  to?: Position
  target?: Position
  stake?: number
  result?: 'hit' | 'miss'
}

export interface TrapResolution {
  actor: PlayerId
  target: Position
  stake: 1 | 2 | 3
  result: 'hit' | 'miss'
  estimatedHitProbability: number
  expectedValue: number
  energyDelta: number
  revealedGhost?: Position
}

export interface GameState {
  mode: Mode
  activePlayer: PlayerId
  turn: number
  level: DifficultyLevel
  scenario: Scenario
  player: PlayerState
  bot: PlayerState
  ghost: GhostState
  playerBelief: BeliefState
  botBelief: BeliefState
  playerEvidence: EvidenceToken[]
  botEvidence: EvidenceToken[]
  publicEvents: PublicEvent[]
  gameOver: boolean
  outcome?: { winner: PlayerId; reason: 'captures' | 'ruin' }
  lastAction?: Action & { actor: PlayerId }
  lastResolution?: TrapResolution
  coachMode: boolean
  debug: boolean
  personality: BotPersonality
}

export type BotPersonality = 'conservative' | 'balanced' | 'aggressive'

export interface BotContext {
  bot: PlayerState
  opponent: PlayerState
  belief: BeliefState
  scenario: Scenario
  evidenceCount: number
  publicEvents: PublicEvent[]
  personality: BotPersonality
  turn: number
}

export interface GameOverrides {
  mode?: Mode
  activePlayer?: PlayerId
  player?: Partial<PlayerState>
  bot?: Partial<PlayerState>
  ghost?: Partial<GhostState>
  scenario?: Scenario
  playerBelief?: BeliefState
  botBelief?: BeliefState
}
