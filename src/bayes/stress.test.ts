import { allQuestionKinds, generateQuestion, validateQuestion } from './questions'

describe('one-million-question offline stress generation', () => {
  it('produces zero invalid or ambiguous questions', () => {
    const kinds = allQuestionKinds()
    let invalid = 0
    for (let index = 0; index < 1_000_000; index += 1) {
      const kind = kinds[index % kinds.length]
      const difficulty = ((Math.floor(index / kinds.length) % 5) + 1) as 1 | 2 | 3 | 4 | 5
      const question = generateQuestion(index + 1, kind, difficulty)
      if (validateQuestion(question).length) invalid += 1
    }
    expect(invalid).toBe(0)
  }, 120_000)
})

