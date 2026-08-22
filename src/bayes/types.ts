export type SkillKey =
  | 'basicProbability'
  | 'complements'
  | 'conditionalProbability'
  | 'jointProbability'
  | 'baseRates'
  | 'bayes'
  | 'likelihoodRatios'
  | 'expectedValue'

export type MisconceptionKey =
  | 'reverseConditional'
  | 'baseRateNeglect'
  | 'denominatorNeglect'
  | 'independenceError'
  | 'addMultiplyError'
  | 'complementError'
  | 'payoffBias'

export type QuestionKind =
  | 'choose_probability'
  | 'complement'
  | 'conditional_interpretation'
  | 'joint_probability'
  | 'union_probability'
  | 'frequency_table'
  | 'visual_bayes'
  | 'numerical_bayes'
  | 'base_rate_trap'
  | 'expected_value'
  | 'evidence_strength'
  | 'sequence_update'

export type VisualSpec =
  | { type: 'dots'; total: number; highlighted: number; label: string }
  | { type: 'bar'; value: number; label: string; complementLabel?: string }
  | { type: 'frequency'; total: number; truePositive: number; falsePositive: number; hypothesisLabel: string; evidenceLabel: string }
  | { type: 'table'; headers: [string, string]; rows: Array<{ label: string; values: [number, number] }> }
  | { type: 'sequence'; values: number[]; labels: string[] }
  | { type: 'ev'; options: Array<{ label: string; outcomes: Array<{ probability: number; payoff: number }> }> }

export type AnswerOption = {
  id: string
  label: string
  misconception?: MisconceptionKey
}

export type Question = {
  id: string
  kind: QuestionKind
  skill: SkillKey
  difficulty: 1 | 2 | 3 | 4 | 5
  eyebrow: string
  prompt: string
  detail?: string
  notation?: string
  options: AnswerOption[]
  correctOptionId: string
  explanation: {
    title: string
    body: string
    takeaway: string
    visual: VisualSpec
  }
  hints: string[]
}

export type SkillProfile = Record<SkillKey, number>
export type Misconceptions = Record<MisconceptionKey, number>

export type SkillSchedule = Record<SkillKey, { seen: number; dueAt: number; interval: number }>

export type PlayerProfile = {
  skills: SkillProfile
  misconceptions: Misconceptions
  schedule: SkillSchedule
  questionsAnswered: number
  correct: number
  streak: number
  flow: number
  xp: number
  hintUses: number
  totalResponseMs: number
  confidence: { low: [number, number]; medium: [number, number]; high: [number, number] }
  history: Array<{ questionId: string; skill: SkillKey; correct: boolean; responseMs: number; misconception?: MisconceptionKey }>
}

export type SessionMode = 'daily' | 'endless'

export type SessionState = {
  mode: SessionMode
  seed: number
  index: number
  score: number
  complete: boolean
  answers: Array<{ questionId: string; correct: boolean; skill: SkillKey; misconception?: MisconceptionKey }>
}

export const SKILLS: SkillKey[] = [
  'basicProbability',
  'complements',
  'conditionalProbability',
  'jointProbability',
  'baseRates',
  'bayes',
  'likelihoodRatios',
  'expectedValue',
]

export const MISCONCEPTIONS: MisconceptionKey[] = [
  'reverseConditional',
  'baseRateNeglect',
  'denominatorNeglect',
  'independenceError',
  'addMultiplyError',
  'complementError',
  'payoffBias',
]

