import { INITIAL_CHIPS, MAX_EVIDENCE_PER_ROUND } from './constants'
import { chooseBotAction } from './bot'
import { bayesianUpdate, maxStake, payoutMultiplier } from './math'
import { createRound, difficultyForRound, evidenceIndex, sampleEvidence } from './rounds'
import type { BotContext, DuelGameState, DuelOutcome, PlayerAction } from './types'

export const DUEL_POINTS_TO_WIN = 3

function freshPlayer(priors: number[]): DuelGameState['player'] {
  return { chips: INITIAL_CHIPS, score: 0, evidence: [], posterior: [...priors] }
}

export function createInitialDuel(random: () => number = Math.random): DuelGameState {
  const round = createRound(1, 1, random)
  return { mode: 'duel', phase: 'playerTurn', roundNumber: 1, round, player: freshPlayer(round.priors), bot: freshPlayer(round.priors) }
}

function playerFor(state: DuelGameState, actor: 'player' | 'bot'): DuelGameState['player'] {
  return actor === 'player' ? state.player : state.bot
}

function actorFor(state: DuelGameState): 'player' | 'bot' {
  return state.phase === 'playerTurn' ? 'player' : 'bot'
}

function winnerForBet(actor: 'player' | 'bot', correct: boolean): 'player' | 'bot' {
  return correct ? actor : actor === 'player' ? 'bot' : 'player'
}

export function contextForDuelBot(state: DuelGameState): BotContext {
  return {
    chips: state.bot.chips,
    points: state.bot.score,
    priors: [...state.round.priors],
    likelihoods: state.round.likelihoods.map((row) => [...row]),
    posterior: [...state.bot.posterior],
    evidenceCount: state.bot.evidence.length,
    roundNumber: state.roundNumber,
  }
}

export function legalDuelAction(state: DuelGameState, action: PlayerAction): boolean {
  if (state.phase !== 'playerTurn' && state.phase !== 'botTurn') return false
  const actor = actorFor(state)
  const player = playerFor(state, actor)
  if (action.type === 'nextRound') return false
  if (action.type === 'sample') return player.chips >= 1 && player.evidence.length < MAX_EVIDENCE_PER_ROUND
  if (action.type !== 'bet') return false
  return action.state >= 0 && action.state < 5 && state.round.priors[action.state] > 0 && action.stake >= 1 && action.stake <= 3 && action.stake <= maxStake(player.chips)
}

export function applyDuelAction(state: DuelGameState, action: PlayerAction, random: () => number = Math.random): DuelGameState {
  if (!legalDuelAction(state, action)) return state
  const actor = actorFor(state)
  const player = playerFor(state, actor)
  const other = actor === 'player' ? 'bot' : 'player'

  if (action.type === 'sample') {
    const evidence = sampleEvidence(state.round, random)
    const index = evidenceIndex(evidence)
    const posterior = bayesianUpdate(player.posterior, state.round.likelihoods.map((row) => row[index]))
    const updatedPlayer = { ...player, chips: player.chips - 1, evidence: [...player.evidence, { id: player.evidence.length, type: evidence }], posterior }
    const next = actor === 'player' ? { ...state, player: updatedPlayer } : { ...state, bot: updatedPlayer }
    const outOfChips = updatedPlayer.chips <= 0
    return { ...next, phase: outOfChips ? 'gameOver' : other === 'player' ? 'playerTurn' : 'botTurn', lastPublicAction: actor === 'player' ? 'YOU SAMPLED · YOUR TOKEN IS PRIVATE' : 'BOT SAMPLED · THEIR TOKEN STAYS PRIVATE' }
  }

  if (action.type !== 'bet') return state

  const correct = action.state === state.round.hiddenState
  const multiplier = payoutMultiplier(state.round.priors[action.state])
  const updatedPlayer = { ...player, chips: player.chips - action.stake + (correct ? action.stake * multiplier : 0) }
  const winner = winnerForBet(actor, correct)
  const updatedWinner = winner === actor ? { ...updatedPlayer, score: updatedPlayer.score + 1 } : playerFor(state, winner)
  const nextBase = actor === 'player' ? { ...state, player: updatedPlayer } : { ...state, bot: updatedPlayer }
  const next = winner === 'player' ? { ...nextBase, player: updatedWinner } : { ...nextBase, bot: updatedWinner }
  const outcome: DuelOutcome = { winner, actor, hiddenState: state.round.hiddenState, chosenState: action.state, correct, stake: action.stake, multiplier, posterior: [...player.posterior] }
  return { ...next, phase: winner === 'player' && next.player.score >= DUEL_POINTS_TO_WIN || winner === 'bot' && next.bot.score >= DUEL_POINTS_TO_WIN || updatedPlayer.chips <= 0 ? 'gameOver' : 'roundResolved', outcome, lastPublicAction: actor === 'player' ? `YOU BET ${String.fromCharCode(65 + action.state)} · ${correct ? 'CORRECT' : 'MISSED'}` : `BOT BET · ${correct ? 'CORRECT' : 'MISSED'}` }
}

export function applyDuelBotTurn(state: DuelGameState, random: () => number = Math.random): DuelGameState {
  if (state.phase !== 'botTurn') return state
  return applyDuelAction(state, chooseBotAction(contextForDuelBot(state)), random)
}

export function nextDuelRound(state: DuelGameState, random: () => number = Math.random): DuelGameState {
  const roundNumber = state.roundNumber + 1
  const round = createRound(roundNumber, difficultyForRound(roundNumber), random)
  return { ...state, phase: 'playerTurn', roundNumber, round, player: { ...state.player, evidence: [], posterior: [...round.priors] }, bot: { ...state.bot, evidence: [], posterior: [...round.priors] }, outcome: undefined, lastPublicAction: undefined }
}

export function duelBotHasNoHiddenState(state: DuelGameState): boolean {
  return !('hiddenState' in contextForDuelBot(state))
}
