import { useState } from 'react'
import { EVIDENCE_META } from './constants'
import { applyDuelAction, createInitialDuel, DUEL_POINTS_TO_WIN, nextDuelRound } from './duel'
import { maxStake, payoutMultiplier } from './math'
import type { DuelGameState } from './types'

function pct(value: number): string { return `${Math.round(value * 100)}%` }

function Token({ type }: { type: (typeof EVIDENCE_META)[number]['id'] }) {
  const meta = EVIDENCE_META.find((item) => item.id === type) ?? EVIDENCE_META[0]
  return <span className={`evidence-token small ${meta.className}`}>{meta.symbol}</span>
}

function DuelLane({ state, prior, evidence, selected, onPick }: { state: number; prior: number; evidence: Array<(typeof EVIDENCE_META)[number]['id']>; selected: boolean; onPick: () => void }) {
  const active = prior > 0
  return <button className={`hypothesis-lane duel-lane${active ? '' : ' inactive'}${selected ? ' selected' : ''}`} disabled={!active} onClick={onPick}>
    <span className="lane-id">{String.fromCharCode(65 + state)}</span>
    <strong className="lane-prior">{pct(prior)}</strong>
    <span className="lane-caption">PUBLIC PRIOR</span>
    <span className="lane-stem" />
    <span className="lane-evidence">{evidence.length ? evidence.map((type, index) => <Token key={`${type}-${index}`} type={type} />) : <span className="empty-evidence">·</span>}</span>
    <span className="lane-payout">PAYS <b>×{payoutMultiplier(prior)}</b></span>
    {selected && <span className="lane-check">YOUR PICK</span>}
  </button>
}

