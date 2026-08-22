import { DIFFICULTY_PROFILES, EVIDENCE_META } from './constants'
import { normalise, weightedSample } from './math'
import type { DifficultyLevel, EvidenceId, RoundState } from './types'

export function difficultyForRound(roundNumber: number): DifficultyLevel {
  return Math.min(8, Math.max(1, Math.ceil(roundNumber / 2))) as DifficultyLevel
}

function createLikelihoods(reliability: number, random: () => number): number[][] {
  return Array.from({ length: EVIDENCE_META.length }, (_, hypothesis) => {
    const offDiagonal = Array.from({ length: EVIDENCE_META.length }, (_, evidence) => evidence === hypothesis ? 0 : .82 + random() * .36)
    const offTotal = offDiagonal.reduce((sum, value) => sum + value, 0)
    return offDiagonal.map((weight, evidence) => evidence === hypothesis ? reliability : (1 - reliability) * weight / offTotal)
  })
}

export function createRound(roundNumber: number, difficulty: DifficultyLevel = difficultyForRound(roundNumber), random: () => number = Math.random): RoundState {
  const profile = DIFFICULTY_PROFILES[difficulty]
  const priors = normalise(profile.basePriors)
  const reliability = profile.reliabilityMin + (profile.reliabilityMax - profile.reliabilityMin) * Math.min(.999999, Math.max(0, random()))
  const likelihoods = createLikelihoods(reliability, random)
  return {
    number: roundNumber,
    difficulty,
    priors,
    hiddenState: weightedSample(priors, random),
    likelihoods,
    reliability,
    evidence: [],
    posterior: [...priors],
    posteriorHistory: [[...priors]],
  }
}

export function sampleEvidence(round: RoundState, random: () => number = Math.random): EvidenceId {
  const hiddenRow = round.likelihoods[round.hiddenState]
  return EVIDENCE_META[weightedSample(hiddenRow, random)].id
}

export function evidenceIndex(id: EvidenceId): number {
  return EVIDENCE_META.findIndex((item) => item.id === id)
}
