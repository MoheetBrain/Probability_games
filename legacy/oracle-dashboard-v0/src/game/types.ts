export const STATES = ['growth', 'stable', 'decline'] as const
export type HiddenState = (typeof STATES)[number]

export type Belief = Record<HiddenState, number>

export type TransitionMatrix = Record<HiddenState, Belief>

export type SignalDefinition = {
  id: string
  label: string
  detail: string
  tone: 'positive' | 'neutral' | 'negative'
  likelihoods: Belief
}

export type Observation = SignalDefinition & {
  observedAt: number
}

export type Opportunity = {
  id: string
  title: string
  subtitle: string
  multipliers: Belief
  volatility: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME'
  accent: 'cyan' | 'violet' | 'amber' | 'rose'
}

export type TurnRecord = {
  turn: number
  forecast: Belief
  actualState: HiddenState
  opportunity: Opportunity
  stake: number
  scanCost: number
  playerEv: number
  trueEv: number
  brier: number
  forecastQuality: number
  calibration: number
  updating: number
  betSizing: number
  riskControl: number
  informationUse: number
  decisionQuality: number
  netChange: number
  label: DecisionLabel
}

export type DecisionLabel = 'GOOD' | 'REASONABLE' | 'AGGRESSIVE' | 'RECKLESS' | 'BAD EV'

export type TurnResult = TurnRecord & {
  returnAmount: number
  multiplier: number
  explanation: string
  outcomeType: 'win' | 'loss' | 'wait'
}

export type GamePhase = 'forecast' | 'decision' | 'outcome'

export type GameState = {
  turn: number
  totalTurns: number
  capital: number
  reserve: number
  riskCapital: number
  reserveUnlocked: boolean
  stressTurns: number
  hiddenState: HiddenState
  transitionMatrix: TransitionMatrix
  prior: Belief
  observations: Observation[]
  posterior: Belief
  forecast: Belief
  opportunity: Opportunity
  scanCount: number
  scanCost: number
  pendingStake: number
  phase: GamePhase
  history: TurnRecord[]
  lastResult?: TurnResult
  ruined: boolean
  debug: boolean
}

export type LifetimeStats = {
  totalRuns: number
  bestCapital: number
  averageBrier: number
  forecastAccuracy: number
  calibration: number
  averageBetSize: number
  ruinCount: number
  longestSurvival: number
  oracleRating: number
  totalTurns: number
}
