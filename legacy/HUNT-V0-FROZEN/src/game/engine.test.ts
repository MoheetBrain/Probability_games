import { describe, expect, it } from 'vitest'
import { BOARD_SIZE, DIRECTIONS } from './constants'
import { conditionOnMiss, createUniformBelief, gridTotal, pointBelief, probabilityOfNextSquare, propagateBelief, updateBeliefWithScan } from './bayes'
import { chooseBotAction } from './bot'
import { applyAction, botContext, createInitialGame, simulateMatch } from './engine'
import { movementOptions } from './ghost'
import type { Action, BeliefState, GameState } from './types'

const seeded = (seed: number) => {
  let value = seed >>> 0
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0
    return value / 4294967296
  }
}

function expectValidBelief(belief: BeliefState) {
  expect(gridTotal(belief.grid)).toBeCloseTo(1, 10)
  expect(belief.joint.flat(2).every((value) => Number.isFinite(value) && value >= 0)).toBe(true)
}

function validState(state: GameState) {
  expect(Number.isFinite(state.player.energy)).toBe(true)
  expect(Number.isFinite(state.bot.energy)).toBe(true)
  expectValidBelief(state.playerBelief)
  expectValidBelief(state.botBelief)
}

describe('HUNT Bayesian filter', () => {
  it('keeps every belief grid normalised and non-negative', () => {
    const belief = createUniformBelief()
    expectValidBelief(belief)
    expectValidBelief(updateBeliefWithScan(belief, { row: 3, col: 3 }, 'warm'))
    expectValidBelief(updateBeliefWithScan(belief, { row: 3, col: 3 }, 'cold'))
    expectValidBelief(propagateBelief(updateBeliefWithScan(belief, { row: 0, col: 0 }, 'warm')))
  })

  it('applies the WARM likelihood ratio correctly', () => {
    const posterior = updateBeliefWithScan(createUniformBelief(), { row: 3, col: 3 }, 'warm')
    expect(posterior.grid[3][3] / posterior.grid[0][0]).toBeCloseTo(4, 10)
  })

  it('applies the COLD likelihood ratio correctly', () => {
    const posterior = updateBeliefWithScan(createUniformBelief(), { row: 3, col: 3 }, 'cold')
    expect(posterior.grid[0][0] / posterior.grid[3][3]).toBeCloseTo(4, 10)
  })

  it('conserves movement mass and renormalises an edge', () => {
    const options = movementOptions({ row: 0, col: 0 }, 'N')
    expect(options.every((option) => option.position.row >= 0 && option.position.col >= 0)).toBe(true)
    expect(options.reduce((sum, option) => sum + option.weight, 0)).toBeCloseTo(1, 10)
    expectValidBelief(propagateBelief(createUniformBelief()))
  })

  it('computes an exact next-square probability', () => {
    const belief = pointBelief({ row: 3, col: 3 }, 'E')
    expect(probabilityOfNextSquare(belief, { row: 3, col: 4 })).toBeCloseTo(0.6, 10)
    expect(probabilityOfNextSquare(belief, { row: 2, col: 4 })).toBeCloseTo(0.2, 10)
    expect(probabilityOfNextSquare(belief, { row: 4, col: 4 })).toBeCloseTo(0.2, 10)
  })
})

describe('HUNT engine rules', () => {
  it('keeps scan results private while exposing the scan action publicly', () => {
    const game = createInitialGame(seeded(1))
    const next = applyAction(game, { type: 'scan' }, seeded(2))
    expect(next.playerLastScan?.result).toMatch(/warm|cold/)
    const event = next.publicEvents[next.publicEvents.length - 1]
    expect(event?.action).toBe('scan')
    expect('result' in (event ?? {})).toBe(false)
  })

  it('resolves a trap against the ghost new location and resets after capture', () => {
    const game = createInitialGame(seeded(3), {
      player: { position: { row: 3, col: 2 } },
      bot: { position: { row: 0, col: 0 } },
      ghost: { position: { row: 3, col: 3 }, direction: 'E' },
    })
    const next = applyAction(game, { type: 'trap', target: { row: 3, col: 4 }, stake: 2 }, () => 0.01)
    expect(next.lastResolution?.result).toBe('hit')
    expect(next.player.captures).toBe(1)
    expect(next.player.energy).toBe(16)
    expect(next.lastResolution?.revealedGhost).toEqual({ row: 3, col: 4 })
    expect(next.ghost.position).not.toEqual({ row: 3, col: 4 })
    expectValidBelief(next.playerBelief)
    expectValidBelief(next.botBelief)
  })

  it('makes a miss lose the stake and condition both public beliefs', () => {
    const game = createInitialGame(seeded(4), {
      player: { position: { row: 3, col: 2 } },
      bot: { position: { row: 0, col: 0 } },
      ghost: { position: { row: 0, col: 0 }, direction: 'E' },
    })
    const next = applyAction(game, { type: 'trap', target: { row: 3, col: 4 }, stake: 3 }, () => 0.99)
    expect(next.lastResolution?.result).toBe('miss')
    expect(next.player.energy).toBe(9)
    expect(next.playerBelief.grid[3][4]).toBeCloseTo(0, 10)
    expect(next.botBelief.grid[3][4]).toBeCloseTo(0, 10)
  })

  it('ends on five captures and on zero energy', () => {
    let captureGame = createInitialGame(seeded(5), {
      player: { position: { row: 3, col: 2 }, captures: 4 },
      bot: { position: { row: 0, col: 0 } },
      ghost: { position: { row: 3, col: 3 }, direction: 'E' },
    })
    captureGame = applyAction(captureGame, { type: 'trap', target: { row: 3, col: 4 }, stake: 1 }, () => 0.01)
    expect(captureGame.gameOver).toBe(true)
    expect(captureGame.outcome).toEqual({ winner: 'player', reason: 'captures' })

    const ruinGame = createInitialGame(seeded(6), {
      player: { position: { row: 3, col: 2 }, energy: 1 },
      bot: { position: { row: 0, col: 0 } },
      ghost: { position: { row: 0, col: 0 }, direction: 'E' },
    })
    const ruined = applyAction(ruinGame, { type: 'trap', target: { row: 3, col: 4 }, stake: 1 }, () => 0.99)
    expect(ruined.gameOver).toBe(true)
    expect(ruined.outcome).toEqual({ winner: 'bot', reason: 'ruin' })
  })

  it('gives the bot only a belief context, never the true ghost', () => {
    const game = createInitialGame(seeded(7))
    const context = botContext(game)
    expect(context).not.toHaveProperty('ghost')
    const action = chooseBotAction(context)
    expect(['move', 'scan', 'trap']).toContain(action.type)
  })

  it('keeps numeric state valid across 10,000 simulated matches', () => {
    for (let index = 0; index < 10_000; index += 1) {
      const game = simulateMatch(seeded(index + 100), 500)
      validState(game)
      expect(game.player.energy).not.toBeNaN()
      expect(game.bot.energy).not.toBeNaN()
      expect(game.player.energy).not.toBe(Infinity)
      expect(game.bot.energy).not.toBe(Infinity)
    }
  }, 30_000)
})
