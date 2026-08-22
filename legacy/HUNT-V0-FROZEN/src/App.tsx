import { useEffect, useMemo, useRef, useState } from 'react'
import { normalisedEntropy, nextSquareDistribution, probabilityOfNextSquare, expectedTrapValue } from './game/bayes'
import { BOARD_SIZE, CAPTURES_TO_WIN } from './game/constants'
import { applyAction, applyBotTurn, createInitialGame } from './game/engine'
import { chebyshevDistance, legalHunterMoves, samePosition } from './game/ghost'
import { loadStats, recordGame, saveStats } from './game/storage'
import type { Action, GameState, Position, Stats } from './game/types'
import { Board, actionLabel, type BoardMode } from './components/Board'
import { CoachFeedback } from './components/CoachFeedback'
import { Controls } from './components/Controls'
import { CapturePips, Energy } from './components/Energy'

function coordinate(position: Position): string {
  return `${String.fromCharCode(65 + position.col)}${position.row + 1}`
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function topProbabilities(grid: number[][], limit = 5): Array<{ position: Position; probability: number }> {
  const cells: Array<{ position: Position; probability: number }> = []
  for (let row = 0; row < BOARD_SIZE; row += 1) for (let col = 0; col < BOARD_SIZE; col += 1) cells.push({ position: { row, col }, probability: grid[row][col] })
  return cells.sort((a, b) => b.probability - a.probability).slice(0, limit)
}

function DebugDock({ game }: { game: GameState }) {
  const playerNext = nextSquareDistribution(game.playerBelief)
  const botNext = nextSquareDistribution(game.botBelief)
  const playerTargets = topProbabilities(playerNext).filter(({ position }) => chebyshevDistance(game.player.position, position) <= 2)
  return (
    <section className="debug-dock">
      <div className="debug-heading"><span>DEVELOPER LENS</span><b>LIVE / TRUE STATE EXPOSED</b></div>
      <div className="debug-facts">
        <span>GHOST</span><strong>{coordinate(game.ghost.position)} · {game.ghost.direction}</strong>
        <span>ENTROPY P / B</span><strong>{percent(normalisedEntropy(game.playerBelief.grid))} · {percent(normalisedEntropy(game.botBelief.grid))}</strong>
        <span>NEXT P / B</span><strong>{topProbabilities(playerNext, 3).map((item) => `${coordinate(item.position)} ${percent(item.probability)}`).join(' · ')}</strong>
      </div>
      <div className="debug-probabilities">
        <span>LEGAL TRAP · PLAYER HIT PROBABILITY / EV BY STAKE</span>
        {playerTargets.length === 0 && <small>No high-mass legal targets.</small>}
        {playerTargets.map(({ position, probability }) => <div key={coordinate(position)}><b>{coordinate(position)}</b><span>{percent(probability)}</span><span>{[1, 2, 3].map((stake) => `×${stake} ${expectedTrapValue(probability, stake) >= 0 ? '+' : '−'}${Math.abs(expectedTrapValue(probability, stake)).toFixed(1)}`).join(' · ')}</span></div>)}
      </div>
      <div className="debug-foot">Player heatmap is the cell fill. Bot heatmap is the cell outline. Values are hidden when DEBUG is off.</div>
    </section>
  )
}

function Header({ game, stats, onNew, onDebug, onCoach }: { game: GameState; stats: Stats; onNew: () => void; onDebug: () => void; onCoach: () => void }) {
  return (
    <header className="hunt-header">
      <button className="hunt-wordmark" onClick={onNew} aria-label="Start a new hunt"><span className="wordmark-symbol">◌</span><strong>HUNT</strong><small>V0 / ONE BOARD</small></button>
      <div className="match-score">
        <div><span className="score-label player-text">YOU</span><CapturePips captures={game.player.captures} /></div>
        <div><span className="score-label bot-text">BOT</span><CapturePips captures={game.bot.captures} /></div>
      </div>
      <div className="header-tools">
        <span className="stat-line">{stats.gamesPlayed} {stats.gamesPlayed === 1 ? 'hunt' : 'hunts'} · {stats.wins} wins</span>
        <button className={`small-toggle ${game.coachMode ? 'active' : ''}`} onClick={onCoach}><i />COACH</button>
        <button className={`small-toggle ${game.debug ? 'active debug-active' : ''}`} onClick={onDebug}><i />DEBUG</button>
      </div>
    </header>
  )
}

function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame())
  const [stats, setStats] = useState<Stats>(() => loadStats())
  const [mode, setMode] = useState<BoardMode>('idle')
  const [trapTarget, setTrapTarget] = useState<Position | undefined>()
  const [stake, setStake] = useState<1 | 2 | 3>(1)
  const [coachVisible, setCoachVisible] = useState(false)
  const recorded = useRef(false)

  const playerTurn = game.activePlayer === 'player' && !game.gameOver
  const lastEvent = game.publicEvents[game.publicEvents.length - 1]

  useEffect(() => {
    if (game.activePlayer !== 'bot' || game.gameOver) return undefined
    const timer = window.setTimeout(() => setGame((current) => applyBotTurn(current)), 520)
    return () => window.clearTimeout(timer)
  }, [game.activePlayer, game.gameOver, game.turn])

  useEffect(() => {
    if (!game.lastResolution) return undefined
    setCoachVisible(true)
    const timer = window.setTimeout(() => setCoachVisible(false), 3600)
    return () => window.clearTimeout(timer)
  }, [game.lastResolution])

  useEffect(() => {
    if (!game.gameOver || recorded.current) return
    const nextStats = recordGame(stats, game)
    setStats(nextStats)
    saveStats(nextStats)
    recorded.current = true
  }, [game, stats])

  const nextPlayerHeat = useMemo(() => nextSquareDistribution(game.playerBelief), [game.playerBelief])
  const nextBotHeat = useMemo(() => nextSquareDistribution(game.botBelief), [game.botBelief])

  const beginNewGame = () => {
    recorded.current = false
    setGame(createInitialGame())
    setMode('idle')
    setTrapTarget(undefined)
    setStake(1)
    setCoachVisible(false)
  }

  const dispatch = (action: Action) => {
    if (!playerTurn) return
    setGame((current) => applyAction(current, action))
    setMode('idle')
    setTrapTarget(undefined)
    setStake(1)
  }

  const onCellClick = (position: Position) => {
    if (!playerTurn) return
    if (mode === 'move') {
      dispatch({ type: 'move', to: position })
    } else if (mode === 'trap') {
      setTrapTarget(position)
    }
  }

  const confirmScan = () => dispatch({ type: 'scan' })
  const placeTrap = () => trapTarget && dispatch({ type: 'trap', target: trapTarget, stake })

  const playerTargets = topProbabilities(nextPlayerHeat).filter(({ position }) => chebyshevDistance(game.player.position, position) <= 2)
  const privateScan = game.playerLastScan ? `PRIVATE SCAN · ${game.playerLastScan.result.toUpperCase()}` : 'NO PRIVATE SIGNAL YET'
  const turnStatus = game.gameOver
    ? game.outcome?.winner === 'player' ? 'YOU HUNTED THE GHOST' : 'THE BOT OUTLASTED YOU'
    : game.activePlayer === 'player' ? 'YOUR TURN · PICK ONE ACTION' : 'BOT TURN · THE GHOST IS MOVING'

  return (
    <div className="hunt-app">
      <Header game={game} stats={stats} onNew={beginNewGame} onDebug={() => setGame((current) => ({ ...current, debug: !current.debug }))} onCoach={() => setGame((current) => ({ ...current, coachMode: !current.coachMode }))} />
      <main className="hunt-main">
        <section className="match-strip">
          <Energy label="YOU" energy={game.player.energy} captures={game.player.captures} accent="player" />
          <div className="turn-console">
            <span className="turn-kicker">HUNT / FIELD SIGNAL</span>
            <strong>{turnStatus}</strong>
            <span className="turn-number">TURN {String(game.turn).padStart(2, '0')} · {privateScan}</span>
            <div className="last-event">{actionLabel(game.lastAction)}{lastEvent?.result && <b className={lastEvent.result === 'hit' ? 'hit-text' : 'miss-text'}> · {lastEvent.result.toUpperCase()}</b>}</div>
          </div>
          <Energy label="BOT" energy={game.bot.energy} captures={game.bot.captures} accent="bot" />
        </section>

        <section className="play-area">
          <Board game={game} mode={mode} pendingTrap={trapTarget} captureReveal={game.lastResolution?.revealedGhost} playerBelief={nextPlayerHeat} botBelief={nextBotHeat} onCellClick={onCellClick} />
          <div className="side-rail">
            <div className="side-card objective-card"><span className="side-eyebrow">OBJECTIVE</span><strong>5 captures</strong><p>Predict the Ghost's next square before your energy runs out.</p><div className="capture-track"><span>YOU</span><CapturePips captures={game.player.captures} /><span>BOT</span><CapturePips captures={game.bot.captures} /></div></div>
            <div className="side-card law-card"><span className="side-eyebrow">MOVEMENT LAW</span><div className="law-row"><b>60%</b><span>continue</span></div><div className="law-row"><b>20%</b><span>turn left</span></div><div className="law-row"><b>20%</b><span>turn right</span></div><small>Edges renormalise. Momentum is public.</small></div>
            <div className="side-card signal-card"><span className="side-eyebrow">EVIDENCE</span><strong>{game.playerLastScan ? game.playerLastScan.result.toUpperCase() : '—'}</strong><p>{game.playerLastScan ? 'Private to you. Warm is evidence, not certainty.' : 'Scan the 3 × 3 field to get a noisy signal.'}</p></div>
          </div>
        </section>

        <CoachFeedback resolution={game.coachMode ? game.lastResolution : undefined} visible={coachVisible} />
        <Controls enabled={playerTurn} mode={mode} trapTarget={trapTarget} stake={stake} energy={game.player.energy} onMode={(nextMode) => { setMode(nextMode); if (nextMode !== 'trap') setTrapTarget(undefined) }} onConfirmScan={confirmScan} onStake={setStake} onPlaceTrap={placeTrap} />

        <div className="bottom-status"><span><i className="status-dot" />LOCAL / NO NETWORK</span><span>ONE ACTION · ONE GHOST MOVE</span><span>WIN AT {CAPTURES_TO_WIN} CAPTURES · LOSE AT 0 ENERGY</span></div>

        {game.debug && <DebugDock game={game} />}

        {game.gameOver && (
          <section className={`game-over ${game.outcome?.winner === 'player' ? 'you-won' : 'bot-won'}`}>
            <span className="game-over-kicker">HUNT RESOLVED</span>
            <strong>{game.outcome?.winner === 'player' ? 'YOU WIN' : 'BOT WINS'}</strong>
            <span>{game.outcome?.reason === 'captures' ? 'Five captures. The hidden path was read.' : `RUIN — ${game.outcome?.winner === 'player' ? 'bot' : 'you'} ran out of energy.`}</span>
            <button onClick={beginNewGame}>ONE MORE HUNT <span>↗</span></button>
          </section>
        )}
      </main>
      <footer className="hunt-footer"><span>HUNT V0</span><span>GOOD READ ≠ GUARANTEED HIT</span><span>LOCAL SESSION · {stats.gamesPlayed} COMPLETE</span></footer>
    </div>
  )
}

export default App
