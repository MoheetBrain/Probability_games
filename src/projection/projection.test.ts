import { describe, expect, it } from 'vitest'
import { CAPTURES_TO_WIN, DIRECTION_META, EVIDENCE_META } from './constants'
import { applyAction, botContext, createInitialGame, legalActions, simulateBotMatch } from './engine'
import { applyEvidence, beliefTotal, createPriorBelief, nextPositionDistribution, positionMarginal, probabilityOfNextPosition, propagateBelief, sectorMarginal } from './bayes'
import { botHasNoGhost } from './bot'
import { movementOptions, randomGhost, sampleEvidence } from './ghost'
import { createScenario } from './scenario'
import { SECTOR_CELLS, sectorForCell } from './sectors'
import type { BeliefState, GhostState } from './types'

const seeded = (seed: number) => {
  let value = seed >>> 0
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296 }
}

function pointBelief(row: number, col: number, direction: number): BeliefState {
  const belief = Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => Array(8).fill(0))) as BeliefState
  belief[row][col][direction] = 1
  return belief
}

function sum(values: number[]): number { return values.reduce((total, value) => total + value, 0) }

describe('PROJECTION sectors and Bayesian filter', () => {
  it('assigns every board cell to exactly one explicit sector', () => {
    let assigned = 0
    for (let row = 0; row < 7; row += 1) for (let col = 0; col < 7; col += 1) { const sector = sectorForCell(row, col); expect(sector).toBeGreaterThanOrEqual(0); expect(sector).toBeLessThan(5); assigned += 1 }
    expect(assigned).toBe(49)
    expect(SECTOR_CELLS.reduce((total, cells) => total + cells.length, 0)).toBe(49)
    expect(SECTOR_CELLS.every((cells, sector) => cells.every((cell) => sectorForCell(cell.row, cell.col) === sector))).toBe(true)
    expect(SECTOR_CELLS.map((cells) => cells.length)).toEqual([10, 10, 9, 10, 10])
  })

  it('normalises priors, likelihood rows, and hidden-state mass', () => {
    const scenario = createScenario(5, seeded(1))
    expect(sum(scenario.priors)).toBeCloseTo(1, 10)
    expect(scenario.likelihoods.every((row) => Math.abs(sum(row) - 1) < 1e-10)).toBe(true)
    expect(beliefTotal(createPriorBelief(scenario.priors))).toBeCloseTo(1, 10)
  })

  it('applies hand-calculated Bayesian and sequential updates', () => {
    const likelihoods = Array.from({ length: 5 }, (_, sector) => sector === 0 ? [.8, .2, 0, 0, 0] : sector === 1 ? [.2, .8, 0, 0, 0] : [.2, .2, .2, .2, .2])
    const prior = createPriorBelief([.5, .5, 0, 0, 0])
    const once = applyEvidence(prior, 0, likelihoods)
    expect(sectorMarginal(once)[0]).toBeCloseTo(.8, 10)
    expect(sectorMarginal(once)[1]).toBeCloseTo(.2, 10)
    const twice = applyEvidence(once, 0, likelihoods)
    expect(sectorMarginal(twice)[0]).toBeCloseTo(.9411764705, 8)
    expect(sum(sectorMarginal(twice))).toBeCloseTo(1, 10)
  })

  it('conserves Markov transition mass and renormalises boundary options', () => {
    const corner: GhostState = { position: { row: 0, col: 0 }, direction: 'W' }
    const options = movementOptions(corner, 'full')
    expect(options.length).toBeGreaterThan(0)
    expect(options.every((option) => option.state.position.row >= 0 && option.state.position.col >= 0)).toBe(true)
    expect(sum(options.map((option) => option.weight))).toBeCloseTo(1, 10)
    const next = propagateBelief(pointBelief(3, 3, 2), 'full')
    expect(beliefTotal(next)).toBeCloseTo(1, 10)
    expect(probabilityOfNextPosition(pointBelief(3, 3, 2), { row: 3, col: 4 }, 'full')).toBeCloseTo(.6, 10)
    expect(probabilityOfNextPosition(pointBelief(3, 3, 2), { row: 2, col: 4 }, 'full')).toBeCloseTo(.2, 10)
  })
})

