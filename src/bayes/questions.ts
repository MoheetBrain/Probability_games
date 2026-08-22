import { createRandom } from './random'
import type { AnswerOption, MisconceptionKey, Question, QuestionKind, SkillKey, VisualSpec } from './types'

type Context = { a: string; b: string; evidence: string; icon: string }

const contexts: Context[] = [
  { a: 'potatoes', b: 'eggs', evidence: 'brown', icon: '🥔' },
  { a: 'dragons', b: 'lizards', evidence: 'smoke nearby', icon: '🐉' },
  { a: 'gold sites', b: 'ordinary sites', evidence: 'a magnetic anomaly', icon: '✦' },
  { a: 'major winners', b: 'ordinary companies', evidence: 'rapid revenue growth', icon: '↗' },
  { a: 'aliens', b: 'humans', evidence: 'a purple aura', icon: '◉' },
  { a: 'faulty robots', b: 'working robots', evidence: 'a warning light', icon: '⚙' },
]

const conditionalPairs = [
  ['Rain', 'Cloudy'],
  ['Winner', 'Revenue > 50%'],
  ['Potato', 'Brown'],
  ['Dragon', 'Smoke'],
  ['Gold', 'Anomaly'],
] as const

const probabilitySets = [
  { good: 70, total: 100, noun: 'marbles', success: 'blue' },
  { good: 3, total: 4, noun: 'cards', success: 'marked' },
  { good: 1, total: 2, noun: 'doors', success: 'open' },
  { good: 9, total: 10, noun: 'robots', success: 'working' },
  { good: 2, total: 5, noun: 'signals', success: 'real' },
] as const

const bayesSets = [
  { prior: 1, sensitivity: 90, falsePositive: 10 },
  { prior: 10, sensitivity: 80, falsePositive: 20 },
  { prior: 20, sensitivity: 75, falsePositive: 25 },
  { prior: 30, sensitivity: 80, falsePositive: 20 },
  { prior: 5, sensitivity: 80, falsePositive: 10 },
  { prior: 25, sensitivity: 60, falsePositive: 20 },
] as const

export function bayesPosterior(prior: number, sensitivity: number, falsePositive: number): number {
  const numerator = prior * sensitivity
  return numerator / (numerator + (1 - prior) * falsePositive)
}

export function expectedValue(outcomes: Array<{ probability: number; payoff: number }>): number {
  return outcomes.reduce((sum, outcome) => sum + outcome.probability * outcome.payoff, 0)
}

