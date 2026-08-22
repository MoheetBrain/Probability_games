# PROJECTION V1

PROJECTION is a local, single-screen abstract board game about seeing a probability distribution move through space. A hidden Ghost occupies one of 49 squares and carries directional momentum. The board is divided into five explicit sectors, A–E, with public priors and a public noisy likelihood map.

Every turn has exactly one action:

- `MOVE` — move the Hunter one square for free. This changes trap geometry, not the evidence signal.
- `SAMPLE` — spend 1 chip for a private evidence token describing the Ghost's current sector. The Ghost then moves once.
- `TRAP` — choose a square within Chebyshev distance 2, stake 1–3 chips, then predict the Ghost's next square. The Ghost moves before the trap resolves.

The first player to 5 captures wins. A trap returns 3×stake chips on a hit and loses the stake on a miss. Net expected value is:

```text
EV = p(2s) − (1 − p)s = s(3p − 1)
break-even p = 1/3
```

Coach Mode reveals the engine's hit probability and EV only after a trap. Normal play shows priors, evidence, token age, and the public movement law; it never shows the posterior or a heatmap. Debug Mode exposes the exact hidden-state filter, predictive grid, sector posterior, legal-trap EV, and bot filter.

## Run it

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://127.0.0.1:5173/`.

Checks:

```bash
npm test       # exact filter tests, 100,000 sampling checks, 10,000 bot matches
npm run build  # type-check and production build
```

## Rules in under 90 seconds

1. Read the prior bars for sectors A–E. They are the starting probability mass.
2. Tap a sector in `SIGNAL MAP` to inspect its public token likelihoods.
3. Use `SAMPLE` when one more clue is worth a chip. The evidence log keeps every private token and its transition age.
4. Use `MOVE` to change where a trap can reach. Movement itself gives no evidence.
5. Use `TRAP`, select a highlighted future square, choose a stake, and commit. The Ghost moves first.
6. Treat `1/3` as the trap break-even threshold. A higher stake increases both upside and ruin risk.

At Level 1 the field has two sectors, strong evidence, and a stationary Ghost. Each capture advances the statistical structure: slow movement, full Markov movement, weaker signals, conflicting signals, extreme priors, and finally full Duel opposition.

## Hidden-state model

The five sectors are assigned explicitly by `sectorForCell(row, col)` in `src/projection/sectors.ts`. A 7×7 board has 10 cells in A, 10 in B, 9 in C, 10 in D, and 10 in E. No cell is unassigned or shared.

The hidden state is position × direction. Directions are N, NE, E, SE, S, SW, W, NW. The public transition law is:

```text
60% continue
20% turn left 45°
20% turn right 45°
```

Illegal edge transitions are removed and the remaining weights are renormalised. If all three momentum candidates are off-board at a corner, legal neighbouring directions share the mass equally. Level 2 uses an 80/10/10 slow law; Level 1 holds position to isolate evidence learning.

The player filter stores a normalized distribution over 7×7×8 states. On token `E`:

```text
P(s | E) ∝ P(E | sector(s)) P(s)
```

Then the filter propagates through the exact transition kernel. Trap probabilities use the predictive position distribution after that transition, so the coach probability is the probability of `S(t+1)`, not the current Ghost square.

## Duel and bot

Solo Survival is the default. Duel is an optional mode. The bot receives the same public scenario but different private evidence; it never receives the true Ghost state or the player's tokens. It uses the same exact discrete filter and one of three transparent personalities:

- Conservative: samples longer and traps only at higher probability;
- Balanced: a middle threshold;
- Aggressive: accepts lower-probability, higher-variance traps.

Bot actions are public while bot evidence remains private, allowing opponent modelling to emerge from the board.

## Architecture

```text
src/
  projection/
    types.ts          hidden state, scenarios, actions, and game state
    constants.ts      board, directions, levels, and evidence metadata
    sectors.ts        explicit 49-cell → 5-sector mapping
    ghost.ts          movement kernel, spawning, samples, geometry
    bayes.ts          exact position × direction filter and prediction
    scenario.ts       priors, likelihood matrices, and level progression
    engine.ts         pure actions, chips, traps, captures, and simulation
    bot.ts            belief-only bot strategy/personality thresholds
    ProjectionBoard.tsx  7×7 board interaction and sector rendering
    projection.test.ts   mathematical, privacy, and Monte Carlo tests
  App.tsx             one-screen React UI
  styles.css          physical board visual system
```

## Validation and design metrics

The test suite validates sector coverage, prior and likelihood normalization, empirical hidden-state and evidence frequencies, Bayes updates, sequential updates, transition mass conservation, boundary renormalization, trap timing, EV, chip safety, board bounds, bot privacy, and capture rules. It runs 100,000 generated sampling rounds and 10,000 bot-vs-random Duel matches; the bot must win more matches than the random player.

The next useful playtest measures game length, samples per capture, moves per capture, traps per capture, average stake, miss rate, ruin rate, and capture rate. `MOVE` should remain a positioning decision rather than a way to search for information. If move frequency becomes dominant, the spatial mechanic should be reduced rather than protected.

## Preserved experiments

The exact HUNT V0 recovery copy is read-only at `legacy/HUNT-V0-FROZEN/`. The exact PRIORS V1 recovery copy is read-only at `legacy/PRIORS-V1-FROZEN/`. The original ORACLE dashboard remains at `legacy/oracle-dashboard-v0/`. Git is not initialized in this workspace, so immutable filesystem copies are used instead of branches and tags.
