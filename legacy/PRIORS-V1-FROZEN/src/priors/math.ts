import { MAX_STAKE } from './constants'

export function normalise(values: number[]): number[] {
  const safe = values.map((value) => Number.isFinite(value) && value > 0 ? value : 0)
  const total = safe.reduce((sum, value) => sum + value, 0)
  if (total <= 0) return safe.map(() => 1 / safe.length)
  return safe.map((value) => value / total)
}

export function bayesianUpdate(prior: number[], likelihood: number[]): number[] {
  if (prior.length !== likelihood.length) throw new Error('Prior and likelihood vectors must have the same length')
  return normalise(prior.map((value, index) => value * Math.max(0, likelihood[index])))
}

export function posteriorAfterEvidence(prior: number[], likelihoods: number[][], evidenceIndex: number): number[] {
  return bayesianUpdate(prior, likelihoods.map((row) => row[evidenceIndex] ?? 0))
}

export function weightedSample(weights: number[], random: () => number = Math.random): number {
  const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
  if (total <= 0) return 0
  let threshold = Math.min(0.999999999, Math.max(0, random())) * total
  for (let index = 0; index < weights.length; index += 1) {
    threshold -= Math.max(0, weights[index])
    if (threshold <= 0) return index
  }
  return weights.length - 1
}

export function payoutMultiplier(prior: number): number {
  if (!Number.isFinite(prior) || prior <= 0) return 12
  // A compressed, transparent odds curve: rare states pay more, but never
  // enough to make a long shot automatically correct.
  return Math.min(12, Math.max(2, Math.round(1 + .45 / prior)))
}

export function expectedValue(probability: number, stake: number, multiplier: number): number {
  return probability * stake * multiplier - stake
}

export function expectedValueForState(posterior: number[], priors: number[], state: number, stake: number): number {
  return expectedValue(posterior[state] ?? 0, stake, payoutMultiplier(priors[state] ?? 0))
}

export function allExpectedValues(posterior: number[], priors: number[], stake: number): number[] {
  return posterior.map((_, state) => expectedValueForState(posterior, priors, state, stake))
}

export function maxStake(chips: number): number {
  return Math.min(MAX_STAKE, Math.max(0, Math.floor(chips)))
}

export function entropy(probabilities: number[]): number {
  return probabilities.reduce((sum, probability) => probability > 0 ? sum - probability * Math.log2(probability) : sum, 0)
}

export function normalisedEntropy(probabilities: number[]): number {
  const active = probabilities.filter((value) => value > 0).length
  return active <= 1 ? 0 : entropy(probabilities) / Math.log2(active)
}
