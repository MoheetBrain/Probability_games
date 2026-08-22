import { BASE_PRIOR, BASE_TRANSITION_MATRIX, OPPORTUNITIES, SIGNALS } from './data'
import type { Belief, DecisionLabel, HiddenState, Observation, Opportunity, TransitionMatrix } from './types'

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

export function normalizeBelief(belief: Belief): Belief {
  const safe = {
    growth: Math.max(0, Number.isFinite(belief.growth) ? belief.growth : 0),
    stable: Math.max(0, Number.isFinite(belief.stable) ? belief.stable : 0),
    decline: Math.max(0, Number.isFinite(belief.decline) ? belief.decline : 0),
  }
  const total = safe.growth + safe.stable + safe.decline
  if (!total) return { ...BASE_PRIOR }
  return { growth: safe.growth / total, stable: safe.stable / total, decline: safe.decline / total }
}

export function makeTransitionMatrix(random: () => number = Math.random): TransitionMatrix {
  const matrix = {} as TransitionMatrix
  for (const state of Object.keys(BASE_TRANSITION_MATRIX) as HiddenState[]) {
    const base = BASE_TRANSITION_MATRIX[state]
    matrix[state] = normalizeBelief({
      growth: base.growth + (random() - 0.5) * 0.06,
      stable: base.stable + (random() - 0.5) * 0.06,
      decline: base.decline + (random() - 0.5) * 0.06,
    })
  }
  return matrix
}

export function sampleState(belief: Belief, random: () => number = Math.random): HiddenState {
  const roll = random()
  let cumulative = 0
  for (const state of ['growth', 'stable', 'decline'] as HiddenState[]) {
    cumulative += belief[state]
    if (roll <= cumulative) return state
  }
  return 'decline'
}

export function transitionState(state: HiddenState, matrix: TransitionMatrix, random: () => number = Math.random): HiddenState {
  return sampleState(matrix[state], random)
}

export function transitionBelief(belief: Belief, matrix: TransitionMatrix): Belief {
  return normalizeBelief({
    growth: belief.growth * matrix.growth.growth + belief.stable * matrix.stable.growth + belief.decline * matrix.decline.growth,
    stable: belief.growth * matrix.growth.stable + belief.stable * matrix.stable.stable + belief.decline * matrix.decline.stable,
    decline: belief.growth * matrix.growth.decline + belief.stable * matrix.stable.decline + belief.decline * matrix.decline.decline,
  })
}

export function generateObservations(state: HiddenState, count = 3, random: () => number = Math.random): Observation[] {
  const available = [...SIGNALS]
  const result: Observation[] = []
  for (let i = 0; i < Math.min(count, available.length); i += 1) {
    const weights = available.map((signal) => Math.max(0.03, signal.likelihoods[state]))
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0)
    let cursor = random() * weightTotal
    let selectedIndex = 0
    for (let index = 0; index < weights.length; index += 1) {
      cursor -= weights[index]
      if (cursor <= 0) {
        selectedIndex = index
        break
      }
    }
    const [selected] = available.splice(selectedIndex, 1)
    result.push({ ...selected, observedAt: Date.now() + i })
  }
  return result
}

export function posteriorFromObservations(prior: Belief, observations: Observation[]): Belief {
  let unnormalized = { ...prior }
  for (const observation of observations) {
    unnormalized = {
      growth: unnormalized.growth * observation.likelihoods.growth,
      stable: unnormalized.stable * observation.likelihoods.stable,
      decline: unnormalized.decline * observation.likelihoods.decline,
    }
    unnormalized = normalizeBelief(unnormalized)
  }
  return unnormalized
}

export function expectedValue(belief: Belief, multipliers: Belief): number {
  return belief.growth * (multipliers.growth - 1) + belief.stable * (multipliers.stable - 1) + belief.decline * (multipliers.decline - 1)
}

export function brierScore(forecast: Belief, actual: HiddenState): number {
  return (['growth', 'stable', 'decline'] as HiddenState[]).reduce((score, state) => {
    const target = state === actual ? 1 : 0
    return score + (forecast[state] - target) ** 2
  }, 0)
}

export function forecastQuality(forecast: Belief, actual: HiddenState): number {
  return Math.round(clamp(1 - brierScore(forecast, actual) / 2) * 100)
}

export function calibrationScore(history: Array<{ forecast: Belief; actualState: HiddenState }>): number {
  if (!history.length) return 70
  const absoluteError = history.reduce((total, record) => total + (['growth', 'stable', 'decline'] as HiddenState[]).reduce((sum, state) => {
    return sum + Math.abs(record.forecast[state] - (record.actualState === state ? 1 : 0))
  }, 0), 0)
  return Math.round(clamp(1 - absoluteError / (history.length * 2)) * 100)
}

export function updatingScore(forecast: Belief, posterior: Belief): number {
  const distance = (Math.abs(forecast.growth - posterior.growth) + Math.abs(forecast.stable - posterior.stable) + Math.abs(forecast.decline - posterior.decline)) / 2
  return Math.round(clamp(1 - distance) * 100)
}

export function scanCost(scanCount: number): number {
  return 100 * (2 ** scanCount)
}

