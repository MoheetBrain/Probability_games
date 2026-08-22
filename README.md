# BAYES V1

BAYES is a fast, visual probability-learning game. It turns statistical practice into a loop of tiny puzzles:

```text
question → four choices → commit → visual explanation → next
```

The design target is **correct statistical intuitions per minute**. Early questions are deliberately easy, arithmetic stays secondary, wrong answers diagnose a likely reasoning pattern, and the scaffolding adapts as mastery rises.

## Play

```bash
npm install
npm run dev
```

Desktop keys: `1`–`4` answer and `Enter` continues. Touch targets and layout are mobile-first.

## MVP scope

The deterministic template system produces more than 100 question variants across:

- basic probability and complements;
- conditional notation and reference classes;
- joint and union probability;
- base-rate traps;
- natural-frequency and numerical Bayes;
- evidence strength and sequential updating;
- expected value.

Every generated question has four distinct options. Distractors encode misconceptions such as conditional reversal, base-rate neglect, denominator neglect, independence errors, add-vs-multiply errors, complement errors, and payoff bias.

## Modes

- **Daily 10** — a deterministic daily set with an end-of-session skill summary.
- **Endless** — uninterrupted adaptive questions.

Progress is stored locally. The player model tracks eight separate skills, misconception frequency, response time, hints, streak, Flow, XP, confidence calibration, and spaced-repetition due dates. Selection uses a transparent heuristic combining weakness, review timing, novelty, detected misconceptions, and a small seeded variation. There are no hearts or speed penalties.

## Architecture

```text
src/
  bayes/
    types.ts             question, visual, player, and session contracts
    random.ts            deterministic seeded generation
    questions.ts         validated templates, distractors, and pure maths
    player.ts            adaptive mastery and spaced-repetition model
    storage.ts           version-one local persistence
    Visual.tsx           reusable probability representations
    questions.test.ts    engine and adaptation tests
    stress.test.ts       one-million-question ambiguity test
  App.tsx                Daily, Endless, feedback, hints, stats, keyboard loop
  styles.css             responsive visual system and game feel
```

Question generation never depends on an LLM. Each template derives its answer, misconception-aware distractors, explanation, and visual from the same validated parameters.

## Curriculum path

The V1 engine establishes the first six curriculum worlds and previews later concepts:

1. Probability intuition
2. AND / OR
3. Conditional probability
4. Base rates
5. Bayes with natural frequencies
6. Formal Bayes
7. Sequential Bayes
8. Likelihood ratios
9. Expected value

Future scaffolding stages can reuse the same templates while replacing four choices with numeric entry and, later, constructed reasoning.

## Validation

```bash
npm test
npm run test:stress
npm run build
```

The stress suite generates 1,000,000 questions offline and requires zero invalid or ambiguous option sets. Tests also independently verify Bayes and EV calculations, visual-frequency consistency, difficulty bounds, misconception updates, and adaptive review behavior.

## Frozen experiments

The first three games are preserved and must not be rewritten:

- `legacy/HUNT-V0-FROZEN/`
- `legacy/PRIORS-V1-FROZEN/`
- `legacy/PROJECTION-V1-FROZEN/`

Repository tags `hunt-v0-frozen`, `priors-v1-frozen`, and `projection-v1-frozen` point to the shared preservation commit. BAYES development lives on `bayes-v1`.