function percent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`
}

function money(value: number): string {
  return `${value < 0 ? '−' : '+'}£${Math.abs(value)}`
}

function option(id: string, label: string, misconception?: MisconceptionKey): AnswerOption {
  return { id, label, misconception }
}

function uniqueNumericOptions(
  correct: number,
  candidates: Array<{ value: number; misconception?: MisconceptionKey }>,
  rng: ReturnType<typeof createRandom>,
  formatter: (value: number) => string = percent,
): { options: AnswerOption[]; correctOptionId: string } {
  const used = new Set<number>([Math.round(correct * 10)])
  const values: Array<{ value: number; misconception?: MisconceptionKey; correct?: boolean }> = [{ value: correct, correct: true }]
  for (const candidate of candidates) {
    const key = Math.round(candidate.value * 10)
    if (candidate.value >= 0 && candidate.value <= 100 && !used.has(key)) {
      used.add(key)
      values.push(candidate)
    }
    if (values.length === 4) break
  }
  const fallbacks = [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95]
  for (const value of fallbacks) {
    const key = value * 10
    if (!used.has(key) && values.length < 4) {
      used.add(key)
      values.push({ value, misconception: 'denominatorNeglect' })
    }
  }
  const shuffled = rng.shuffle(values)
  const correctIndex = shuffled.findIndex((value) => value.correct)
  return {
    options: shuffled.map((value, index) => option(`o${index}`, formatter(value.value), value.misconception)),
    correctOptionId: `o${correctIndex}`,
  }
}

function makeQuestion(base: Omit<Question, 'id'>, seed: number): Question {
  return { ...base, id: `${base.kind}-${seed}` }
}

function basicQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const set = rng.pick(probabilitySets)
  const correct = (set.good / set.total) * 100
  const answers = uniqueNumericOptions(correct, [
    { value: 100 - correct, misconception: 'complementError' },
    { value: set.good, misconception: 'denominatorNeglect' },
    { value: (set.total - set.good) / set.total * 100, misconception: 'complementError' },
  ], rng)
  return makeQuestion({
    kind: 'choose_probability', skill: 'basicProbability', difficulty,
    eyebrow: 'Probability intuition',
    prompt: `${set.good} of ${set.total} ${set.noun} are ${set.success}. What is the probability of choosing one?`,
    detail: 'Choose the fraction of the whole group.',
    ...answers,
    explanation: {
      title: `${set.good} out of ${set.total}.`,
      body: `Probability is favourable cases divided by all cases: ${set.good} ÷ ${set.total} = ${percent(correct)}.`,
      takeaway: 'Part ÷ whole.',
      visual: { type: 'dots', total: Math.min(set.total, 20), highlighted: Math.round(Math.min(set.total, 20) * correct / 100), label: set.success },
    },
    hints: [`Count the ${set.success} ${set.noun}.`, `Now divide by all ${set.total}.`, `${set.good}/${set.total} × 100.`],
  }, seed)
}

function complementQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const value = rng.pick(difficulty <= 2 ? [20, 30, 40, 70, 80] : [12, 27, 63, 72, 88])
  const correct = 100 - value
  const answers = uniqueNumericOptions(correct, [
    { value, misconception: 'complementError' },
    { value: Math.abs(50 - value), misconception: 'denominatorNeglect' },
    { value: 100 / value, misconception: 'denominatorNeglect' },
  ], rng)
  return makeQuestion({
    kind: 'complement', skill: 'complements', difficulty,
    eyebrow: 'Complements', prompt: `A signal appears ${value}% of the time. How often does it not appear?`, notation: `P(not A) = ?`,
    ...answers,
    explanation: {
      title: `${value}% + ${correct}% = 100%.`,
      body: 'An event and its complement cover every possible outcome, with no overlap.',
      takeaway: 'The complement is 100% minus the event.',
      visual: { type: 'bar', value, label: 'appears', complementLabel: 'does not' },
    },
    hints: ['Together, A and not A fill the whole probability bar.', 'The whole bar is 100%.', `Calculate 100 − ${value}.`],
  }, seed)
}

function conditionalQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const [a, b] = rng.pick(conditionalPairs)
  const correctText = `Probability of ${a.toLowerCase()}, given ${b.toLowerCase()}`
  const values = rng.shuffle([
    { label: correctText, correct: true },
    { label: `Probability of ${b.toLowerCase()}, given ${a.toLowerCase()}`, misconception: 'reverseConditional' as const },
    { label: `Probability of ${a.toLowerCase()} and ${b.toLowerCase()}`, misconception: 'denominatorNeglect' as const },
    { label: `Probability of ${a.toLowerCase()} plus ${b.toLowerCase()}`, misconception: 'addMultiplyError' as const },
  ])
  const correctIndex = values.findIndex((value) => value.correct)
  return makeQuestion({
    kind: 'conditional_interpretation', skill: 'conditionalProbability', difficulty,
    eyebrow: 'Read the bar', prompt: `What does this mean?`, notation: `P(${a} | ${b})`,
    options: values.map((value, index) => option(`o${index}`, value.label, value.misconception)), correctOptionId: `o${correctIndex}`,
    explanation: {
      title: `Read “|” as GIVEN.`,
      body: `P(${a} | ${b}) asks: among the worlds where ${b} is already true, how often is ${a} true?`,
      takeaway: `The condition after the bar sets the reference group.`,
      visual: { type: 'bar', value: 62, label: `${a} inside ${b}` },
    },
    hints: ['Say the vertical bar aloud.', 'Everything after the bar is already known.', `“Probability of ${a}, given…”`],
  }, seed)
}

function jointQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const a = rng.pick(difficulty <= 2 ? [50, 60, 80] : [30, 40, 70])
  const b = rng.pick(difficulty <= 2 ? [20, 50] : [30, 60])
  const correct = a * b / 100
  const answers = uniqueNumericOptions(correct, [
    { value: Math.min(100, a + b), misconception: 'addMultiplyError' },
    { value: a + b - 100, misconception: 'addMultiplyError' },
    { value: Math.min(a, b), misconception: 'independenceError' },
  ], rng)
  return makeQuestion({
    kind: 'joint_probability', skill: 'jointProbability', difficulty,
    eyebrow: 'AND / independent events',
    prompt: `A sensor works ${a}% of the time. A separate alarm works ${b}% of the time. What is the chance both work?`,
    notation: 'P(sensor ∩ alarm)', ...answers,
    explanation: {
      title: `AND means multiply here.`,
      body: `The events are independent, so ${a / 100} × ${b / 100} = ${correct / 100}.`,
      takeaway: `For independent events: P(A and B) = P(A) × P(B).`,
      visual: { type: 'table', headers: ['Alarm works', 'Alarm fails'], rows: [{ label: 'Sensor works', values: [correct, a - correct] }, { label: 'Sensor fails', values: [b - correct, 100 - a - b + correct] }] },
    },
    hints: ['“Both” means AND.', 'These events are independent.', `Multiply ${a / 100} by ${b / 100}.`],
  }, seed)
}

function unionQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const a = rng.pick([30, 40, 50, 60])
  const b = rng.pick([20, 30, 40])
  const both = rng.pick([10, 20])
  const validBoth = Math.min(both, a, b)
  const correct = a + b - validBoth
  const answers = uniqueNumericOptions(correct, [
    { value: Math.min(100, a + b), misconception: 'addMultiplyError' },
    { value: validBoth, misconception: 'denominatorNeglect' },
    { value: a * b / 100, misconception: 'independenceError' },
  ], rng)
  return makeQuestion({
    kind: 'union_probability', skill: 'jointProbability', difficulty,
    eyebrow: 'OR / avoid double counting',
    prompt: `${a}% of explorers find quartz. ${b}% find copper. ${validBoth}% find both. How many find quartz or copper?`,
    notation: 'P(quartz ∪ copper)', ...answers,
    explanation: {
      title: `Add, then remove the overlap.`,
      body: `${a}% + ${b}% counts the ${validBoth}% overlap twice, so subtract it once: ${a} + ${b} − ${validBoth} = ${correct}%.`,
      takeaway: 'P(A or B) = P(A) + P(B) − P(A and B).',
      visual: { type: 'table', headers: ['Copper', 'No copper'], rows: [{ label: 'Quartz', values: [validBoth, a - validBoth] }, { label: 'No quartz', values: [b - validBoth, 100 - correct] }] },
    },
    hints: ['Add both groups first.', 'The overlap has now been counted twice.', `Subtract the shared ${validBoth}%.`],
  }, seed)
}

function bayesQuestion(seed: number, difficulty: Question['difficulty'], kind: 'visual_bayes' | 'numerical_bayes' | 'base_rate_trap'): Question {
  const rng = createRandom(seed)
  const context = rng.pick(contexts)
  const set = rng.pick(bayesSets)
  const total = set.prior === 1 || set.prior === 5 ? 1000 : 100
  const hypothesis = total * set.prior / 100
  const truePositive = hypothesis * set.sensitivity / 100
  const falsePositive = (total - hypothesis) * set.falsePositive / 100
  const posterior = bayesPosterior(set.prior / 100, set.sensitivity / 100, set.falsePositive / 100) * 100
  const answers = uniqueNumericOptions(posterior, [
    { value: set.sensitivity, misconception: 'reverseConditional' },
    { value: set.prior, misconception: 'baseRateNeglect' },
    { value: 50, misconception: 'baseRateNeglect' },
    { value: truePositive / total * 100, misconception: 'denominatorNeglect' },
  ], rng)
  const prompt = kind === 'base_rate_trap'
    ? `Only ${set.prior}% of objects are ${context.a}. ${percent(set.sensitivity)} of ${context.a} show ${context.evidence}, but ${percent(set.falsePositive)} of ${context.b} do too. An object shows the signal. How likely is ${context.a}?`
    : `${set.prior}% are ${context.a}. The signal appears in ${set.sensitivity}% of ${context.a} and ${set.falsePositive}% of ${context.b}. You observe ${context.evidence}. What is P(${context.a} | signal)?`
  return makeQuestion({
    kind, skill: kind === 'base_rate_trap' ? 'baseRates' : 'bayes', difficulty,
    eyebrow: kind === 'visual_bayes' ? 'Bayes / natural frequencies' : kind === 'base_rate_trap' ? 'Base-rate trap' : 'Bayesian update',
    prompt: `${context.icon} ${prompt}`,
    detail: kind === 'visual_bayes' ? `Imagine ${total.toLocaleString()} cases.` : undefined,
    notation: kind === 'numerical_bayes' ? `P(${context.a} | ${context.evidence}) = ?` : undefined,
    ...answers,
    explanation: {
      title: `${Math.round(truePositive)} of ${Math.round(truePositive + falsePositive)} signal cases are ${context.a}.`,
      body: `Start with ${total.toLocaleString()}: ${Math.round(hypothesis)} are ${context.a}, giving ${Math.round(truePositive)} true signals. The other ${Math.round(total - hypothesis)} give ${Math.round(falsePositive)} false signals. So ${Math.round(truePositive)} ÷ ${Math.round(truePositive + falsePositive)} ≈ ${percent(posterior)}.`,
      takeaway: 'The denominator is every case where the evidence appeared.',
      visual: { type: 'frequency', total, truePositive: Math.round(truePositive), falsePositive: Math.round(falsePositive), hypothesisLabel: context.a, evidenceLabel: context.evidence },
    },
    hints: [`Imagine ${total.toLocaleString()} cases.`, `How many are ${context.a} before seeing the signal?`, `Compare true signals with all signals.`],
  }, seed)
}

function frequencyQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const truePositive = rng.pick([8, 12, 18, 24])
  const falsePositive = rng.pick([6, 16, 32, 42])
  const posterior = truePositive / (truePositive + falsePositive) * 100
  const answers = uniqueNumericOptions(posterior, [
    { value: truePositive, misconception: 'denominatorNeglect' },
    { value: truePositive / 100 * 100, misconception: 'baseRateNeglect' },
    { value: falsePositive / (truePositive + falsePositive) * 100, misconception: 'complementError' },
  ], rng)
  return makeQuestion({
    kind: 'frequency_table', skill: 'conditionalProbability', difficulty,
    eyebrow: 'Reference class', prompt: `A detector flags ${truePositive} real targets and ${falsePositive} false alarms. If you inspect a flagged case, what is the chance it is real?`,
    ...answers,
    explanation: {
      title: `${truePositive} real ÷ ${truePositive + falsePositive} flagged.`,
      body: `Once “flagged” is given, the reference group contains only the ${truePositive + falsePositive} flagged cases.`,
      takeaway: 'Condition first. Then count inside that group.',
      visual: { type: 'frequency', total: 100, truePositive, falsePositive, hypothesisLabel: 'real target', evidenceLabel: 'flagged' },
    },
    hints: ['Ignore unflagged cases.', `There are ${truePositive + falsePositive} flagged cases in total.`, `Calculate ${truePositive}/${truePositive + falsePositive}.`],
  }, seed)
}

function evQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const sets = [
    { a: [80, 10, -5], b: [20, 100, -5] },
    { a: [70, 12, -6], b: [30, 32, -4] },
    { a: [90, 6, -3], b: [40, 18, -5] },
    { a: [60, 15, -5], b: [20, 45, -4] },
  ] as const
  const set = rng.pick(sets)
  const evA = expectedValue([{ probability: set.a[0] / 100, payoff: set.a[1] }, { probability: (100 - set.a[0]) / 100, payoff: set.a[2] }])
  const evB = expectedValue([{ probability: set.b[0] / 100, payoff: set.b[1] }, { probability: (100 - set.b[0]) / 100, payoff: set.b[2] }])
  const correctLabel = evA > evB ? `Option A — EV ${money(evA)}` : `Option B — EV ${money(evB)}`
  const values = rng.shuffle([
    { label: correctLabel, correct: true },
    { label: evA > evB ? 'Option B — it has the biggest jackpot' : 'Option A — it wins more often', misconception: 'payoffBias' as const },
    { label: 'They have equal expected value', misconception: 'denominatorNeglect' as const },
    { label: 'Impossible to compare without playing once', misconception: 'baseRateNeglect' as const },
  ])
  const correctIndex = values.findIndex((value) => value.correct)
  return makeQuestion({
    kind: 'expected_value', skill: 'expectedValue', difficulty,
    eyebrow: 'Expected value', prompt: 'Which option has the higher average payoff over many plays?',
    detail: `A: ${set.a[0]}% → ${money(set.a[1])}, ${100 - set.a[0]}% → ${money(set.a[2])}.  B: ${set.b[0]}% → ${money(set.b[1])}, ${100 - set.b[0]}% → ${money(set.b[2])}.`,
    options: values.map((value, index) => option(`o${index}`, value.label, value.misconception)), correctOptionId: `o${correctIndex}`,
    explanation: {
      title: `${evA > evB ? 'A' : 'B'} has the higher probability-weighted payoff.`,
      body: `EV(A) = ${set.a[0] / 100}×${money(set.a[1])} + ${(100 - set.a[0]) / 100}×(${money(set.a[2])}) = ${money(evA)}. EV(B) = ${money(evB)}.`,
      takeaway: 'Weight every payoff by its probability, then add.',
      visual: { type: 'ev', options: [{ label: 'A', outcomes: [{ probability: set.a[0], payoff: set.a[1] }, { probability: 100 - set.a[0], payoff: set.a[2] }] }, { label: 'B', outcomes: [{ probability: set.b[0], payoff: set.b[1] }, { probability: 100 - set.b[0], payoff: set.b[2] }] }] },
    },
    hints: ['A large jackpot is not enough by itself.', 'Multiply each payoff by its probability.', `EV(A) is ${money(evA)}.`],
  }, seed)
}

function evidenceStrengthQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const rng = createRandom(seed)
  const values = rng.shuffle([
    { label: 'Signal A: 80% vs 20%', correct: true },
    { label: 'Signal B: 60% vs 40%', misconception: 'baseRateNeglect' as const },
    { label: 'They are equally strong', misconception: 'denominatorNeglect' as const },
    { label: 'Impossible to tell from likelihoods', misconception: 'reverseConditional' as const },
  ])
  const correctIndex = values.findIndex((value) => value.correct)
  return makeQuestion({
    kind: 'evidence_strength', skill: 'likelihoodRatios', difficulty,
    eyebrow: 'Evidence strength', prompt: 'Which positive signal is stronger evidence for a winner?',
    detail: 'Signal A appears in 80% of winners and 20% of others. Signal B appears in 60% of winners and 40% of others.',
    options: values.map((value, index) => option(`o${index}`, value.label, value.misconception)), correctOptionId: `o${correctIndex}`,
    explanation: {
      title: 'Signal A is four times as likely under “winner”.',
      body: 'A has likelihood ratio 80/20 = 4. B has 60/40 = 1.5. A changes the odds much more.',
      takeaway: 'Diagnostic evidence is common under one hypothesis and rare under its alternative.',
      visual: { type: 'table', headers: ['Winner', 'Other'], rows: [{ label: 'Signal A', values: [80, 20] }, { label: 'Signal B', values: [60, 40] }] },
    },
    hints: ['Compare each signal across the two groups.', 'Strong evidence separates the groups.', 'Compare 80/20 with 60/40.'],
  }, seed)
}

function sequenceQuestion(seed: number, difficulty: Question['difficulty']): Question {
  const values = [20, 45, 72, 64]
  const options = [
    option('o0', 'Evidence 1'), option('o1', 'Evidence 2'), option('o2', 'Evidence 3'), option('o3', 'They were equally strong'),
  ]
  return makeQuestion({
    kind: 'sequence_update', skill: 'bayes', difficulty,
    eyebrow: 'Sequential Bayes', prompt: 'Which evidence increased belief the most?', detail: 'Prior 20% → Evidence 1: 45% → Evidence 2: 72% → Evidence 3: 64%.',
    options, correctOptionId: 'o0',
    explanation: {
      title: 'Evidence 1 produced the largest upward change.',
      body: 'Evidence 1 moved belief +25 points, Evidence 2 moved it +27 points — but changes should be compared on odds. 20%→45% multiplies the odds by 3.27; 45%→72% multiplies them by 3.14.',
      takeaway: 'Bayesian evidence multiplies odds, so equal percentage-point moves need not be equally strong.',
      visual: { type: 'sequence', values, labels: ['Prior', 'E1', 'E2', 'E3'] },
    },
    hints: ['Evidence strength is clearest in odds.', 'Convert 20% and 45% to odds.', 'The first update slightly wins: ×3.27 vs ×3.14.'],
  }, seed)
}

export const KIND_SKILL: Record<QuestionKind, SkillKey> = {
  choose_probability: 'basicProbability', complement: 'complements', conditional_interpretation: 'conditionalProbability',
  joint_probability: 'jointProbability', union_probability: 'jointProbability', frequency_table: 'conditionalProbability',
  visual_bayes: 'bayes', numerical_bayes: 'bayes', base_rate_trap: 'baseRates', expected_value: 'expectedValue',
  evidence_strength: 'likelihoodRatios', sequence_update: 'bayes',
}

export function generateQuestion(seed: number, kind: QuestionKind, difficulty: Question['difficulty']): Question {
  switch (kind) {
    case 'choose_probability': return basicQuestion(seed, difficulty)
    case 'complement': return complementQuestion(seed, difficulty)
    case 'conditional_interpretation': return conditionalQuestion(seed, difficulty)
    case 'joint_probability': return jointQuestion(seed, difficulty)
    case 'union_probability': return unionQuestion(seed, difficulty)
    case 'frequency_table': return frequencyQuestion(seed, difficulty)
    case 'visual_bayes': return bayesQuestion(seed, difficulty, kind)
    case 'numerical_bayes': return bayesQuestion(seed, difficulty, kind)
    case 'base_rate_trap': return bayesQuestion(seed, difficulty, kind)
    case 'expected_value': return evQuestion(seed, difficulty)
    case 'evidence_strength': return evidenceStrengthQuestion(seed, difficulty)
    case 'sequence_update': return sequenceQuestion(seed, difficulty)
  }
}

export function validateQuestion(question: Question): string[] {
  const errors: string[] = []
  if (question.options.length !== 4) errors.push('must have exactly four options')
  if (!question.options.some((item) => item.id === question.correctOptionId)) errors.push('correct answer missing')
  if (new Set(question.options.map((item) => item.id)).size !== 4) errors.push('option ids not unique')
  if (new Set(question.options.map((item) => item.label)).size !== 4) errors.push('option labels not unique')
  if (!question.prompt.trim() || !question.explanation.body.trim()) errors.push('content missing')
  const visual = question.explanation.visual
  if (visual.type === 'frequency' && (visual.truePositive < 0 || visual.falsePositive < 0 || visual.truePositive + visual.falsePositive > visual.total)) errors.push('invalid frequency visual')
  if (visual.type === 'dots' && (visual.highlighted < 0 || visual.highlighted > visual.total)) errors.push('invalid dot visual')
  if (question.difficulty < 1 || question.difficulty > 5) errors.push('invalid difficulty')
  return errors
}

export function allQuestionKinds(): QuestionKind[] {
  return Object.keys(KIND_SKILL) as QuestionKind[]
}
