import { createRandom } from './random'
import { KIND_SKILL, allQuestionKinds, generateQuestion } from './questions'
import { MISCONCEPTIONS, SKILLS, type MisconceptionKey, type PlayerProfile, type Question, type QuestionKind, type SessionMode, type SessionState, type SkillKey } from './types'

const SKILL_LABELS: Record<SkillKey, string> = {
  basicProbability: 'Probability', complements: 'Complements', conditionalProbability: 'Conditional', jointProbability: 'AND / OR',
  baseRates: 'Base rates', bayes: 'Bayes', likelihoodRatios: 'Evidence', expectedValue: 'Expected value',
}

export function skillLabel(skill: SkillKey): string { return SKILL_LABELS[skill] }

export function createProfile(): PlayerProfile {
  return {
    skills: Object.fromEntries(SKILLS.map((skill) => [skill, skill === 'basicProbability' ? 18 : 8])) as PlayerProfile['skills'],
    misconceptions: Object.fromEntries(MISCONCEPTIONS.map((key) => [key, 0])) as PlayerProfile['misconceptions'],
    schedule: Object.fromEntries(SKILLS.map((skill) => [skill, { seen: 0, dueAt: 0, interval: 3 }])) as PlayerProfile['schedule'],
    questionsAnswered: 0, correct: 0, streak: 0, flow: 1, xp: 0, hintUses: 0, totalResponseMs: 0,
    confidence: { low: [0, 0], medium: [0, 0], high: [0, 0] }, history: [],
  }
}

export function difficultyForSkill(score: number): Question['difficulty'] {
  if (score < 25) return 1
  if (score < 45) return 2
  if (score < 65) return 3
  if (score < 82) return 4
  return 5
}

const beginnerKinds: QuestionKind[] = ['choose_probability', 'complement', 'conditional_interpretation']

export function selectQuestion(profile: PlayerProfile, seed: number, sessionIndex: number): Question {
  const rng = createRandom(seed + sessionIndex * 7919)
  let candidates = allQuestionKinds()
  if (profile.questionsAnswered < 4) candidates = beginnerKinds
  else if (profile.questionsAnswered < 10) candidates = candidates.filter((kind) => !['numerical_bayes', 'sequence_update'].includes(kind))

  const scored = candidates.map((kind) => {
    const skill = KIND_SKILL[kind]
    const mastery = profile.skills[skill]
    const schedule = profile.schedule[skill]
    const dueBoost = profile.questionsAnswered >= schedule.dueAt ? 28 : 0
    const weakness = 100 - mastery
    const novelty = schedule.seen === 0 ? 26 : 0
    const misconceptionBoost = kind === 'conditional_interpretation' ? profile.misconceptions.reverseConditional * 6
      : kind === 'base_rate_trap' ? profile.misconceptions.baseRateNeglect * 6
      : kind === 'joint_probability' ? (profile.misconceptions.addMultiplyError + profile.misconceptions.independenceError) * 4
      : 0
    return { kind, score: weakness * 0.55 + dueBoost + novelty + misconceptionBoost + rng.next() * 22 }
  })
  scored.sort((a, b) => b.score - a.score)
  const kind = scored[0]?.kind ?? 'choose_probability'
  const skill = KIND_SKILL[kind]
  return generateQuestion(seed + sessionIndex * 104729, kind, difficultyForSkill(profile.skills[skill]))
}

export function updateProfile(
  current: PlayerProfile,
  question: Question,
  correct: boolean,
  responseMs: number,
  misconception?: MisconceptionKey,
  hintCount = 0,
  confidence?: 'low' | 'medium' | 'high',
): PlayerProfile {
  const profile: PlayerProfile = structuredClone(current)
  const score = profile.skills[question.skill]
  const expected = 0.82 - Math.max(-0.2, Math.min(0.35, (question.difficulty * 18 - score) / 100))
  const delta = correct ? Math.max(1.2, (1 - expected) * 8) : -Math.max(1.5, expected * 4.2)
  profile.skills[question.skill] = Math.max(0, Math.min(100, score + delta - hintCount * 0.25))
  profile.questionsAnswered += 1
  profile.correct += correct ? 1 : 0
  profile.streak = correct ? profile.streak + 1 : 0
  profile.flow = correct ? Math.min(3, profile.flow + 0.25) : Math.max(1, profile.flow - 0.5)
  profile.xp += correct ? Math.max(3, Math.round((6 + question.difficulty * 2 - hintCount) * profile.flow)) : 2
  profile.hintUses += hintCount
  profile.totalResponseMs += responseMs
  if (misconception) profile.misconceptions[misconception] = Math.min(99, profile.misconceptions[misconception] + 1)
  if (correct) {
    for (const key of MISCONCEPTIONS) profile.misconceptions[key] = Math.max(0, profile.misconceptions[key] - (key === misconception ? 0 : 0.08))
  }
  const schedule = profile.schedule[question.skill]
  schedule.seen += 1
  schedule.interval = correct ? Math.min(80, Math.max(3, Math.round(schedule.interval * 1.65))) : 2
  schedule.dueAt = profile.questionsAnswered + schedule.interval
  if (confidence) {
    profile.confidence[confidence][0] += correct ? 1 : 0
    profile.confidence[confidence][1] += 1
  }
  profile.history.push({ questionId: question.id, skill: question.skill, correct, responseMs, misconception })
  profile.history = profile.history.slice(-250)
  return profile
}

export function createSession(mode: SessionMode, seed: number): SessionState {
  return { mode, seed, index: 0, score: 0, complete: false, answers: [] }
}

export function probabilityLevel(profile: PlayerProfile): number {
  return Math.max(1, Math.round(SKILLS.reduce((sum, skill) => sum + profile.skills[skill], 0) / SKILLS.length / 4))
}

export function strongestMisconception(profile: PlayerProfile): MisconceptionKey | undefined {
  return MISCONCEPTIONS.reduce<MisconceptionKey | undefined>((best, key) => !best || profile.misconceptions[key] > profile.misconceptions[best] ? key : best, undefined)
}

