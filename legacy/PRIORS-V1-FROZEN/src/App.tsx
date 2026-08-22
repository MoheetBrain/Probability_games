import { useEffect, useMemo, useState } from 'react'
import { EVIDENCE_META, INITIAL_CHIPS, MAX_STAKE, POINTS_TO_WIN, STATE_META } from './priors/constants'
import { applyAction, createInitialGame } from './priors/engine'
import { allExpectedValues, expectedValueForState, maxStake, normalisedEntropy, payoutMultiplier } from './priors/math'
import { applyDuelBotTurn, createInitialDuel } from './priors/duel'
import { DuelView } from './priors/duelView'
import type { DuelGameState, GameState, PlayerAction } from './priors/types'
import './styles.css'

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

function signed(value: number): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`
}

function Chips({ count, muted = false }: { count: number; muted?: boolean }) {
  return (
    <div className={`chip-tray${muted ? ' muted' : ''}`} aria-label={`${count} chips remaining`}>
      {Array.from({ length: INITIAL_CHIPS }, (_, index) => <i key={index} className={index < count ? 'chip-filled' : ''} />)}
      <b>{count}</b>
    </div>
  )
}

function EvidenceToken({ type, small = false }: { type: (typeof EVIDENCE_META)[number]['id']; small?: boolean }) {
  const meta = EVIDENCE_META.find((item) => item.id === type) ?? EVIDENCE_META[0]
  return <span className={`evidence-token ${meta.className}${small ? ' small' : ''}`} title={meta.name}>{meta.symbol}</span>
}

function Lane({
  state,
  prior,
  evidence,
  selected,
  active,
  revealed,
  onSelect,
}: {
  state: number
  prior: number
  evidence: Array<(typeof EVIDENCE_META)[number]['id']>
  selected: boolean
  active: boolean
  revealed: boolean
  onSelect: () => void
}) {
  const multiplier = payoutMultiplier(prior)
  return (
    <button
      className={`hypothesis-lane${active ? '' : ' inactive'}${selected ? ' selected' : ''}${revealed ? ' revealed' : ''}`}
      disabled={!active}
      onClick={onSelect}
      aria-label={`Hypothesis ${STATE_META[state].id}, prior ${pct(prior)}`}
    >
      <span className="lane-id">{STATE_META[state].id}</span>
      <strong className="lane-prior">{pct(prior)}</strong>
      <span className="lane-caption">BASE RATE</span>
      <span className="lane-stem" />
      <span className="lane-evidence">
        {evidence.map((type, index) => <EvidenceToken key={`${type}-${index}`} type={type} />)}
        {evidence.length === 0 && <span className="empty-evidence">·</span>}
      </span>
      <span className="lane-payout">PAYS <b>×{multiplier}</b></span>
      {selected && <span className="lane-check">YOUR PICK</span>}
      {revealed && <span className="lane-true">TRUE STATE</span>}
    </button>
  )
}

function Board({ game, betState, onSelectState, onSample, onBet }: {
  game: GameState
  betState: number | undefined
  onSelectState: (state: number) => void
  onSample: () => void
  onBet: () => void
}) {
  const isBetting = game.lastAction === 'bet' ? false : betState !== undefined
  const active = game.phase === 'playing'
  const evidenceByLane = STATE_META.map((_, index) => game.round.evidence.filter((token) => EVIDENCE_META.findIndex((item) => item.id === token.type) === index).map((token) => token.type))
  const revealedState = game.lastOutcome?.hiddenState
  return (
    <section className={`priors-board${game.lastAction === 'sample' ? ' sampled' : ''}${game.lastOutcome?.correct ? ' hit' : ''}`}>
      <div className="board-rail board-rail-top">
        <span>HIDDEN STATE / ONE IS TRUE</span>
        <span>{game.round.difficulty === 1 ? 'BEGINNER FIELD' : `LEVEL ${game.round.difficulty} · ${game.round.difficulty <= 3 ? 'READ THE SIGNAL' : 'WEIGH THE EVIDENCE'}`}</span>
      </div>
      <div className="hypothesis-grid">
        {STATE_META.map((item) => (
          <Lane
            key={item.id}
            state={item.index}
            prior={game.round.priors[item.index]}
            evidence={evidenceByLane[item.index]}
            active={game.round.priors[item.index] > 0}
            selected={betState === item.index}
            revealed={revealedState === item.index}
            onSelect={() => onSelectState(item.index)}
          />
        ))}
      </div>
      <div className="evidence-legend">
        <span className="legend-title">EVIDENCE RECEIVED</span>
        <span className="legend-copy">Each token is a noisy clue. Their order is not a score.</span>
        <div className="legend-tokens">{game.round.evidence.length === 0 ? <span className="no-samples">NO SAMPLES YET</span> : game.round.evidence.map((token) => <EvidenceToken key={token.id} type={token.type} small />)}</div>
      </div>
      <div className="board-rail board-rail-bottom">
        <span>{game.round.evidence.length} {game.round.evidence.length === 1 ? 'OBSERVATION' : 'OBSERVATIONS'} · {pct(game.round.reliability)} SIGNAL RELIABILITY</span>
        <span>{isBetting ? 'CHOOSE A LANE, THEN STAKE' : active ? 'SAMPLE OR COMMIT' : 'ROUND COMPLETE'}</span>
      </div>
      <div className="board-actions">
        <button className="primary-action sample-action" disabled={!active || game.chips < 1 || game.round.evidence.length >= 8} onClick={onSample}>
          <span className="action-symbol">⊙</span><span><b>SAMPLE</b><small>−1 CHIP · REVEAL ONE CLUE</small></span><kbd>S</kbd>
        </button>
        <button className={`primary-action bet-action${isBetting ? ' active' : ''}`} disabled={!active} onClick={onBet}>
          <span className="action-symbol">◇</span><span><b>BET</b><small>{isBetting ? 'PICK A STATE + STAKE' : 'COMMIT YOUR BELIEF'}</small></span><kbd>B</kbd>
        </button>
      </div>
    </section>
  )
}

function CoachReview({ game }: { game: GameState }) {
  const outcome = game.lastOutcome
  if (!outcome || !game.coachMode) return null
  const chosenPosterior = outcome.posterior[outcome.chosenState] ?? 0
  const judgement = outcome.correct
    ? outcome.expectedValue >= 0 ? 'Strong read at those odds.' : 'Correct result, but the price was against you.'
    : outcome.expectedValue >= 0 ? 'Good decision, unlucky draw.' : 'The evidence did not justify that risk.'
  return (
    <div className="coach-review">
      <span className="coach-mark">✦</span>
      <span><b>POSTERIOR BEFORE BET:</b> {STATE_META[outcome.chosenState].id} {pct(chosenPosterior)} · EV {signed(outcome.expectedValue)} · {judgement}</span>
    </div>
  )
}

function ResultStrip({ game, onNext }: { game: GameState; onNext: () => void }) {
  const outcome = game.lastOutcome
  if (!outcome && game.phase === 'gameOver') return <section className="round-result wrong"><div className="result-main"><span className="result-kicker">GAME OVER</span><strong>NO CHIPS LEFT</strong><span>The last sample used your final chip. Information has a price.</span></div><div className="terminal-result loss"><b>{game.points >= POINTS_TO_WIN ? '20 POINTS — YOU WIN' : 'THE ODDS WON THIS GAME'}</b><button onClick={onNext}>NEW GAME ↗</button></div></section>
  if (!outcome) return null
  const resultLabel = outcome.correct ? 'CORRECT READ' : 'WRONG STATE'
  const terminal = game.phase === 'gameOver'
  return (
    <section className={`round-result ${outcome.correct ? 'correct' : 'wrong'}`}>
      <div className="result-main">
        <span className="result-kicker">{resultLabel} · ROUND {String(game.roundNumber).padStart(2, '0')}</span>
        <strong>TRUE STATE: {STATE_META[outcome.hiddenState].id}</strong>
        <span>{outcome.correct ? `+${outcome.stake * 2} points · ${outcome.stake * outcome.multiplier} chips returned at ×${outcome.multiplier}` : `−${outcome.stake} chip${outcome.stake === 1 ? '' : 's'} · the evidence stayed uncertain`}</span>
      </div>
      <div className="result-posterior">
        <span>YOUR CHOICE <b>{STATE_META[outcome.chosenState].id}</b></span>
        {outcome.posterior.map((probability, state) => <div key={state} className={state === outcome.chosenState ? 'choice-bar' : ''}><i style={{ width: `${Math.round(probability * 100)}%` }} /><b>{STATE_META[state].id}</b><span>{pct(probability)}</span></div>)}
      </div>
      {terminal ? <div className={`terminal-result ${game.points >= POINTS_TO_WIN ? 'win' : 'loss'}`}><b>{game.points >= POINTS_TO_WIN ? '20 POINTS — YOU WIN' : 'NO CHIPS — THE ODDS WON'}</b><button onClick={onNext}>NEW GAME ↗</button></div> : <button className="next-round" onClick={onNext}>NEXT ROUND <span>↗</span></button>}
    </section>
  )
}

function DebugPanel({ game }: { game: GameState }) {
  const evs = [1, 2, 3].map((stake) => allExpectedValues(game.round.posterior, game.round.priors, stake))
  return (
    <section className="debug-panel">
      <div className="debug-title"><span>DEVELOPER LENS / FULL POSTERIOR TRACE</span><b>OFF BY DEFAULT</b></div>
      <div className="debug-grid">
        <div><span>TRUE STATE</span><strong>{STATE_META[game.round.hiddenState].id}</strong></div>
        <div><span>RELIABILITY</span><strong>{pct(game.round.reliability)}</strong></div>
        <div><span>ENTROPY</span><strong>{normalisedEntropy(game.round.posterior).toFixed(3)}</strong></div>
        <div><span>EVIDENCE</span><strong>{game.round.evidence.map((token) => EVIDENCE_META.find((item) => item.id === token.type)?.symbol).join(' ') || '—'}</strong></div>
      </div>
      <div className="matrix-wrap"><span>LIKELIHOOD MATRIX / ROW = TRUE STATE, COLUMN = TOKEN</span><table><thead><tr><th>H</th>{EVIDENCE_META.map((item) => <th key={item.id}>{item.symbol}</th>)}</tr></thead><tbody>{game.round.likelihoods.map((row, state) => <tr key={state}><th>{STATE_META[state].id}</th>{row.map((value, index) => <td key={index}>{pct(value)}</td>)}</tr>)}</tbody></table></div>
      <div className="trace-wrap"><span>POSTERIOR AFTER EACH SAMPLE</span><div className="trace-list">{game.round.posteriorHistory.map((posterior, index) => <div key={index}><b>{index === 0 ? 'PRIOR' : `#${index}`}</b>{posterior.map((value, state) => <span key={state}>{STATE_META[state].id} {pct(value)}</span>)}</div>)}</div></div>
      <div className="ev-wrap"><span>EV BY STAKE / CHOSEN STATE</span><div>{STATE_META.map((item) => <span key={item.id}><b>{item.id}</b> {evs.map((row, stake) => <em key={stake}>×{stake + 1} {signed(row[item.index])}</em>)}</span>)}</div></div>
    </section>
  )
}