export function DuelView({ game, onChange, onSolo }: { game: DuelGameState; onChange: (next: DuelGameState) => void; onSolo: () => void }) {
  const [selectedState, setSelectedState] = useState<number | undefined>()
  const [stake, setStake] = useState<1 | 2 | 3>(1)
  const [coach, setCoach] = useState(true)
  const [debug, setDebug] = useState(false)
  const active = game.phase === 'playerTurn'
  const playerEvidenceByLane = Array.from({ length: 5 }, (_, state) => game.player.evidence.filter((token) => EVIDENCE_META.findIndex((item) => item.id === token.type) === state).map((token) => token.type))
  const chosen = selectedState !== undefined
  const canCommit = chosen && stake <= maxStake(game.player.chips)
  const result = game.outcome

  const dispatchSample = () => {
    if (!active) return
    onChange(applyDuelAction(game, { type: 'sample' }))
  }

  const commit = () => {
    if (!active || selectedState === undefined || !canCommit) return
    onChange(applyDuelAction(game, { type: 'bet', state: selectedState, stake }))
  }

  const continueRound = () => {
    if (game.phase === 'gameOver') {
      onChange(createInitialDuel())
    } else {
      onChange(nextDuelRound(game))
    }
    setSelectedState(undefined)
    setStake(1)
  }

  return <div className="priors-app duel-app">
    <header className="priors-header">
      <button className="priors-wordmark" onClick={onSolo}><span>◌</span><strong>PRIORS</strong><small>DUEL / PRIVATE SIGNALS</small></button>
      <div className="goal-readout"><span>DUEL · FIRST TO {DUEL_POINTS_TO_WIN}</span><strong><b>{game.player.score}</b> — {game.bot.score}</strong></div>
      <div className="header-tools"><button className="mode-toggle" onClick={onSolo}><i />SOLO</button><button className={`mode-toggle ${coach ? 'active' : ''}`} onClick={() => setCoach((value) => !value)}><i />COACH</button><button className={`mode-toggle ${debug ? 'debug-on' : ''}`} onClick={() => setDebug((value) => !value)}><i />DEBUG</button></div>
    </header>
    <main className="priors-main">
      <section className="duel-status"><div><span>YOU</span><strong>{game.player.chips} <small>CHIPS</small></strong><b>{game.player.score}/{DUEL_POINTS_TO_WIN}</b></div><div className="duel-turn"><span>PUBLIC FIELD NOTE</span><strong>{game.phase === 'playerTurn' ? 'YOUR TURN · SAMPLE OR BET' : game.phase === 'botTurn' ? 'BOT IS READING' : game.phase === 'roundResolved' ? 'ROUND RESOLVED' : 'DUEL COMPLETE'}</strong><small>{game.lastPublicAction ?? 'Both players share these priors. Evidence stays private.'}</small></div><div className="bot-duel-status"><span>BOT</span><strong>{game.bot.chips} <small>CHIPS</small></strong><b>{game.bot.score}/{DUEL_POINTS_TO_WIN}</b></div></section>
      <section className="priors-board">
        <div className="board-rail board-rail-top"><span>FIVE POSSIBLE STATES / DIFFERENT PRIVATE CLUES</span><span>THE BOT CANNOT SEE YOUR TOKENS</span></div>
        <div className="hypothesis-grid">{game.round.priors.map((prior, state) => <DuelLane key={state} state={state} prior={prior} evidence={playerEvidenceByLane[state]} selected={selectedState === state} onPick={() => active && setSelectedState(state)} />)}</div>
        <div className="evidence-legend"><span className="legend-title">YOUR PRIVATE EVIDENCE</span><span className="legend-copy">The bot is sampling a separate sequence.</span><div className="legend-tokens">{game.player.evidence.length ? game.player.evidence.map((token) => <Token key={token.id} type={token.type} />) : <span className="no-samples">NO SAMPLES YET</span>}</div></div>
        <div className="board-rail board-rail-bottom"><span>{game.player.evidence.length} PRIVATE OBSERVATIONS · BOT EVIDENCE HIDDEN</span><span>{active ? 'YOUR DECISION' : 'WAIT FOR THE NEXT ROUND'}</span></div>
        <div className="board-actions"><button className="primary-action sample-action" disabled={!active || game.player.chips < 1} onClick={dispatchSample}><span className="action-symbol">⊙</span><span><b>SAMPLE</b><small>−1 CHIP · PRIVATE CLUE</small></span><kbd>S</kbd></button><button className={`primary-action bet-action${chosen ? ' active' : ''}`} disabled={!active} onClick={() => setSelectedState((state) => state ?? 0)}><span className="action-symbol">◇</span><span><b>BET</b><small>{chosen ? 'CHOOSE STAKE + COMMIT' : 'COMMIT YOUR BELIEF'}</small></span><kbd>B</kbd></button></div>
      </section>
      {chosen && active && <section className="bet-console"><div className="bet-selection"><span className="bet-label">YOUR PICK</span><strong>{String.fromCharCode(65 + selectedState!)}</strong><span className="bet-odds">PAYS ×{payoutMultiplier(game.round.priors[selectedState!])}</span></div><div className="stake-picker"><span>STAKE</span>{[1, 2, 3].map((value) => <button key={value} className={stake === value ? 'selected' : ''} disabled={value > maxStake(game.player.chips)} onClick={() => setStake(value as 1 | 2 | 3)}>{'●'.repeat(value)}<small>{value}</small></button>)}<button className="commit-bet" disabled={!canCommit} onClick={commit}>COMMIT BET <span>↗</span></button></div></section>}
      {result ? <section className={`round-result ${result.winner === 'player' ? 'correct' : 'wrong'}`}><div className="result-main"><span className="result-kicker">{result.winner === 'player' ? 'ROUND TO YOU' : 'ROUND TO BOT'}</span><strong>TRUE STATE: {String.fromCharCode(65 + result.hiddenState)}</strong><span>{result.actor === 'player' ? `Your ${result.correct ? 'correct' : 'wrong'} bet decided the round.` : `Bot ${result.correct ? 'found' : 'missed'} the hidden state.`}</span></div><div className="result-posterior"><span>YOUR POSTERIOR BEFORE BET</span>{result.posterior.map((probability, state) => <div key={state} className={state === result.chosenState ? 'choice-bar' : ''}><i style={{ width: `${Math.round(probability * 100)}%` }} /><b>{String.fromCharCode(65 + state)}</b><span>{pct(probability)}</span></div>)}</div><button className="next-round" onClick={continueRound}>{game.phase === 'gameOver' ? 'NEW DUEL ↗' : 'NEXT ROUND ↗'}</button></section> : game.phase === 'gameOver' && <section className="round-result wrong"><div className="result-main"><span className="result-kicker">DUEL OVER</span><strong>NO CHIPS LEFT</strong><span>A sample used the final chip.</span></div><button className="next-round" onClick={continueRound}>NEW DUEL ↗</button></section>}
      {coach && result && <div className="coach-review"><span className="coach-mark">✦</span><span><b>DUEL REVIEW:</b> both players acted on private posteriors; a miss awards the round to the other side.</span></div>}
      {debug && <section className="debug-panel"><div className="debug-title"><span>DUEL DEBUG / HIDDEN STATE + BOTH FILTERS</span><b>OFF BY DEFAULT</b></div><div className="debug-grid"><div><span>TRUE STATE</span><strong>{String.fromCharCode(65 + game.round.hiddenState)}</strong></div><div><span>YOUR POSTERIOR</span><strong>{game.player.posterior.map(pct).join(' · ')}</strong></div><div><span>BOT POSTERIOR</span><strong>{game.bot.posterior.map(pct).join(' · ')}</strong></div><div><span>BOT CONTEXT</span><strong>NO HIDDEN STATE</strong></div></div></section>}
      <div className="bottom-rule"><span><i />LOCAL / SAME PUBLIC PRIORS</span><span>DIFFERENT PRIVATE SAMPLES</span><span>FIRST TO {DUEL_POINTS_TO_WIN} ROUNDS</span></div>
    </main>
    <footer className="priors-footer"><span>PRIORS V1 / DUEL</span><span>UNCERTAINTY IS THE OPPONENT</span><span>NO HIDDEN STATE IN BOT CONTEXT</span></footer>
  </div>
}