export function bestStakeFraction(belief: Belief, multipliers: Belief): number {
  let bestFraction = 0
  let bestUtility = 0
  for (let step = 0; step <= 50; step += 1) {
    const fraction = step / 100
    const terms = (['growth', 'stable', 'decline'] as HiddenState[]).map((state) => 1 + fraction * (multipliers[state] - 1))
    if (terms.some((term) => term <= 0)) continue
    const utility = belief.growth * Math.log(terms[0]) + belief.stable * Math.log(terms[1]) + belief.decline * Math.log(terms[2])
    if (utility > bestUtility) {
      bestUtility = utility
      bestFraction = fraction
    }
  }
  return bestFraction
}

function stakeScore(selectedFraction: number, recommendedFraction: number, playerEv: number): number {
  if (playerEv <= 0) return selectedFraction < 0.005 ? 100 : Math.max(0, Math.round(100 - selectedFraction * 180))
  const difference = Math.abs(selectedFraction - recommendedFraction)
  return Math.round(clamp(1 - difference / Math.max(0.12, recommendedFraction + 0.08)) * 100)
}

export function evaluateDecision(
  forecast: Belief,
  actual: HiddenState,
  opportunity: Opportunity,
  stake: number,
  availableRisk: number,
  posterior: Belief,
  previousHistory: Array<{ forecast: Belief; actualState: HiddenState }>,
  scansPurchased = 0,
): { playerEv: number; trueEv: number; brier: number; forecastQuality: number; calibration: number; updating: number; betSizing: number; riskControl: number; informationUse: number; decisionQuality: number; label: DecisionLabel; recommendedFraction: number } {
  const playerEv = expectedValue(forecast, opportunity.multipliers)
  const trueEv = expectedValue(posterior, opportunity.multipliers)
  const fraction = availableRisk > 0 ? stake / availableRisk : 0
  const recommendedFraction = bestStakeFraction(forecast, opportunity.multipliers)
  const sizing = stakeScore(fraction, recommendedFraction, playerEv)
  const downsideProbability = forecast.stable * (opportunity.multipliers.stable < 1 ? 1 : 0) + forecast.decline * (opportunity.multipliers.decline < 1 ? 1 : 0)
  const riskControl = Math.round(clamp(1 - Math.max(0, fraction - 0.12) * (1.2 + downsideProbability)) * 100)
  const evScore = stake === 0 ? (playerEv <= 0 ? 100 : 62) : playerEv > 0 ? 100 : 15
  const updating = updatingScore(forecast, posterior)
  const quality = forecastQuality(forecast, actual)
  const calibration = calibrationScore([...previousHistory, { forecast, actualState: actual }])
  const informationUse = scansPurchased > 0
    ? Math.round(clamp(0.7 + scansPurchased * 0.06 - Math.abs(playerEv - trueEv) * 1.5) * 100)
    : Math.round(clamp(0.72 - Math.abs(playerEv - trueEv) * 1.5) * 100)
  const decisionQuality = Math.round(quality * 0.3 + evScore * 0.25 + sizing * 0.2 + riskControl * 0.15 + updating * 0.1)
  const label = playerEv < -0.01 && stake > 0 ? 'BAD EV' : riskControl < 35 || fraction > 0.7 ? 'RECKLESS' : fraction > Math.max(0.3, recommendedFraction * 2.5) ? 'AGGRESSIVE' : decisionQuality >= 76 ? 'GOOD' : 'REASONABLE'
  return { playerEv, trueEv, brier: brierScore(forecast, actual), forecastQuality: quality, calibration, updating, betSizing: sizing, riskControl, informationUse, decisionQuality, label, recommendedFraction }
}

export function generateOpportunity(random: () => number = Math.random, turn = 1): Opportunity {
  const base = OPPORTUNITIES[Math.floor(random() * OPPORTUNITIES.length)]
  const drift = ((turn % 4) - 1.5) * 0.015
  return {
    ...base,
    multipliers: {
      growth: Math.max(0.08, base.multipliers.growth + drift),
      stable: Math.max(0.08, base.multipliers.stable + drift / 2),
      decline: Math.max(0.08, base.multipliers.decline - drift / 2),
    },
  }
}

export function updateRiskCapital(riskCapital: number, reserve: number, stake: number, multiplier: number): { riskCapital: number; reserve: number; reserveUnlocked: boolean } {
  const nextRisk = Math.max(0, riskCapital + stake * (multiplier - 1))
  if (nextRisk > 0 || reserve <= 0) return { riskCapital: nextRisk, reserve, reserveUnlocked: reserve <= 0 }
  return { riskCapital: 0, reserve, reserveUnlocked: false }
}

export function isRuin(riskCapital: number, reserve: number): boolean {
  return riskCapital + reserve <= 50
}

export function initialGame(random: () => number = Math.random, debug = false) {
  const matrix = makeTransitionMatrix(random)
  const hiddenState = sampleState(BASE_PRIOR, random)
  const observations = generateObservations(hiddenState, 3, random)
  const posterior = posteriorFromObservations(BASE_PRIOR, observations)
  const opportunity = generateOpportunity(random, 1)
  return {
    turn: 1,
    totalTurns: 20,
    capital: 10000,
    reserve: 3000,
    riskCapital: 7000,
    reserveUnlocked: false,
    stressTurns: 0,
    hiddenState,
    transitionMatrix: matrix,
    prior: { ...BASE_PRIOR },
    observations,
    posterior,
    forecast: { ...BASE_PRIOR },
    opportunity,
    scanCount: 0,
    scanCost: scanCost(0),
    pendingStake: 0,
    phase: 'forecast' as const,
    history: [],
    ruined: false,
    debug,
  }
}
