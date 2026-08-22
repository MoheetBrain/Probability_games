import { bayesPosterior, expectedValue, generateQuestion, allQuestionKinds, validateQuestion } from './questions'
import { createProfile, difficultyForSkill, selectQuestion, updateProfile } from './player'

describe('validated probability engine', () => {
  it('calculates Bayes independently of question copy', () => {
    expect(bayesPosterior(.01, .9, .1)).toBeCloseTo(9 / 108, 12)
    expect(bayesPosterior(.1, .8, .2)).toBeCloseTo(8 / 26, 12)
  })

  it('calculates expected value from every outcome', () => {
    expect(expectedValue([{ probability: .8, payoff: 10 }, { probability: .2, payoff: -5 }])).toBe(7)
    expect(expectedValue([{ probability: .2, payoff: 100 }, { probability: .8, payoff: -5 }])).toBe(16)
  })

  it('generates every question type with one distinct correct answer', () => {
    for (const kind of allQuestionKinds()) {
      for (let seed = 1; seed <= 500; seed += 1) {
        const question = generateQuestion(seed, kind, ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5)
        expect(validateQuestion(question), `${kind} seed ${seed}`).toEqual([])
        expect(question.options.filter((option) => option.id === question.correctOptionId)).toHaveLength(1)
      }
    }
  })

  it('keeps frequency visuals consistent with the displayed posterior', () => {
    for (const kind of ['visual_bayes', 'numerical_bayes', 'base_rate_trap', 'frequency_table'] as const) {
      for (let seed = 1; seed <= 500; seed += 1) {
        const question = generateQuestion(seed, kind, 3)
        const visual = question.explanation.visual
        expect(visual.type).toBe('frequency')
        if (visual.type !== 'frequency') continue
        const correct = question.options.find((option) => option.id === question.correctOptionId)
        const displayed = Number(correct?.label.replace('%', ''))
        const derived = visual.truePositive / (visual.truePositive + visual.falsePositive) * 100
        expect(displayed).toBeCloseTo(derived, 0)
      }
    }
  })
})

describe('adaptive player model', () => {
  it('raises mastery and flow on success without exceeding bounds', () => {
    const profile = createProfile()
    const question = generateQuestion(10, 'complement', 1)
    const next = updateProfile(profile, question, true, 2_000)
    expect(next.skills.complements).toBeGreaterThan(profile.skills.complements)
    expect(next.flow).toBeGreaterThan(profile.flow)
    expect(next.schedule.complements.dueAt).toBeGreaterThan(next.questionsAnswered)
  })

  it('diagnoses mistakes and schedules a near retry', () => {
    const profile = createProfile()
    const question = generateQuestion(11, 'conditional_interpretation', 1)
    const wrong = question.options.find((option) => option.misconception === 'reverseConditional')!
    const next = updateProfile(profile, question, false, 4_000, wrong.misconception)
    expect(next.misconceptions.reverseConditional).toBe(1)
    expect(next.schedule.conditionalProbability.interval).toBe(2)
    expect(next.streak).toBe(0)
  })

  it('maps mastery to five controlled difficulty bands', () => {
    expect([0, 24, 25, 44, 45, 64, 65, 81, 82, 100].map(difficultyForSkill)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it('begins with low-friction questions', () => {
    const profile = createProfile()
    for (let index = 0; index < 4; index += 1) {
      expect(['choose_probability', 'complement', 'conditional_interpretation']).toContain(selectQuestion(profile, 123, index).kind)
    }
  })
})

