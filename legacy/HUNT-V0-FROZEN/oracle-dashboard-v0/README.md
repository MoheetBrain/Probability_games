# ORACLE V0

ORACLE is a local, single-player prediction game about inferring a hidden state from noisy evidence, assigning probabilities, and sizing risk without going broke.

## Run it

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm test       # 10 engine and persistence tests
npm run build  # type-check and production build
```

## Architecture

- `src/game/types.ts` — domain types for beliefs, observations, opportunities, turns, and lifetime stats.
- `src/game/data.ts` — the reusable signal library, opportunity library, starting prior, and Markov transition matrix.
- `src/game/engine.ts` — pure game and scoring functions. This is intentionally independent from React so the math can be tested directly.
- `src/game/storage.ts` — localStorage load/save and lifetime aggregation.
- `src/App.tsx` — the run loop, screens, and interaction state.
- `src/styles.css` — the dark observatory / strategy-terminal visual system.

## Game rules

Each run begins with £10,000: £3,000 protected reserve and £7,000 risk capital. A 20-turn run repeatedly asks the player to:

1. Read 2–4 noisy signals.
2. Assign probabilities to Growth, Stable, and Decline.
3. Optionally purchase more information (£100, then £200, then £400…).
4. Choose an opportunity and risk £0–all available risk capital, or wait.
5. See the hidden state resolve and receive separate outcome and reasoning feedback.

The hidden state persists through a slightly varied Markov transition matrix. Signal likelihoods are informative but imperfect. Opportunity multipliers vary across turns and include safe, high-EV, asymmetric, and negative-EV structures.

The reserve cannot be used by ordinary bets. If risk capital is exhausted, the reserve unlocks as emergency runway. Ruin occurs when all playable capital falls to £50 or less.

## Scoring formulas

### Brier / Forecast Quality

For a three-state forecast `p` and one-hot outcome `o`:

```text
Brier = (pGrowth - oGrowth)²
      + (pStable - oStable)²
      + (pDecline - oDecline)²

Forecast Quality = 100 × (1 - Brier / 2)
```

Forecast Quality measures the forecast against the resolved state, including the role of luck. The decision score keeps that separate from the bet decision.

### Expected value

```text
EV = Σ forecast[state] × (multiplier[state] - 1)
```

EV is calculated from the player’s own forecast, not the revealed outcome. The UI uses it to explain whether a bet was supported by the player’s stated beliefs.

### Decision Quality

Decision Quality combines:

- forecast quality: 30%;
- EV alignment: 25%;
- bet sizing: 20%;
- risk control: 15%;
- Bayesian updating: 10%.

Sizing uses a small log-growth search over stake fractions to find a conservative reference position. It is a guide, not a claim of academic optimality. Calibration is an intentionally lightweight running error score for V0; the end-of-run profile also reports the average quality of updating, sizing, risk control, and information use.

### Oracle Rating

Lifetime rating starts at 500 and changes primarily from average Decision Quality. Capital affects the run report, but a lucky windfall is not enough to build a strong rating.

## Debug mode

The `DEBUG` toggle in the top-right is off by default. When enabled it exposes the true state, reference posterior, current transition matrix, signal likelihoods, and reference EV so the game loop can be inspected while tuning.

## Current limitations

This is deliberately a V0. It has no backend, authentication, real financial data, fake companies, LLM news, AI opponents, multiplayer, procedural narrative, reinforcement learning, or persistent economy. A run is not resumed after a refresh; only lifetime statistics are persisted.

The adaptive difficulty hooks are represented by the run’s varied signals and opportunities, but do not yet materially retune the generator from player weaknesses. The calibration metric is useful for feedback but is not a full reliability diagram or statistical calibration study.

## Suggested V1 improvements

- Add a short guided first run that teaches base rates, evidence strength, and position sizing without introducing textbook notation.
- Turn the current weakness profile into slow, deterministic difficulty weighting for future signal and opportunity selection.
- Add a compact history timeline so players can inspect forecast, scan, EV, stake, and outcome across all 20 turns.
- Tune the opportunity library with playtest data and add a small number of unlockable world regimes.
- Add exportable local run reports while keeping the core experience private and local-first.
