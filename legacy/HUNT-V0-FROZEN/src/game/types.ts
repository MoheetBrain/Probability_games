export type PlayerId = 'player' | 'bot'

export type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export type Position = {
  row: number
  col: number
}

export type BeliefGrid = number[][]

export type DirectionBelief = Record<Direction, number>

/**
 * The visible belief grid is a position marginal. The joint distribution keeps
 * position/direction correlation so the one-step forecast remains exact.
 */
export type BeliefState = {
  grid: BeliefGrid
  direction: DirectionBelief
  joint: number[][][]
}

export type PlayerState = {
  position: Position
  energy: number
  captures: number
}

export type GhostState = {
  position: Position
  direction: Direction
}

export type ScanResult = 'warm' | 'cold'

export type Action =
  | { type: 'move'; to: Position }
  | { type: 'scan' }
  | { type: 'trap'; target: Position; stake: 1 | 2 | 3 }

export type PublicEvent = {
  id: string
  turn: number
  actor: PlayerId
  action: Action['type']
  from?: Position
  to?: Position
  target?: Position
  stake?: 1 | 2 | 3
  result?: 'hit' | 'miss'
}

export type PrivateScan = {
  turn: number
  result: ScanResult
}

export type TrapResolution = {
  actor: PlayerId
  target: Position
  stake: 1 | 2 | 3
  result: 'hit' | 'miss'
  estimatedHitProbability: number
  expectedValue: number
  energyDelta: number
  revealedGhost?: Position
}

export type GameOutcome = {
  winner: PlayerId
  reason: 'captures' | 'ruin'
}

export type GameState = {
  turn: number
  activePlayer: PlayerId
  player: PlayerState
  bot: PlayerState
  ghost: GhostState
  playerBelief: BeliefState
  botBelief: BeliefState
  publicEvents: PublicEvent[]
  playerLastScan?: PrivateScan
  lastResolution?: TrapResolution
  lastAction?: Action & { actor: PlayerId }
  outcome?: GameOutcome
  gameOver: boolean
  debug: boolean
  coachMode: boolean
}

export type GameOverrides = {
  turn?: number
  activePlayer?: PlayerId
  player?: Partial<PlayerState>
  bot?: Partial<PlayerState>
  ghost?: Partial<GhostState>
  playerBelief?: BeliefState
  botBelief?: BeliefState
  publicEvents?: PublicEvent[]
  debug?: boolean
  coachMode?: boolean
}

export type BotDecisionContext = {
  bot: PlayerState
  opponent: PlayerState
  belief: BeliefState
  publicEvents: PublicEvent[]
  turn: number
}

export type Stats = {
  gamesPlayed: number
  wins: number
  losses: number
  captures: number
  ruins: number
  averageEnergyRemaining: number
}