describe('PROJECTION sampling and engine rules', () => {
  it('samples sectors according to priors and tokens according to likelihoods', () => {
    const scenario = createScenario(5, seeded(2))
    const sectorCounts = [0, 0, 0, 0, 0]
    for (let index = 0; index < 100_000; index += 1) { const ghost = randomGhost(scenario, seeded(index + 3)); sectorCounts[sectorForCell(ghost.position.row, ghost.position.col)] += 1 }
    scenario.priors.forEach((prior, sector) => expect(sectorCounts[sector] / 100_000).toBeCloseTo(prior, 2))
    const ghost = { position: { ...SECTOR_CELLS[0][0] }, direction: DIRECTION_META[2].id }
    const tokenCounts = [0, 0, 0, 0, 0]
    const random = seeded(8)
    for (let index = 0; index < 100_000; index += 1) tokenCounts[sampleEvidence(ghost, scenario, random)] += 1
    scenario.likelihoods[0].forEach((probability, token) => expect(tokenCounts[token] / 100_000).toBeCloseTo(probability, 2))
    expect(EVIDENCE_META).toHaveLength(5)
  })

  it('resolves traps against the post-movement square with exact EV', () => {
    const scenario = createScenario(1, seeded(10))
    const state = createInitialGame(seeded(11), { scenario, player: { position: { row: 1, col: 1 } }, ghost: { position: { row: 0, col: 0 }, direction: 'N' }, playerBelief: pointBelief(0, 0, 0) })
    const hit = applyAction(state, { type: 'trap', target: { row: 0, col: 0 }, stake: 2 }, seeded(12))
    expect(hit.lastResolution?.result).toBe('hit')
    expect(hit.player.captures).toBe(1)
    expect(hit.player.chips).toBe(14)
    expect(hit.lastResolution?.estimatedHitProbability).toBeCloseTo(1, 10)
    expect(hit.lastResolution?.expectedValue).toBeCloseTo(4, 10)
    const miss = applyAction(state, { type: 'trap', target: { row: 0, col: 1 }, stake: 3 }, seeded(12))
    expect(miss.lastResolution?.result).toBe('miss')
    expect(miss.player.chips).toBe(7)
    expect(miss.playerBelief[0][1].reduce((total, value) => total + value, 0)).toBeCloseTo(0, 10)
  })

  it('keeps chips finite, preserves private evidence, and protects bot context', () => {
    const state = createInitialGame(seeded(20), { mode: 'duel' })
    const sampled = applyAction(state, { type: 'sample' }, seeded(21))
    expect(sampled.player.chips).toBe(9)
    expect(sampled.playerEvidence).toHaveLength(1)
    expect(sampled.botEvidence).toHaveLength(0)
    expect(botContext(sampled)).not.toHaveProperty('ghost')
    expect(botHasNoGhost(botContext(sampled))).toBe(true)
    expect(sampled.playerBelief.flat(2).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
  })

  it('ends at five captures and produces legal actions without impossible cells', () => {
    const state = createInitialGame(seeded(30))
    expect(legalActions(state).length).toBeGreaterThan(0)
    expect(CAPTURES_TO_WIN).toBe(5)
    expect(positionMarginal(state.playerBelief).flat().every((value) => value >= 0)).toBe(true)
  })
})

describe('PROJECTION Monte Carlo bot validation', () => {
  it('runs 10,000 fair bot matches and records finite outcomes', () => {
    let botWins = 0
    let randomWins = 0
    let unfinished = 0
    for (let index = 0; index < 10_000; index += 1) {
      const match = simulateBotMatch(seeded(index + 1000), 500, 5)
      botWins += match.botWins
      randomWins += match.playerWins
      if (!match.state.gameOver) unfinished += 1
      expect(match.state.player.chips).toBeGreaterThanOrEqual(0)
      expect(match.state.bot.chips).toBeGreaterThanOrEqual(0)
      expect(match.state.ghost.position.row).toBeGreaterThanOrEqual(0)
      expect(match.state.ghost.position.row).toBeLessThan(7)
      expect(match.state.playerBelief.flat(2).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
    }
    expect(unfinished).toBe(0)
    expect(botWins + randomWins).toBe(10_000)
    expect(botWins).toBeGreaterThan(randomWins)
  }, 60_000)
})
