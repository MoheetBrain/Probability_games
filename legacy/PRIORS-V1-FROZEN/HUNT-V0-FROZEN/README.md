# HUNT V0

HUNT is a local, single-screen abstract board game about predicting the next position of a hidden Ghost.

It has one board, three actions, and one resource:

- `MOVE` one square like a chess king for free.
- `SCAN` the 3 × 3 region around your Hunter for 1 energy. The result is private and noisy: inside is 80% WARM / 20% COLD; outside is 20% WARM / 80% COLD.
- `TRAP` a square within Chebyshev distance 2, then stake 1, 2, or 3 energy. The Ghost moves before the trap resolves. A hit returns 3 × stake energy and adds one capture; a miss loses the stake.

First to 5 captures wins. Reaching 0 energy causes ruin. The Bot follows the same rules and uses only its own Bayesian filter plus public events; it never receives the true Ghost position.

## Run it

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm test       # mathematical/unit tests plus 10,000 simulated matches
npm run build  # type-check and production build
```

## The hidden world

The board is 7 × 7, with columns A–G and rows 1–7. Hunters cannot occupy the same square. The Ghost starts on a random legal square with a random heading.

After every action the Ghost moves one square using its public momentum law:

```text
60% continue in the current direction
20% turn 90° left
20% turn 90° right
```

Illegal edge moves are renormalised across legal options. At a corner where all three momentum choices point off-board, the legal neighbouring directions share the probability equally. There is no teleporting.

## Bayesian engine

Normal play never shows a heatmap and never asks the player to enter a percentage. The player forms an intuition from scans, movement momentum, trap results, and the Bot's public behaviour.

Internally each side owns a private exact filter. It stores a joint distribution over 49 positions × 8 directions, derives the required `BeliefGrid` position marginal, applies the WARM/COLD likelihoods, propagates mass through the Ghost transition kernel, and conditions public trap misses away from the missed square.

Coach Mode is on by default. After a trap resolves, it briefly reports the estimate that existed at decision time and the resulting expected value. The review arrives after the action, never before it.

Debug Mode is off by default. It exposes the true Ghost position and direction, both heatmaps on the board, entropy, next-square probabilities, legal trap probabilities, and EV by stake.

## Architecture

```text
src/
  game/
    types.ts       domain types
    constants.ts   board, movement, and rule constants
    ghost.ts       movement law, scans, geometry
    bayes.ts       exact joint filter and EV helpers
    bot.ts         transparent belief-only Bot strategy
    engine.ts      pure action resolution and simulation
    storage.ts     optional localStorage stats
  components/
    Board.tsx
    Controls.tsx
    CoachFeedback.tsx
    Energy.tsx
  App.tsx          one-screen React UI
  styles.css       physical-board visual system
```

The previous ORACLE dashboard is preserved in `legacy/oracle-dashboard-v0`.

## Verification

The test suite covers belief normalisation, WARM/COLD Bayes updates, edge renormalisation, movement mass conservation, trap timing, EV, energy/ruin, capture reset, scan privacy, and the Bot context boundary. It also runs 10,000 complete simulated matches and asserts that no state contains NaN, Infinity, or negative belief mass.

## Local-first scope

HUNT has no server, authentication, database, network request, LLM, or online multiplayer. Only basic completed-game statistics are stored locally: games, wins, losses, captures, ruins, and average remaining energy.

Possible future experiments are deliberately deferred: multiple Ghosts, terrain, hidden Ghost personalities, online multiplayer, ranked play, campaigns, cards, powerups, and procedural maps.
