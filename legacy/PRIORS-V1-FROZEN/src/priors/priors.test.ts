import { describe, expect, it } from 'vitest'
import { EVIDENCE_META, POINTS_TO_WIN } from './constants'
import { applyAction, contextForBot, createInitialGame } from './engine'
import { applyDuelAction, applyDuelBotTurn, contextForDuelBot, createInitialDuel, duelBotHasNoHiddenState, nextDuelRound } from './duel'
import { bayesianUpdate, expectedValue, payoutMultiplier } from './math'
import { createRound, sampleEvidence } from './rounds'
import type { GameState } from './types'

const seeded = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function total(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0)
}

function validGame(state: GameState) {
  expect(Number.isFinite(state.chips)).toBe(true)
  expect(Number.isFinite(state.points)).toBe(true)
  expect(state.chips).toBeGreaterThanOrEqual(0)
  expect(state.points).toBeGreaterThanOrEqual(0)
  expect(total(state.round.priors)).toBeCloseTo(1, 10)
  expect(total(state.round.posterior)).toBeCloseTo(1, 10)
  expect(state.round.posterior.every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
  expect(state.round.likelihoods.every((row) => Math.abs(total(row) - 1) < 1e-10)).toBe(true)
}

describe('PRIORS Bayesian engine', () => {
  it('normalises priors and applies the Bayes ratio', () => {
    const posterior = bayesianUpdate([.5, .5], [.8, .2])
    expect(total(posterior)).toBeCloseTo(1, 10)
    expect(posterior[0] / posterior[1]).toBeCloseTo(4, 10)
  })

  it('updates sequential evidence from the previous posterior', () => {
    const first = bayesianUpdate([.6, .4], [.75, .25])
    const second = bayesianUpdate(first, [.75, .25])
    expect(second[0]).toBeCloseTo(.9310344827586208, 10)
    expect(second[1]).toBeCloseTo(.06896551724137931, 10)
  })

  it('generates rows that conserve probability and samples hidden states by priors', () => {
    const round = createRound(1, 3, seeded(4))
    expect(total(round.priors)).toBeCloseTo(1, 10)
    expect(round.likelihoods.every((row) => Math.abs(total(row) - 1) < 1e-10)).toBe(true)
    const counts = [0, 0, 0, 0, 0]
    for (let index = 0; index < 100_000; index += 1) counts[createRound(index + 1, 3, seeded(index + 1000)).hiddenState] += 1
    expect(counts[0] / 100_000).toBeCloseTo(.3, 2)
    expect(counts[4] / 100_000).toBeCloseTo(.1, 2)
  })

  it('generates evidence with empirical frequencies near the likelihood row', () => {
    const round = createRound(7, 5, seeded(8))
    const counts = [0, 0, 0, 0, 0]
    const random = seeded(9)
    for (let index = 0; index < 100_000; index += 1) {
      const evidence = sampleEvidence(round, random)
      counts[EVIDENCE_META.findIndex((item) => item.id === evidence)] += 1
    }
    expect(total(counts)).toBe(100_000)
    round.likelihoods[round.hiddenState].forEach((probability, evidence) => expect(counts[evidence] / 100_000).toBeCloseTo(probability, 2))
  })

  it('derives compressed odds from the base rate', () => {
    expect(payoutMultiplier(.5)).toBe(2)
    expect(payoutMultiplier(.25)).toBe(3)
    expect(payoutMultiplier(.1)).toBe(6)
    expect(payoutMultiplier(.05)).toBe(10)
    expect(expectedValue(.6, 2, 3)).toBeCloseTo(1.6, 10)
  })
})

describe('PRIORS round engine', () => {
  it('charges samples, records posterior history, and keeps the hidden state private to bot context', () => {
    const state = createInitialGame(seeded(10))
    const next = applyAction(state, { type: 'sample' }, seeded(11))
    expect(next.chips).toBe(9)
    expect(next.round.evidence).toHaveLength(1)
    expect(next.round.posteriorHistory).toHaveLength(2)
    expect(contextForBot(next)).not.toHaveProperty('hiddenState')
  })

  it('resolves correct and incorrect bets with points, chips, and coach posterior', () => {
    const state = createInitialGame(seeded(12))
    const prepared = { ...state, round: { ...state.round, hiddenState: 0, posterior: [.7, .2, .1, 0, 0] } }
    const correct = applyAction(prepared, { type: 'bet', state: 0, stake: 2 }, seeded(13))
    expect(correct.lastOutcome?.correct).toBe(true)
    expect(correct.lastOutcome?.posterior[0]).toBe(.7)
    expect(correct.points).toBe(4)
    expect(correct.chips).toBe(12)

    const wrong = applyAction(prepared, { type: 'bet', state: 1, stake: 2 }, seeded(13))
    expect(wrong.lastOutcome?.correct).toBe(false)
    expect(wrong.points).toBe(0)
    expect(wrong.chips).toBe(8)
  })

  it('loses when chips reach zero and wins at the point target', () => {
    const state = createInitialGame(seeded(14))
    const ruined = applyAction({ ...state, chips: 1 }, { type: 'bet', state: state.round.hiddenState === 0 ? 1 : 0, stake: 1 }, seeded(15))
    expect(ruined.phase).toBe('gameOver')
    expect(ruined.chips).toBe(0)

    const winning = applyAction({ ...state, points: POINTS_TO_WIN - 2, round: { ...state.round, hiddenState: 0 } }, { type: 'bet', state: 0, stake: 1 }, seeded(16))
    expect(winning.phase).toBe('gameOver')
    expect(winning.points).toBe(POINTS_TO_WIN)
  })

  it('runs 100,000 generated rounds without invalid numeric state', () => {
    for (let index = 0; index < 100_000; index += 1) {
      let state = createInitialGame(seeded(index + 100))
      for (let sample = 0; sample < 3 && state.phase === 'playing'; sample += 1) state = applyAction(state, { type: 'sample' }, seeded(index * 7 + sample + 200))
      if (state.phase === 'playing') {
        const chosen = state.round.priors.findIndex((prior) => prior > 0)
        state = applyAction(state, { type: 'bet', state: chosen, stake: 1 }, seeded(index + 400))
      }
      validGame(state)
    }
  }, 30_000)
})

describe('PRIORS optional duel', () => {
  it('gives both sides the same priors but separate evidence and no hidden state in bot context', () => {
    const duel = createInitialDuel(seeded(20))
    const afterPlayer = applyDuelAction(duel, { type: 'sample' }, seeded(21))
    expect(afterPlayer.phase).toBe('botTurn')
    expect(afterPlayer.player.evidence).toHaveLength(1)
    expect(afterPlayer.bot.evidence).toHaveLength(0)
    expect(afterPlayer.round.priors).toEqual(duel.round.priors)
    expect(contextForDuelBot(afterPlayer)).not.toHaveProperty('hiddenState')
    expect(duelBotHasNoHiddenState(afterPlayer)).toBe(true)
    const afterBot = applyDuelBotTurn(afterPlayer, seeded(22))
    expect(['playerTurn', 'roundResolved', 'gameOver']).toContain(afterBot.phase)
  })

  it('awards a duel round to the correct bettor and advances without resetting score', () => {
    const duel = createInitialDuel(seeded(23))
    const prepared = { ...duel, round: { ...duel.round, hiddenState: 0 }, player: { ...duel.player, posterior: [.8, .2, 0, 0, 0] } }
    const resolved = applyDuelAction(prepared, { type: 'bet', state: 0, stake: 1 }, seeded(24))
    expect(resolved.outcome?.winner).toBe('player')
    expect(resolved.player.score).toBe(1)
    const next = nextDuelRound(resolved, seeded(25))
    expect(next.phase).toBe('playerTurn')
    expect(next.player.score).toBe(1)
    expect(next.player.evidence).toHaveLength(0)
  })
})
