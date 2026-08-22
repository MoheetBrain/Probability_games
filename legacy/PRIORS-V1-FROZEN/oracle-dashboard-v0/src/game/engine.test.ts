import { describe, expect, it } from 'vitest'
import { BASE_PRIOR, BASE_TRANSITION_MATRIX, SIGNALS } from './data'
import { brierScore, expectedValue, generateObservations, isRuin, normalizeBelief, posteriorFromObservations, scanCost, sampleState, transitionState, updateRiskCapital } from './engine'
import { DEFAULT_STATS, loadStats, saveStats } from './storage'

describe('ORACLE engine', () => {
  it('normalizes beliefs to exactly one', () => {
    const belief = normalizeBelief({ growth: 4, stable: 3, decline: 3 })
    expect(belief.growth + belief.stable + belief.decline).toBeCloseTo(1)
  })

  it('returns valid Markov states', () => {
    const state = transitionState('growth', BASE_TRANSITION_MATRIX, () => 0.99)
    expect(['growth', 'stable', 'decline']).toContain(state)
    for (const row of Object.values(BASE_TRANSITION_MATRIX)) expect(Object.values(row).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('generates likelihood-backed observations', () => {
    const observations = generateObservations('growth', 4, () => 0.2)
    expect(observations).toHaveLength(4)
    expect(observations.every((observation) => SIGNALS.some((signal) => signal.id === observation.id))).toBe(true)
    expect(Object.values(posteriorFromObservations(BASE_PRIOR, observations)).reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('calculates multiclass Brier score', () => {
    expect(brierScore({ growth: 1, stable: 0, decline: 0 }, 'growth')).toBe(0)
    expect(brierScore({ growth: 0, stable: 1, decline: 0 }, 'growth')).toBe(2)
    expect(brierScore({ growth: 0.6, stable: 0.3, decline: 0.1 }, 'growth')).toBeCloseTo(0.26)
  })

  it('calculates expected value from the player belief', () => {
    expect(expectedValue({ growth: 0.5, stable: 0.5, decline: 0 }, { growth: 3, stable: 1, decline: 0 })).toBeCloseTo(1)
  })

  it('updates wealth using net return and protects reserve', () => {
    const result = updateRiskCapital(7000, 3000, 1000, 3)
    expect(result.riskCapital).toBe(9000)
    expect(result.reserve).toBe(3000)
    const loss = updateRiskCapital(1000, 3000, 1000, 0)
    expect(loss.riskCapital).toBe(0)
    expect(loss.reserveUnlocked).toBe(false)
  })

  it('does not treat protected reserve as risk capital and detects ruin', () => {
    const clampedBet = Math.min(5000, 400)
    expect(clampedBet).toBe(400)
    expect(isRuin(0, 3000)).toBe(false)
    expect(isRuin(0, 0)).toBe(true)
  })

  it('escalates scan costs', () => {
    expect([scanCost(0), scanCost(1), scanCost(2)]).toEqual([100, 200, 400])
  })

  it('loads and saves lifetime stats', () => {
    const memory = new Map<string, string>()
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } as unknown as Storage
    saveStats({ ...DEFAULT_STATS, oracleRating: 742 }, storage)
    expect(loadStats(storage).oracleRating).toBe(742)
  })

  it('samples the edges of a distribution safely', () => {
    expect(sampleState({ growth: 1, stable: 0, decline: 0 }, () => 0)).toBe('growth')
    expect(sampleState({ growth: 0, stable: 0, decline: 1 }, () => 0.999)).toBe('decline')
  })
})
