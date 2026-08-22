import { INITIAL_CHIPS, MAX_EVIDENCE_PER_ROUND, MAX_STAKE, POINTS_TO_WIN } from './constants'
import { chooseBotAction, botContext } from './bot'
import { bayesianUpdate, expectedValueForState, maxStake, payoutMultiplier } from './math'
import { createRound, difficultyForRound, evidenceIndex, sampleEvidence } from './rounds'
import type { BotContext, GameState, PlayerAction, RoundOutcome } from './types'

export function createInitialGame(random: () => number = Math.random): GameState {
  return {
    mode: 'solo',
    phase: 'playing',
    chips: INITIAL_CHIPS,
    points: 0,
    roundNumber: 1,
    round: createRound(1, 1, random),
    coachMode: true,
    debug: false,
  }
}

export function createNextRound(state: GameState, random: () => number = Math.random): GameState {
  const nextNumber = state.roundNumber + 1
  return {
    ...state,
    phase: 'playing',
    roundNumber: nextNumber,
    round: createRound(nextNumber, difficultyForRound(nextNumber), random),
    lastAction: 'nextRound',
    lastOutcome: undefined,
  }
}

function roundOutcome(state: GameState, action: Extract<PlayerAction, { type: 'bet' }>): RoundOutcome {
  const multiplier = payoutMultiplier(state.round.priors[action.state])
  const correct = action.state === state.round.hiddenState
  const chipsBefore = state.chips
  const chipsAfter = chipsBefore - action.stake + (correct ? action.stake * multiplier : 0)
  const pointsBefore = state.points
  const pointsAfter = correct ? pointsBefore + action.stake * 2 : pointsBefore
  return {
    chosenState: action.state,
    hiddenState: state.round.hiddenState,
    correct,
    stake: action.stake,
    multiplier,
    posterior: [...state.round.posterior],
    expectedValue: expectedValueForState(state.round.posterior, state.round.priors, action.state, action.stake),
    chipsBefore,
    chipsAfter,
    pointsBefore,
    pointsAfter,
  }
}

export function legalAction(state: GameState, action: PlayerAction): boolean {
  if (state.phase === 'gameOver') return false
  if (action.type === 'sample') return state.phase === 'playing' && state.chips >= 1 && state.round.evidence.length < MAX_EVIDENCE_PER_ROUND
  if (action.type === 'nextRound') return state.phase === 'roundResolved'
  return state.phase === 'playing'
    && action.state >= 0
    && action.state < state.round.priors.length
    && state.round.priors[action.state] > 0
    && action.stake >= 1
    && action.stake <= MAX_STAKE
    && action.stake <= maxStake(state.chips)
}

export function applyAction(state: GameState, action: PlayerAction, random: () => number = Math.random): GameState {
  if (!legalAction(state, action)) return state
  if (action.type === 'nextRound') return createNextRound(state, random)

  if (action.type === 'sample') {
    const evidence = sampleEvidence(state.round, random)
    const index = evidenceIndex(evidence)
    const posterior = bayesianUpdate(state.round.posterior, state.round.likelihoods.map((row) => row[index]))
    return {
      ...state,
      chips: state.chips - 1,
      lastAction: 'sample',
      round: {
        ...state.round,
        evidence: [...state.round.evidence, { id: state.round.evidence.length, type: evidence }],
        posterior,
        posteriorHistory: [...state.round.posteriorHistory, posterior],
      },
      phase: state.chips - 1 <= 0 ? 'gameOver' : 'playing',
    }
  }

  const outcome = roundOutcome(state, action)
  const gameOver = outcome.chipsAfter <= 0 || outcome.pointsAfter >= POINTS_TO_WIN
  return {
    ...state,
    chips: outcome.chipsAfter,
    points: outcome.pointsAfter,
    phase: gameOver ? 'gameOver' : 'roundResolved',
    lastAction: 'bet',
    lastOutcome: outcome,
  }
}

export function contextForBot(state: GameState): BotContext {
  return botContext({
    chips: state.chips,
    points: state.points,
    priors: state.round.priors,
    likelihoods: state.round.likelihoods,
    posterior: state.round.posterior,
    evidenceCount: state.round.evidence.length,
    roundNumber: state.roundNumber,
  })
}

export function applyBotAction(state: GameState, random: () => number = Math.random): GameState {
  return applyAction(state, chooseBotAction(contextForBot(state)), random)
}
