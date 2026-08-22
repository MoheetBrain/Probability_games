import { useState } from 'react'
import { clamp, evaluateDecision, generateObservations, generateOpportunity, initialGame, isRuin, normalizeBelief, posteriorFromObservations, scanCost, transitionState } from './game/engine'
import { loadStats, saveStats, updateLifetimeStats } from './game/storage'
import type { Belief, GameState, HiddenState, LifetimeStats, Observation, TurnResult } from './game/types'

const STATE_META: Record<HiddenState, { label: string; color: string; short: string }> = {
  growth: { label: 'Growth', color: '#63e6be', short: 'GROWTH' },
  stable: { label: 'Stable', color: '#9aa7bb', short: 'STABLE' },
  decline: { label: 'Decline', color: '#ff7189', short: 'DECLINE' },
}

const STATE_ORDER: HiddenState[] = ['growth', 'stable', 'decline']

function money(value: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(Math.round(value))
}

function signedMoney(value: number): string {
  return `${value >= 0 ? '+' : '−'}${money(Math.abs(value))}`
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function scoreColor(score: number): string {
  if (score >= 76) return 'good'
  if (score >= 50) return 'mid'
  return 'bad'
}

function SignalCard({ observation, fresh = false }: { observation: Observation; fresh?: boolean }) {
  return (
    <article className={`signal-card ${observation.tone} ${fresh ? 'fresh' : ''}`}>
      <div className="signal-mark">{observation.tone === 'positive' ? '↗' : observation.tone === 'negative' ? '↘' : '·'}</div>
      <div className="signal-copy">
        <strong>{observation.label}</strong>
        <span>{observation.detail}</span>
      </div>
      <div className="signal-pulse" />
    </article>
  )
}

function BeliefEditor({ belief, onChange, compact = false }: { belief: Belief; onChange: (belief: Belief) => void; compact?: boolean }) {
  const setStateProbability = (state: HiddenState, raw: number) => {
    const value = clamp(raw, 0.01, 0.98)
    const others = STATE_ORDER.filter((item) => item !== state)
    const remainder = 1 - value
    const otherTotal = others.reduce((sum, item) => sum + belief[item], 0)
    const next = { ...belief, [state]: value }
    others.forEach((item) => {
      next[item] = otherTotal > 0 ? remainder * belief[item] / otherTotal : remainder / others.length
    })
    onChange(normalizeBelief(next))
  }

  return (
    <div className={`belief-editor ${compact ? 'compact' : ''}`}>
      {STATE_ORDER.map((state) => (
        <div className="belief-row" key={state}>
          <div className="belief-label"><span className="state-dot" style={{ background: STATE_META[state].color }} />{STATE_META[state].label}</div>
          <input aria-label={`${STATE_META[state].label} probability`} type="range" min="1" max="98" value={Math.round(belief[state] * 100)} onChange={(event) => setStateProbability(state, Number(event.target.value) / 100)} style={{ '--range-color': STATE_META[state].color } as React.CSSProperties} />
          <output style={{ color: STATE_META[state].color }}>{percent(belief[state])}</output>
        </div>
      ))}
      {!compact && <div className="belief-total"><span>Forecast total</span><span>100%</span></div>}
    </div>
  )
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return <div className="score-pill"><span>{label}</span><strong className={scoreColor(value)}>{value}</strong></div>
}

function DebugPanel({ game }: { game: GameState }) {
  return (
    <aside className="debug-panel">
      <div className="debug-title"><span>Developer lens</span><span className="debug-live">LIVE</span></div>
      <div className="debug-grid">
        <span>True state</span><strong>{STATE_META[game.hiddenState].short}</strong>
        <span>Reference posterior</span><strong>{STATE_ORDER.map((state) => `${state[0].toUpperCase()} ${percent(game.posterior[state])}`).join(' · ')}</strong>
        <span>True opportunity EV</span><strong>{signedMoney(game.posterior.growth * (game.opportunity.multipliers.growth - 1) + game.posterior.stable * (game.opportunity.multipliers.stable - 1) + game.posterior.decline * (game.opportunity.multipliers.decline - 1))}</strong>
      </div>
      <div className="debug-matrix">
        <span>Transition matrix</span>
        {STATE_ORDER.map((state) => <div key={state}><b>{state[0].toUpperCase()}</b>{STATE_ORDER.map((target) => <span key={target}>{Math.round(game.transitionMatrix[state][target] * 100)}%</span>)}</div>)}
      </div>
      <div className="debug-signals">
        <span>Signal likelihoods (G / S / D)</span>
        {game.observations.map((signal) => <div key={`${signal.id}-${signal.observedAt}`}><b>{signal.label}</b><span>{STATE_ORDER.map((state) => Math.round(signal.likelihoods[state] * 100)).join(' / ')}</span></div>)}
      </div>
    </aside>
  )
}

function TopBar({ game, onHome, onDebug }: { game: GameState; onHome: () => void; onDebug: () => void }) {
  return (
    <header className="topbar">
      <button className="brand-button" onClick={onHome} aria-label="Return to home"><span className="brand-orbit">◌</span><span>ORACLE</span></button>
      <div className="run-progress"><span>RUN {String(game.turn).padStart(2, '0')}</span><div className="progress-track"><div style={{ width: `${(game.turn / game.totalTurns) * 100}%` }} /></div><span>{game.turn}/{game.totalTurns}</span></div>
      <button className={`debug-toggle ${game.debug ? 'active' : ''}`} onClick={onDebug}><span className="toggle-dot" />DEBUG</button>
    </header>
  )
}

function CapitalStrip({ game }: { game: GameState }) {
  const riskShare = game.capital > 0 ? game.riskCapital / game.capital : 0
  return (
    <section className="capital-strip">
      <div className="capital-main"><span className="eyebrow">TOTAL CAPITAL</span><strong>{money(game.capital)}</strong><span className={`capital-change ${game.lastResult ? game.lastResult.netChange >= 0 ? 'positive-text' : 'negative-text' : ''}`}>{game.lastResult ? signedMoney(game.lastResult.netChange) + ' last turn' : 'Capital compounds through uncertainty'}</span></div>
      <div className="capital-cell"><span className="eyebrow">RESERVE</span><strong>{money(game.reserve)}</strong><span className="muted">{game.reserveUnlocked ? 'Emergency capital' : 'Protected'}</span></div>
      <div className="capital-cell risk-cell"><span className="eyebrow">RISK CAPITAL</span><strong>{money(game.riskCapital)}</strong><div className="mini-bar"><span style={{ width: `${riskShare * 100}%` }} /></div><span className="muted">{game.reserveUnlocked ? 'Reserve unlocked' : 'Available to deploy'}</span></div>
    </section>
  )
}

function ForecastStage({ game, onForecast, onSubmit }: { game: GameState; onForecast: (belief: Belief) => void; onSubmit: () => void }) {
  return (
    <div className="stage-grid">
      <section className="panel evidence-panel">
        <div className="panel-heading"><div><span className="eyebrow">OBSERVE / TURN {String(game.turn).padStart(2, '0')}</span><h2>Read the traces.</h2></div><span className="observation-count">{String(game.observations.length).padStart(2, '0')} signals</span></div>
        <p className="stage-intro">Something is happening beneath the surface. The traces are real, but none of them are certain.</p>
        <div className="signal-stack">{game.observations.map((observation) => <SignalCard key={`${observation.id}-${observation.observedAt}`} observation={observation} />)}</div>
        <div className="base-rate-note"><span className="note-icon">⌁</span><span>Every world has a base rate. Start there, then let the evidence move you.</span></div>
      </section>
      <section className="panel forecast-panel">
        <div className="panel-heading"><div><span className="eyebrow">FORM A BELIEF</span><h2>What do you think?</h2></div><span className="uncertainty-label">CALIBRATE</span></div>
        <p className="stage-intro">Commit to a probability distribution. Confidence is useful only when it is earned.</p>
        <BeliefEditor belief={game.forecast} onChange={onForecast} />
        <div className="forecast-foot"><div className="forecast-hint"><span className="hint-spark">✦</span><span>You can revise after buying another signal.</span></div><button className="primary-button" onClick={onSubmit}>ENTER FORECAST <span>→</span></button></div>
      </section>
    </div>
  )
}

function OpportunityCard({ game }: { game: GameState }) {
  const ev = game.forecast.growth * (game.opportunity.multipliers.growth - 1) + game.forecast.stable * (game.opportunity.multipliers.stable - 1) + game.forecast.decline * (game.opportunity.multipliers.decline - 1)
  return (
    <div className={`opportunity-card ${game.opportunity.accent}`}>
      <div className="opportunity-heading"><div><span className="eyebrow">OPPORTUNITY / {game.opportunity.volatility} VOLATILITY</span><h2>{game.opportunity.title}</h2><p>{game.opportunity.subtitle}</p></div><div className="opportunity-sigil">◈</div></div>
      <div className="payoff-grid">{STATE_ORDER.map((state) => <div className="payoff" key={state}><span style={{ color: STATE_META[state].color }}>{STATE_META[state].short}</span><strong>×{game.opportunity.multipliers[state].toFixed(2)}</strong><small>{game.opportunity.multipliers[state] >= 1 ? 'return' : 'of stake'}</small></div>)}</div>
      <div className={`ev-readout ${ev >= 0 ? 'ev-positive' : 'ev-negative'}`}><span>YOUR PREDICTED EV</span><strong>{ev >= 0 ? '+' : '−'}{Math.abs(ev * 100).toFixed(1)}%</strong><small>{ev >= 0 ? 'There may be an edge here.' : 'The odds are asking too much.'}</small></div>
    </div>
  )
}

function DecisionStage({ game, onForecast, onScan, onStake, onWait, onCommit, onRevise }: { game: GameState; onForecast: (belief: Belief) => void; onScan: () => void; onStake: (stake: number) => void; onWait: () => void; onCommit: () => void; onRevise: () => void }) {
  const scanDisabled = game.riskCapital < game.scanCost
  const stake = Math.min(game.riskCapital, Math.max(0, game.pendingStake))
  return (
    <div className="decision-layout">
      <section className="panel decision-left">
        <div className="panel-heading"><div><span className="eyebrow">DECIDE / BEFORE THE WORLD MOVES</span><h2>Choose your exposure.</h2></div><button className="text-button" onClick={onRevise}>← revise forecast</button></div>
        <OpportunityCard game={game} />
        <div className="decision-actions"><button className="scan-button" onClick={onScan} disabled={scanDisabled}><span className="scan-icon">⌁</span><span><b>SCAN AGAIN</b><small>{money(game.scanCost)} · {scanDisabled ? 'risk capital too low' : 'buy one more trace'}</small></span><span className="scan-arrow">↗</span></button><div className="scan-count">{game.scanCount === 0 ? 'No additional information purchased' : `${game.scanCount} additional ${game.scanCount === 1 ? 'trace' : 'traces'} purchased this turn`}</div></div>
      </section>
      <section className="panel bet-panel">
        <div className="panel-heading"><div><span className="eyebrow">POSITION SIZE</span><h2>How much do you risk?</h2></div><span className="available-label">{money(game.riskCapital)} available</span></div>
        <p className="stage-intro">A good idea can still be a bad bet. Keep enough runway to be wrong.</p>
        <div className="bet-amount"><span>£</span><input aria-label="Stake amount" type="number" min="0" max={Math.floor(game.riskCapital)} step="50" value={Math.round(stake)} onChange={(event) => onStake(Math.min(game.riskCapital, Math.max(0, Number(event.target.value) || 0)))} /></div>
        <input className="stake-range" aria-label="Risk amount" type="range" min="0" max={Math.max(1, Math.floor(game.riskCapital))} step="50" value={Math.round(stake)} onChange={(event) => onStake(Number(event.target.value))} style={{ '--range-color': game.opportunity.accent === 'rose' ? '#ff7189' : '#7c72ff' } as React.CSSProperties} />
        <div className="range-labels"><span>£0</span><span>{money(game.riskCapital)}</span></div>
        <div className="risk-preview"><div><span className="eyebrow">AT RISK</span><strong>{game.riskCapital > 0 ? `${Math.round(stake / game.riskCapital * 100)}%` : '0%'}</strong></div><div className="risk-preview-bar"><span style={{ width: `${game.riskCapital > 0 ? Math.min(100, stake / game.riskCapital * 100) : 0}%` }} /></div><small>{stake === 0 ? 'Nothing staked. Information has value too.' : stake / Math.max(1, game.riskCapital) > 0.3 ? 'This position can change the shape of the run.' : 'You keep room for the next signal.'}</small></div>
        <div className="bet-buttons"><button className="secondary-button" onClick={onWait}>WAIT / PASS</button><button className="primary-button commit-button" onClick={onCommit}>{stake === 0 ? 'COMMIT WAIT' : 'COMMIT BET'} <span>→</span></button></div>
      </section>
      <div className="decision-note"><span className="note-icon">◒</span><span>Waiting is a position. The goal is not to act every turn; it is to act when the odds deserve it.</span></div>
    </div>
  )
}

function OutcomeStage({ result, game, onNext, onFinish }: { result: TurnResult; game: GameState; onNext: () => void; onFinish: () => void }) {
  const positive = result.netChange >= 0
  return (
    <div className="outcome-layout">
      <section className={`outcome-hero ${positive ? 'positive' : 'negative'}`}>
        <div className="outcome-kicker"><span className="eyebrow">WORLD RESOLVED / TURN {String(result.turn).padStart(2, '0')}</span><span className="outcome-pulse">●</span></div>
        <div className="true-state-label">TRUE STATE</div><div className="true-state">{STATE_META[result.actualState].label}</div>
        <div className="state-orbit"><span /><span /><span /></div>
        <div className="outcome-result"><span>{result.stake === 0 ? 'Position' : 'Investment'}</span><strong>{result.stake === 0 ? 'WAIT' : `${money(result.stake)} → ${money(result.returnAmount)}`}</strong><b className={positive ? 'positive-text' : 'negative-text'}>{result.stake === 0 ? 'No capital committed' : signedMoney(result.netChange)}</b></div>
      </section>
      <section className="panel outcome-detail">
        <div className="panel-heading"><div><span className="eyebrow">YOUR REASONING</span><h2>{result.label === 'GOOD' ? 'Strong decision.' : result.label === 'BAD EV' ? 'The odds were against you.' : `${titleCase(result.label.toLowerCase())} decision.`}</h2></div><div className={`decision-badge ${scoreColor(result.decisionQuality)}`}>{result.decisionQuality}<small>decision quality</small></div></div>
        <div className="forecast-reveal">{STATE_ORDER.map((state) => <div key={state}><span className="state-dot" style={{ background: STATE_META[state].color }} /><span>{STATE_META[state].label}</span><strong>{percent(result.forecast[state])}</strong></div>)}</div>
        <div className="outcome-scores"><ScorePill label="Forecast quality" value={result.forecastQuality} /><ScorePill label="Calibration" value={result.calibration} /><ScorePill label="Risk control" value={result.riskControl} /><ScorePill label="Bayesian update" value={result.updating} /></div>
        <div className="explanation"><span className="explanation-mark">✦</span><p>{result.explanation}</p></div>
        <div className="outcome-footer"><div><span className="eyebrow">CAPITAL NOW</span><strong>{money(game.capital)}</strong></div><button className="primary-button" onClick={game.ruined || result.turn >= game.totalTurns ? onFinish : onNext}>{game.ruined ? 'SEE RUIN REPORT' : result.turn >= game.totalTurns ? 'SEE RUN REPORT' : 'NEXT TURN'} <span>→</span></button></div>
      </section>
    </div>
  )
}

function makeExplanation(result: TurnResult): string {
  if (result.label === 'BAD EV') return `Your forecast did not support the price of this opportunity. ${result.outcomeType === 'win' ? 'The result went your way, but the edge was not there.' : 'The loss was a warning, not a surprise.'} A disciplined pass would have preserved optionality.`
  if (result.label === 'RECKLESS') return `The idea may have been sound, but the position was too large for the uncertainty remaining. Survival is part of the calculation.`
  if (result.label === 'AGGRESSIVE') return `You found a plausible edge, then expressed it with more size than the evidence could carry. A smaller position would leave you more future decisions.`
  if (result.label === 'GOOD') return `You let several imperfect signals move your belief without demanding certainty. The position respected the edge and kept runway. ${result.outcomeType === 'loss' ? 'Good decision. Bad outcome.' : 'Good process, and this time the world agreed.'}`
  return `Your forecast and position were directionally sensible, but there was still room to separate a useful signal from a confident story. ${result.outcomeType === 'win' ? 'The win is data, not proof.' : 'The loss is data, not a verdict.'}`
}

function Home({ stats, onStart }: { stats: LifetimeStats; onStart: () => void }) {
  return (
    <div className="home-screen">
      <div className="home-stars" />
      <header className="home-top"><div className="brand-lockup"><span className="brand-orbit large">◌</span><span>ORACLE</span><small>V0 / FIELD TEST</small></div><div className="home-status"><span className="status-light" />local session · no data leaves this device</div></header>
      <main className="home-main"><section className="hero-copy"><div className="hero-kicker"><span />PREDICTION UNDER UNCERTAINTY</div><h1>Make a call.<br /><em>Keep your nerve.</em></h1><p>Infer the hidden state of a changing world from noisy evidence. Then decide what your conviction is actually worth.</p><button className="hero-button" onClick={onStart}><span>BEGIN A RUN</span><b>↗</b></button><div className="hero-footnote"><span>20 turns</span><i /> <span>hidden states</span><i /> <span>one surviving bankroll</span></div></section><section className="observatory"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><div className="observatory-core"><span className="core-eye">◌</span><div className="core-label">THE WORLD<br /><b>IS HIDDEN</b></div></div><div className="floating-node node-one"><span>G</span><b>0.34</b></div><div className="floating-node node-two"><span>S</span><b>0.42</b></div><div className="floating-node node-three"><span>D</span><b>0.24</b></div><div className="observatory-caption">Base rates are only the beginning.</div></section></main>
      <section className="home-bottom"><div className="how-it-works"><span className="eyebrow">THE LOOP</span><div className="loop-steps"><div><b>01</b><span>OBSERVE</span><small>Find the signal inside the noise.</small></div><div><b>02</b><span>FORECAST</span><small>Say how uncertain you really are.</small></div><div><b>03</b><span>RISK</span><small>Size the bet. Survive the miss.</small></div></div></div><div className="lifetime-card"><div><span className="eyebrow">ORACLE RATING</span><strong>{stats.oracleRating}</strong></div><div className="lifetime-meta"><span>{stats.totalRuns} runs</span><span>{stats.ruinCount} ruins</span><span>best {money(stats.bestCapital)}</span></div></div></section>
    </div>
  )
}

function Summary({ game, stats, onAgain, onHome }: { game: GameState; stats: LifetimeStats; onAgain: () => void; onHome: () => void }) {
  const records = game.history
  const average = (key: 'forecastQuality' | 'calibration' | 'updating' | 'betSizing' | 'riskControl' | 'informationUse') => records.length ? Math.round(records.reduce((sum, record) => sum + record[key], 0) / records.length) : 0
  const weakness = [
    { label: 'BET SIZING', score: average('betSizing'), copy: 'You identified positive-EV opportunities, but your position size often outran the uncertainty.' },
    { label: 'BAYESIAN UPDATING', score: average('updating'), copy: 'Your first impression held on a little too tightly when new evidence arrived.' },
    { label: 'INFORMATION VALUE', score: average('informationUse'), copy: 'There were moments where another trace could have changed the decision.' },
    { label: 'CALIBRATION', score: average('calibration'), copy: 'Your calls were directionally useful. The next edge is learning when 70% should feel like enough.' },
  ].sort((a, b) => a.score - b.score)[0]
  const rating = stats.oracleRating
  return (
    <div className="summary-screen"><header className="summary-top"><button className="brand-button" onClick={onHome}><span className="brand-orbit">◌</span><span>ORACLE</span></button><span className="eyebrow">RUN COMPLETE / {records.length} TURNS SURVIVED</span></header><main className="summary-main"><div className="summary-title"><span className="hero-kicker"><span />FIELD REPORT</span><h1>{game.ruined ? 'The signal went dark.' : 'The run is in the record.'}</h1><p>{game.ruined ? 'The reserve was not infinite. That is information too.' : 'Wealth is what happened. Quality is how you got there.'}</p></div><div className="summary-rating"><span className="eyebrow">ORACLE RATING</span><strong>{rating}</strong><small>{rating >= 650 ? 'process is becoming visible' : 'keep watching the sizing'}</small></div><section className="summary-grid"><div className="final-capital"><span className="eyebrow">FINAL CAPITAL</span><strong>{money(game.capital)}</strong><span className={game.capital >= 10000 ? 'positive-text' : 'negative-text'}>{signedMoney(game.capital - 10000)} from start</span><div className="capital-line"><span style={{ width: `${Math.min(100, game.capital / Math.max(1, Math.max(stats.bestCapital, 10000)) * 100)}%` }} /></div></div><div className="metric-card"><span className="eyebrow">REASONING PROFILE</span><div className="metric-list"><div><span>Forecasting</span><b>{average('forecastQuality')}</b></div><div><span>Calibration</span><b>{average('calibration')}</b></div><div><span>Bayesian updating</span><b>{average('updating')}</b></div><div><span>Expected value</span><b>{records.length ? Math.round(records.reduce((sum, record) => sum + (record.playerEv > 0 ? 100 : 30), 0) / records.length) : 0}</b></div><div><span>Bet sizing</span><b>{average('betSizing')}</b></div><div><span>Risk control</span><b>{average('riskControl')}</b></div><div><span>Information value</span><b>{average('informationUse')}</b></div></div></div><div className="weakness-card"><span className="eyebrow">BIGGEST WEAKNESS</span><div className="weakness-score"><strong>{weakness.score}</strong><span>/ 100</span></div><h3>{weakness.label}</h3><p>{weakness.copy}</p><div className="next-run"><span>↗</span><span>NEXT RUN<br /><b>emphasis increased</b></span></div></div></section><div className="summary-actions"><button className="secondary-button" onClick={onHome}>RETURN HOME</button><button className="hero-button" onClick={onAgain}><span>RUN IT BACK</span><b>↗</b></button></div></main></div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<'home' | 'game' | 'summary'>('home')
  const [stats, setStats] = useState<LifetimeStats>(() => loadStats())
  const [game, setGame] = useState<GameState | null>(null)

  const startRun = () => {
    setGame(initialGame(Math.random, false))
    setScreen('game')
  }

  const home = () => setScreen('home')

  const finishRun = (run: GameState) => {
    const nextStats = updateLifetimeStats(stats, run.history, run.capital, run.ruined)
    setStats(nextStats)
    saveStats(nextStats)
    setGame(run)
    setScreen('summary')
  }

  const updateGame = (updater: (current: GameState) => GameState) => setGame((current) => current ? updater(current) : current)

  const submitForecast = () => updateGame((current) => ({ ...current, phase: 'decision' }))

  const reviseForecast = () => updateGame((current) => ({ ...current, phase: 'forecast' }))

  const scan = () => updateGame((current) => {
    if (current.phase !== 'decision' || current.riskCapital < current.scanCost) return current
    const signal = generateObservations(current.hiddenState, 1)[0]
    const observations = [...current.observations, signal]
    const riskCapital = current.riskCapital - current.scanCost
    return { ...current, capital: current.reserve + riskCapital, riskCapital, observations, posterior: posteriorFromObservations(current.prior, observations), scanCount: current.scanCount + 1, scanCost: scanCost(current.scanCount + 1) }
  })

  const commit = (stakeOverride?: number) => updateGame((current) => {
    if (current.phase !== 'decision') return current
    const availableRisk = current.riskCapital
    const stake = Math.min(availableRisk, Math.max(0, Math.round(stakeOverride ?? current.pendingStake)))
    const scanSpend = 100 * ((2 ** current.scanCount) - 1)
    const decision = evaluateDecision(current.forecast, current.hiddenState, current.opportunity, stake, availableRisk, current.posterior, current.history, current.scanCount)
    const multiplier = current.opportunity.multipliers[current.hiddenState]
    const returnAmount = stake * multiplier
    let riskCapital = Math.max(0, availableRisk + stake * (multiplier - 1))
    let reserve = current.reserve
    let reserveUnlocked = current.reserveUnlocked
    let stressTurns = riskCapital <= 0 ? current.stressTurns + 1 : 0
    if (riskCapital <= 0 && reserve > 0 && current.stressTurns >= 1) {
      riskCapital = reserve
      reserve = 0
      reserveUnlocked = true
      stressTurns = 0
    }
    const capital = reserve + riskCapital
    const ruined = isRuin(riskCapital, reserve)
    const outcomeType = stake === 0 ? 'wait' : returnAmount >= stake ? 'win' : 'loss'
    const netChange = stake * (multiplier - 1) - scanSpend
    const record = { ...decision, turn: current.turn, forecast: current.forecast, actualState: current.hiddenState, opportunity: current.opportunity, stake, scanCost: scanSpend, netChange, label: decision.label }
    const result: TurnResult = { ...record, returnAmount, multiplier, outcomeType, explanation: makeExplanation({ ...record, returnAmount, multiplier, outcomeType, explanation: '' }) }
    const nextState: GameState = { ...current, capital, reserve, riskCapital, reserveUnlocked, stressTurns, history: [...current.history, record], lastResult: result, phase: 'outcome', ruined }
    return nextState
  })

  const wait = () => commit(0)

  const setStake = (stake: number) => updateGame((current) => ({ ...current, pendingStake: Math.min(current.riskCapital, Math.max(0, stake)) }))

  const nextTurn = () => {
    if (!game) return
    if (game.ruined || game.turn >= game.totalTurns) {
      finishRun(game)
      return
    }
    const nextHidden = transitionState(game.hiddenState, game.transitionMatrix)
    const prior = { ...game.transitionMatrix[game.hiddenState] }
    const observations = generateObservations(nextHidden, 2 + Math.floor(Math.random() * 3))
    const next: GameState = { ...game, turn: game.turn + 1, hiddenState: nextHidden, prior, observations, posterior: posteriorFromObservations(prior, observations), forecast: prior, opportunity: generateOpportunity(Math.random, game.turn + 1), scanCount: 0, scanCost: 100, pendingStake: 0, phase: 'forecast', lastResult: undefined }
    setGame(next)
  }

  const toggleDebug = () => updateGame((current) => ({ ...current, debug: !current.debug }))

  if (screen === 'home') return <Home stats={stats} onStart={startRun} />
  if (screen === 'summary' && game) return <Summary game={game} stats={stats} onAgain={startRun} onHome={home} />
  if (!game) return null

  return (
    <div className="app-shell"><TopBar game={game} onHome={home} onDebug={toggleDebug} /><CapitalStrip game={game} /><main className="game-main"><div className="state-rail"><span className="eyebrow">HIDDEN WORLD</span><div className="rail-dots">{STATE_ORDER.map((state) => <span key={state} className={game.debug && game.hiddenState === state ? 'revealed' : ''} style={{ '--dot-color': STATE_META[state].color } as React.CSSProperties} />)}</div><span>{game.debug ? `true state: ${STATE_META[game.hiddenState].short}` : 'state unrevealed'}</span></div>{game.phase === 'forecast' && <ForecastStage game={game} onForecast={(forecast) => updateGame((current) => ({ ...current, forecast }))} onSubmit={submitForecast} />}{game.phase === 'decision' && <DecisionStage game={game} onForecast={(forecast) => updateGame((current) => ({ ...current, forecast }))} onScan={scan} onStake={setStake} onWait={wait} onCommit={commit} onRevise={reviseForecast} />}{game.phase === 'outcome' && game.lastResult && <OutcomeStage game={game} result={game.lastResult} onNext={nextTurn} onFinish={() => finishRun(game)} />}{game.debug && <DebugPanel game={game} />}</main><footer className="game-footer"><span>ORACLE V0</span><span>GOOD PROCESS ≠ GOOD LUCK</span><span>LOCAL / SESSION ONLY</span></footer></div>
  )
}
