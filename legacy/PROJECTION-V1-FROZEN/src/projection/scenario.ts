import { EVIDENCE_META, LEVEL_PROFILES } from './constants'
import { weightedChoice } from './ghost'
import type { DifficultyLevel, Scenario } from './types'

function normalise(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0)
  return total <= 0 ? values.map(() => 1 / values.length) : values.map((value) => Math.max(0, value) / total)
}

export function levelForCaptures(captures: number): DifficultyLevel { return Math.min(9, Math.max(1, captures + 1)) as DifficultyLevel }

export function createScenario(level: DifficultyLevel, random: () => number = Math.random): Scenario {
  const profile = LEVEL_PROFILES[level]
  const reliability = profile.reliabilityMin + (profile.reliabilityMax - profile.reliabilityMin) * Math.min(.999999, Math.max(0, random()))
  const likelihoods = Array.from({ length: EVIDENCE_META.length }, (_, sector) => {
    const signal = level === 7 && sector === 2 ? 3 : level === 7 && sector === 3 ? 2 : sector
    const raw = EVIDENCE_META.map((_, evidence) => evidence === signal ? 0 : .8 + random() * .4)
    const total = raw.reduce((sum, value) => sum + value, 0)
    return raw.map((value, evidence) => evidence === signal ? reliability : (1 - reliability) * value / total)
  })
  return { level, label: profile.label, activeSectors: profile.activeSectors, priors: normalise(profile.priors), likelihoods, reliability, movement: profile.movement }
}

export function samplePrior(priors: number[], random: () => number = Math.random): number { return weightedChoice(priors, random) }