function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame())
  const [duel, setDuel] = useState<DuelGameState>(() => createInitialDuel())
  const [viewMode, setViewMode] = useState<'solo' | 'duel'>('solo')
  const [betState, setBetState] = useState<number | undefined>()
  const [stake, setStake] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    if (viewMode !== 'duel' || duel.phase !== 'botTurn') return undefined
    const timer = window.setTimeout(() => setDuel((current) => applyDuelBotTurn(current)), 520)
    return () => window.clearTimeout(timer)
  }, [viewMode, duel.phase, duel.roundNumber, duel.lastPublicAction])

  if (viewMode === 'duel') return <DuelView game={duel} onChange={(next: DuelGameState) => setDuel(next)} onSolo={() => setViewMode('solo')} />

  const active = game.phase === 'playing'
  const canBet = betState !== undefined && stake <= maxStake(game.chips)
  const lastToken = game.round.evidence[game.round.evidence.length - 1]
  const currentMessage = game.phase === 'gameOver'
    ? game.points >= POINTS_TO_WIN ? 'YOU REACHED THE TARGET' : 'YOU RAN OUT OF CHIPS'
    : game.phase === 'roundResolved' ? 'ROUND RESOLVED · READ THE REVIEW' : game.lastAction === 'sample' ? 'NEW EVIDENCE · UPDATE YOUR BELIEF' : 'WHAT IS THE PRIOR?'

  const dispatch = (action: PlayerAction) => {
    setGame((current) => applyAction(current, action))
    if (action.type === 'nextRound') {
      setBetState(undefined)
      setStake(1)
    }
  }

  const newGame = () => {
    setGame(createInitialGame())
    setBetState(undefined)
    setStake(1)
  }

  const chooseBet = () => {
    if (!active) return
    setBetState((current) => current ?? 0)
  }

  const sample = () => {
    if (!active) return
    dispatch({ type: 'sample' })
  }

  const confirmBet = () => {
    if (!active || betState === undefined || !canBet) return
    dispatch({ type: 'bet', state: betState, stake })
  }

  const selectedPayout = useMemo(() => betState === undefined ? undefined : payoutMultiplier(game.round.priors[betState]), [betState, game.round.priors])

  return (
    <div className="priors-app">
      <header className="priors-header">
        <button className="priors-wordmark" onClick={newGame} aria-label="Start a new PRIORS game"><span>◌</span><strong>PRIORS</strong><small>V1 / BELIEF GAME</small></button>
        <div className="goal-readout"><span>SOLO SURVIVAL</span><strong><b>{String(game.points).padStart(2, '0')}</b> / {POINTS_TO_WIN} POINTS</strong></div>
        <div className="header-tools"><span className="round-count">ROUND {String(game.roundNumber).padStart(2, '0')}</span><button className="mode-toggle" onClick={() => setViewMode('duel')}><i />DUEL</button><button className={`mode-toggle ${game.coachMode ? 'active' : ''}`} onClick={() => setGame((current) => ({ ...current, coachMode: !current.coachMode }))}><i />COACH</button><button className={`mode-toggle ${game.debug ? 'debug-on' : ''}`} onClick={() => setGame((current) => ({ ...current, debug: !current.debug }))}><i />DEBUG</button></div>
      </header>

      <main className="priors-main">
        <section className="status-strip"><div className="chip-status"><span>YOUR CHIPS</span><Chips count={game.chips} muted={game.phase === 'gameOver' && game.chips === 0} /></div><div className="turn-status"><span className="status-kicker">PRIORS / FIELD NOTE</span><strong>{currentMessage}</strong><span>{lastToken ? `LATEST TOKEN ${EVIDENCE_META.find((item) => item.id === lastToken.type)?.symbol} · SAMPLE COST 1` : 'SAMPLE TO RECEIVE A NOISY CLUE'}</span></div><div className="level-status"><span>DIFFICULTY</span><strong>{game.round.difficulty} <small>{game.round.difficulty === 1 ? 'TWO STATES' : game.round.difficulty === 2 ? 'THREE STATES' : 'FIVE STATES'}</small></strong></div></section>

        <Board game={game} betState={betState} onSelectState={(state) => { if (active) setBetState(state) }} onSample={sample} onBet={chooseBet} />

        {betState !== undefined && active && <section className="bet-console"><div className="bet-selection"><span className="bet-label">YOUR PICK</span><strong>{STATE_META[betState].id}</strong><span className="bet-odds">PAYS ×{selectedPayout}</span></div><div className="stake-picker"><span>STAKE</span>{[1, 2, 3].map((value) => <button key={value} className={stake === value ? 'selected' : ''} disabled={value > maxStake(game.chips)} onClick={() => setStake(value as 1 | 2 | 3)}>{'●'.repeat(value)}<small>{value}</small></button>)}<button className="commit-bet" disabled={!canBet} onClick={confirmBet}>COMMIT BET <span>↗</span></button></div></section>}

        <CoachReview game={game} />
        <ResultStrip game={game} onNext={() => game.phase === 'gameOver' ? newGame() : dispatch({ type: 'nextRound' })} />
        {game.debug && <DebugPanel game={game} />}

        <div className="bottom-rule"><span><i />LOCAL / NO NETWORK</span><span>ONE BOARD · TWO ACTIONS</span><span>{game.chips} CHIPS LEFT · COMMON STATES PAY LESS</span></div>
      </main>
      <footer className="priors-footer"><span>PRIORS V1</span><span>GOOD ODDS ≠ GUARANTEED OUTCOME</span><span>20 POINTS TO WIN</span></footer>
    </div>
  )
}

export default App
