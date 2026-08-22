# PRIORS V1

PRIORS is a local, single-screen board game about making decisions under uncertainty. Five hypothesis lanes are visible, exactly one state is secretly true, and every turn asks the player to choose between:

- `SAMPLE` — spend 1 chip to receive one noisy evidence stone;
- `BET` — choose a hypothesis and stake 1–3 chips.

The objective is to reach 20 points before losing all 10 chips. A correct bet scores `stake × 2` points. It also returns `stake × multiplier` chips, where the multiplier is derived from the displayed base rate with a modest house compression: common states pay less and rare states pay more. A wrong bet loses the stake.

The core loop is deliberately small:

```text
prior → evidence → posterior (in your head) → expected value → bet
```

The UI shows base rates and evidence only during normal play. The exact posterior appears only after a bet, in Coach Mode, so feedback calibrates the decision rather than solving it beforehand.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

Useful checks:

```bash
npm test       # Bayesian tests plus 100,000 generated-round checks
npm run build  # type-check and production build
```

## Rules in under 30 seconds

1. Read the five base rates at the top of the lanes. They sum to 100%.
2. Press `SAMPLE` to spend one chip and reveal a coloured evidence token. Samples are conditionally independent and noisy; reliability changes from round to round.
3. Press `BET`, choose a live lane, choose a stake, and commit. The hidden state is revealed immediately.
4. A correct bet gives points and an odds-based chip return. A miss loses the stake.
5. Continue until 20 points or 0 chips. Difficulty progresses through eight statistical structures, beginning with two states and highly diagnostic evidence.

Coach Mode is on by default. Debug Mode is off by default and exposes the hidden state, likelihood matrix, posterior after every sample, entropy, and EV by stake for development review.

## Mathematical model

Each round has a prior vector `P(H)` and a 5 × 5 likelihood matrix. If evidence token `E` arrives:

```text
P(Hᵢ | E) = P(E | Hᵢ) P(Hᵢ) / Σⱼ P(E | Hⱼ) P(Hⱼ)
```

Sequential samples use the previous posterior as the next prior. Evidence reliability is generated between approximately 55% and 90%; the off-diagonal likelihood mass is renormalised across the other tokens. Hidden-state and evidence sampling both use the same weighted categorical sampler used by the pure engine.

For a chosen state with base rate `p`, the chip return multiplier is:

```text
min(12, max(2, round(1 + 0.45 / p)))
```

Expected chip value for stake `s` and posterior belief `q` is:

```text
EV = q × s × multiplier − s
```

This makes base rate, evidence strength, sample count, and stake size interact without a probability slider or automatic heatmap.

## Architecture

```text
src/
  priors/
    types.ts       round, state, evidence, and action types
    constants.ts   lanes, chips, profiles, and visual evidence metadata
    math.ts        normalisation, Bayes, entropy, payout, and EV
    rounds.ts      progressive round generation and evidence sampling
    engine.ts      pure solo round/game resolution
    bot.ts         belief-only bot context and transparent strategy
    priors.test.ts mathematical and generated-round validation
  App.tsx          one-screen board UI
  styles.css       physical board visual system
```

The previous HUNT implementation is preserved at `legacy/HUNT-V0-FROZEN/`. The original ORACLE dashboard remains at `legacy/oracle-dashboard-v0/`.

## Experiments still needed

The V1 prototype should be play-tested for whether base-rate neglect, overreaction to a single token, and wasteful sampling are measurably worse strategies. The difficulty schedule and payout compression need calibration against real players. A simple Duel mode is the next experiment: both sides share the priors and likelihood matrix, receive different private evidence, and alternate SAMPLE or BET. Correlated evidence, variance, confidence intervals, and richer causal models are deliberately deferred.

There is no server, authentication, database, network request, LLM, or online multiplayer.
