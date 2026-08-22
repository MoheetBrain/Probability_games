import { useEffect, useMemo, useState } from 'react'
import { CAPTURES_TO_WIN, EVIDENCE_META, INITIAL_CHIPS, MAX_EVIDENCE, MAX_STAKE } from './projection/constants'
import { applyBotTurn, applyAction, createInitialGame, debugNextPosition, debugSectorPosterior, setMode } from './projection/engine'
import { normalisedEntropy, positionMarginal, sectorMarginal } from './projection/bayes'
import { botPersonalityName } from './projection/bot'
import { isLegalTrapTarget } from './projection/ghost'
import { ProjectionBoard, tokenForIndex, type BoardInteraction } from './projection/ProjectionBoard'
import { sectorForCell } from './projection/sectors'
import type { GameState, Position } from './projection/types'
import './styles.css'

function coordinate(position: Position): string { return `${String.fromCharCode(65 + position.col)}${position.row + 1}` }
function percent(value: number): string { return `${Math.round(value * 100)}%` }
function signed(value: number): string { return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}` }
function expectedValue(probability: number, stake: number): number { return stake * (3 * probability - 1) }

function Chips({ count }: { count: number }) { return <div className="chip-line" aria-label={`${count} chips`}><span className="chips">{Array.from({ length: INITIAL_CHIPS }, (_, index) => <i key={index} className={index < count ? 'filled' : ''} />)}</span><b>{count}</b></div> }
function Captures({ count, color = 'player' }: { count: number; color?: 'player' | 'bot' }) { return <span className={`capture-pips ${color}`}>{Array.from({ length: CAPTURES_TO_WIN }, (_, index) => <i key={index} className={index < count ? 'filled' : ''} />)}</span> }

function Header({ game, onNew, onMode, onDebug, onCoach, onPersonality }: { game: GameState; onNew: () => void; onMode: () => void; onDebug: () => void; onCoach: () => void; onPersonality: () => void }) {
  return <header className="projection-header">
    <button className="projection-wordmark" onClick={onNew} aria-label="Start a new projection"><span>◌</span><strong>PROJECTION</strong><small>V1 / HIDDEN MARKOV BOARD</small></button>
    <div className="match-readout"><span>{game.mode === 'duel' ? 'DUEL / FIRST TO 5' : 'SOLO / UNCERTAINTY IS THE OPPONENT'}</span><strong>CAPTURE {game.player.captures} <small>/ {CAPTURES_TO_WIN}</small></strong></div>
    <div className="header-tools"><button className="header-toggle" onClick={onMode}><i />{game.mode === 'duel' ? 'SOLO' : 'DUEL'}</button>{game.mode === 'duel' && <button className="header-toggle personality" onClick={onPersonality}><i />{botPersonalityName(game.personality)}</button>}<button className={`header-toggle ${game.coachMode ? 'active' : ''}`} onClick={onCoach}><i />COACH</button><button className={`header-toggle ${game.debug ? 'debug-on' : ''}`} onClick={onDebug}><i />DEBUG</button></div>
  </header>
}

function SignalMap({ scenario }: { scenario: GameState['scenario'] }) {
  const [selected, setSelected] = useState(0)
  const row = scenario.likelihoods[selected]
  return <section className="rail-card signal-map"><span className="rail-eyebrow">SIGNAL MAP / PUBLIC</span><div className="sector-tabs">{scenario.priors.map((prior, index) => <button key={index} className={selected === index ? 'selected' : ''} disabled={prior <= 0} onClick={() => setSelected(index)}>{String.fromCharCode(65 + index)}</button>)}</div><div className="signal-title"><strong>SECTOR {String.fromCharCode(65 + selected)}</strong><small>token likelihoods</small></div><div className="signal-bars">{row.map((probability, index) => <div key={index}><b className={tokenForIndex(index).className}>{tokenForIndex(index).symbol}</b><i><span style={{ width: `${Math.round(probability * 100)}%` }} /></i><small>{percent(probability)}</small></div>)}</div><p>Evidence describes the sector before the Ghost moves.</p></section>
}

function EvidenceRail({ game }: { game: GameState }) {
  return <section className="rail-card evidence-rail"><span className="rail-eyebrow">EVIDENCE LOG / PRIVATE</span><div className="evidence-list">{game.playerEvidence.length === 0 ? <span className="empty-log">NO TOKENS YET</span> : game.playerEvidence.slice(-MAX_EVIDENCE).map((token) => { const meta = EVIDENCE_META.find((item) => item.id === token.type) ?? EVIDENCE_META[0]; return <div key={token.id}><span className={`evidence-stone ${meta.className}`}>{meta.symbol}</span><b>t−{token.age}</b><small>{meta.name}</small></div> })}</div><p>New evidence arrives before the next Ghost transition. Older clues are still active.</p></section>
}

function PriorRail({ game }: { game: GameState }) {
  return <section className="rail-card prior-rail"><span className="rail-eyebrow">SECTOR PRIORS / PUBLIC</span><div className="prior-list">{game.scenario.priors.map((prior, index) => <div key={index} className={prior <= 0 ? 'inactive' : ''}><b>{String.fromCharCode(65 + index)}</b><i><span style={{ width: `${Math.round(prior * 100)}%` }} /></i><strong>{percent(prior)}</strong></div>)}</div><p>Base rates are the starting mass. The posterior stays yours to infer.</p></section>
}

function LawRail({ game }: { game: GameState }) {
  return <section className="rail-card law-rail"><span className="rail-eyebrow">MOVEMENT LAW / PUBLIC</span>{game.scenario.movement === 'still' ? <div className="still-law">GHOST HOLDS POSITION<small>Level 1 isolates the signal.</small></div> : <><div className="law-row"><b>{game.scenario.movement === 'slow' ? '80%' : '60%'}</b><span>continue</span></div><div className="law-row"><b>{game.scenario.movement === 'slow' ? '10%' : '20%'}</b><span>turn left</span></div><div className="law-row"><b>{game.scenario.movement === 'slow' ? '10%' : '20%'}</b><span>turn right</span></div><small>Edges renormalise over legal directions.</small></>}<div className="level-chip">LEVEL {game.level} · {game.scenario.label}</div></section>
}

function ActionControls({ game, interaction, pendingTrap, stake, onInteraction, onSample, onStake, onPlaceTrap }: { game: GameState; interaction: BoardInteraction; pendingTrap?: Position; stake: 1 | 2 | 3; onInteraction: (next: BoardInteraction) => void; onSample: () => void; onStake: (stake: 1 | 2 | 3) => void; onPlaceTrap: () => void }) {
  const playerTurn = game.activePlayer === 'player' && !game.gameOver
  return <section className="action-shell"><div className="action-buttons"><button className={interaction === 'move' ? 'selected' : ''} disabled={!playerTurn} onClick={() => onInteraction(interaction === 'move' ? 'idle' : 'move')}><span>△</span><b>MOVE</b><small>FREE · ONE SQUARE</small></button><button className="sample-button" disabled={!playerTurn || game.player.chips < 1 || game.playerEvidence.length >= MAX_EVIDENCE} onClick={onSample}><span>⊙</span><b>SAMPLE</b><small>−1 CHIP · NO RANGE</small></button><button className={interaction === 'trap' ? 'selected' : ''} disabled={!playerTurn || game.player.chips < 1} onClick={() => onInteraction(interaction === 'trap' ? 'idle' : 'trap')}><span>◇</span><b>TRAP</b><small>RANGE ≤ 2 · PREDICT</small></button></div>{interaction === 'trap' && <div className="trap-console"><span className="trap-instruction">{pendingTrap ? `TARGET ${coordinate(pendingTrap)}` : 'SELECT A SQUARE ON THE BOARD'}</span><div className="stake-picker"><span>STAKE</span>{[1, 2, 3].map((value) => <button key={value} className={stake === value ? 'selected' : ''} disabled={value > Math.min(MAX_STAKE, game.player.chips)} onClick={() => onStake(value as 1 | 2 | 3)}>{'●'.repeat(value)}<small>{value}</small></button>)}<button className="place-trap" disabled={!pendingTrap || stake > game.player.chips} onClick={onPlaceTrap}>PLACE TRAP <span>↗</span></button></div></div>}{interaction === 'move' && <div className="control-hint">Click a highlighted square. Movement changes trap geometry, not the evidence signal.</div>}</section>
}

function CoachFeedback({ game, visible }: { game: GameState; visible: boolean }) {
  const resolution = game.lastResolution
  if (!resolution || !game.coachMode) return <div className="coach-feedback empty" />
  const goodDecision = resolution.expectedValue >= 0
  const sentence = resolution.result === 'hit' ? goodDecision ? 'GOOD PROJECTION · The future square was worth the risk.' : 'GOOD READ, ODD PRICE · A correct result can still be a negative-EV decision.' : goodDecision ? 'GOOD READ, UNLUCKY OUTCOME · The prediction cleared break-even.' : resolution.estimatedHitProbability < 1 / 3 ? 'INSUFFICIENT EVIDENCE · The predictive mass stayed below break-even.' : 'OVERWEIGHTED THE SQUARE · The Ghost did not land where the mass was concentrated.'
  return <div className={`coach-feedback ${visible ? 'visible' : 'faded'}`}><span>✦</span><b>ENGINE HIT PROBABILITY: {percent(resolution.estimatedHitProbability)}</b><span>·</span><b>STAKE {resolution.stake} EV: {signed(resolution.expectedValue)} CHIPS</b><span>·</span><em>{sentence}</em></div>
}

function DebugPanel({ game }: { game: GameState }) {
  const sectorPosterior = debugSectorPosterior(game)
  const next = debugNextPosition(game)
  const candidates: Array<{ position: Position; probability: number }> = []
  for (let row = 0; row < 7; row += 1) for (let col = 0; col < 7; col += 1) if (isLegalTrapTarget(game.player.position, { row, col })) candidates.push({ position: { row, col }, probability: next[row][col] })
  candidates.sort((a, b) => b.probability - a.probability)
  return <section className="debug-panel"><div className="debug-head"><span>DEVELOPER LENS / EXACT HIDDEN FILTER</span><b>DEBUG ONLY</b></div><div className="debug-facts"><div><span>TRUE GHOST</span><strong>{coordinate(game.ghost.position)} · {game.ghost.direction}</strong></div><div><span>TRUE SECTOR</span><strong>{String.fromCharCode(65 + sectorForCell(game.ghost.position.row, game.ghost.position.col))}</strong></div><div><span>FILTER MASS</span><strong>{game.playerBelief.flat(2).reduce((sum, value) => sum + value, 0).toFixed(6)}</strong></div><div><span>ENTROPY / SECTOR</span><strong>{normalisedEntropy(sectorPosterior).toFixed(3)} · {sectorPosterior.map(percent).join(' · ')}</strong></div></div><div className="debug-section"><span>SECTOR POSTERIOR</span><div className="debug-bars">{sectorPosterior.map((probability, index) => <div key={index}><b>{String.fromCharCode(65 + index)}</b><i><span style={{ width: `${Math.round(probability * 100)}%` }} /></i><small>{percent(probability)}</small></div>)}</div></div><div className="debug-section"><span>PREDICTIVE POSITION / TOP LEGAL TRAPS</span><div className="debug-targets">{candidates.slice(0, 8).map(({ position, probability }) => <div key={coordinate(position)}><b>{coordinate(position)}</b><span>{percent(probability)}</span><em>{[1, 2, 3].map((stake) => `×${stake} ${signed(expectedValue(probability, stake))}`).join(' · ')}</em></div>)}</div></div><div className="debug-section"><span>LIKELIHOOD MATRIX / ROW SECTOR · COLUMN TOKEN</span><table><thead><tr><th> </th>{EVIDENCE_META.map((item) => <th key={item.id}>{item.symbol}</th>)}</tr></thead><tbody>{game.scenario.likelihoods.map((row, index) => <tr key={index}><th>{String.fromCharCode(65 + index)}</th>{row.map((value, evidence) => <td key={evidence}>{percent(value)}</td>)}</tr>)}</tbody></table></div>{game.mode === 'duel' && <div className="debug-section"><span>BOT SECTOR POSTERIOR / PRIVATE FILTER</span><strong>{sectorMarginal(game.botBelief).map(percent).join(' · ')} · TRUE STATE IS NOT IN BOT CONTEXT</strong></div>}</section>
}

function GameOver({ game, onNew }: { game: GameState; onNew: () => void }) {
  if (!game.gameOver) return null
  const win = game.outcome?.winner === 'player'
  return <section className={`game-over ${win ? 'win' : 'loss'}`}><span>PROJECTION RESOLVED</span><strong>{win ? 'YOU WIN' : 'RUIN — BOT WINS'}</strong><small>{game.outcome?.reason === 'captures' ? 'Five captures. The hidden path was projected.' : 'The chip reserve reached zero.'}</small><button onClick={onNew}>ONE MORE HUNT <span>↗</span></button></section>
}

function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame())
  const [interaction, setInteraction] = useState<BoardInteraction>('idle')
  const [pendingTrap, setPendingTrap] = useState<Position | undefined>()
  const [stake, setStake] = useState<1 | 2 | 3>(1)
  const [coachVisible, setCoachVisible] = useState(false)

  const playerTurn = game.activePlayer === 'player' && !game.gameOver
  useEffect(() => { if (game.mode !== 'duel' || game.activePlayer !== 'bot' || game.gameOver) return undefined; const timer = window.setTimeout(() => setGame((current) => applyBotTurn(current)), 620); return () => window.clearTimeout(timer) }, [game.mode, game.activePlayer, game.turn, game.gameOver])
  useEffect(() => { if (!game.lastResolution) return undefined; setCoachVisible(true); const timer = window.setTimeout(() => setCoachVisible(false), 3600); return () => window.clearTimeout(timer) }, [game.lastResolution])

  const nextPosition = useMemo(() => game.debug ? debugNextPosition(game) : undefined, [game, game.debug])
  const lastEvent = game.publicEvents[game.publicEvents.length - 1]
  const turnMessage = game.gameOver ? 'HUNT COMPLETE' : game.activePlayer === 'bot' ? 'BOT TURN · READING THE FIELD' : interaction === 'trap' ? 'PREDICT THE NEXT SQUARE' : interaction === 'move' ? 'POSITION FOR THE TRAP' : 'YOUR TURN · BUILD THE PROJECTION'

  const resetInteraction = () => { setInteraction('idle'); setPendingTrap(undefined); setStake(1) }
  const dispatch = (action: Parameters<typeof applyAction>[1]) => { if (!playerTurn) return; setGame((current) => applyAction(current, action)); resetInteraction() }
  const onCellClick = (position: Position) => { if (!playerTurn) return; if (interaction === 'move') dispatch({ type: 'move', to: position }); else if (interaction === 'trap' && isLegalTrapTarget(game.player.position, position)) setPendingTrap(position) }
  const onInteraction = (next: BoardInteraction) => { if (!playerTurn) return; if (next === 'idle') resetInteraction(); else if (next === 'move') { setInteraction('move'); setPendingTrap(undefined) } else { setInteraction('trap'); setPendingTrap(undefined) } }
  const onSample = () => dispatch({ type: 'sample' })
  const onPlaceTrap = () => { if (pendingTrap) dispatch({ type: 'trap', target: pendingTrap, stake }) }
  const newGame = (mode: GameState['mode'] = game.mode) => { setGame(setMode(mode)); resetInteraction(); setCoachVisible(false) }
  const cyclePersonality = () => setGame((current) => ({ ...current, personality: current.personality === 'conservative' ? 'balanced' : current.personality === 'balanced' ? 'aggressive' : 'conservative' }))

  return <div className="projection-app"><Header game={game} onNew={() => newGame()} onMode={() => newGame(game.mode === 'solo' ? 'duel' : 'solo')} onDebug={() => setGame((current) => ({ ...current, debug: !current.debug }))} onCoach={() => setGame((current) => ({ ...current, coachMode: !current.coachMode }))} onPersonality={cyclePersonality} /><main className="projection-main"><section className="match-strip"><div className="player-readout"><span>YOU</span><strong><Chips count={game.player.chips} /></strong><small>CAPTURES <Captures count={game.player.captures} /></small></div><div className="turn-console"><span>PROJECTION / FIELD SIGNAL</span><strong>{turnMessage}</strong><small>TURN {String(game.turn).padStart(2, '0')} · {lastEvent ? `${lastEvent.actor === 'player' ? 'YOU' : 'BOT'} ${lastEvent.action.toUpperCase()}${lastEvent.result ? ` · ${lastEvent.result.toUpperCase()}` : ''}` : 'NO PUBLIC ACTIONS YET'}</small></div>{game.mode === 'duel' ? <div className="player-readout bot-readout"><span>BOT · {botPersonalityName(game.personality)}</span><strong><Chips count={game.bot.chips} /></strong><small>CAPTURES <Captures count={game.bot.captures} color="bot" /></small></div> : <div className="solo-note"><span>SOLO FIELD</span><strong>UNCERTAINTY</strong><small>BOT AVAILABLE IN DUEL</small></div>}</section><section className="play-layout"><div className="board-column"><ProjectionBoard game={game} interaction={interaction} pendingTrap={pendingTrap} nextPosition={nextPosition} onCellClick={onCellClick} /><CoachFeedback game={game} visible={coachVisible} /><ActionControls game={game} interaction={interaction} pendingTrap={pendingTrap} stake={stake} onInteraction={onInteraction} onSample={onSample} onStake={setStake} onPlaceTrap={onPlaceTrap} /></div><aside className="side-rail"><PriorRail game={game} /><EvidenceRail game={game} /><SignalMap scenario={game.scenario} /><LawRail game={game} /></aside></section><div className="bottom-status"><span><i />LOCAL / NO NETWORK</span><span>ONE BOARD · THREE ACTIONS</span><span>LEVEL {game.level} · {game.player.chips} CHIPS · MOVE RATE IS A DESIGN VARIABLE</span></div>{game.debug && <DebugPanel game={game} />}<GameOver game={game} onNew={() => newGame()} /></main><footer className="projection-footer"><span>PROJECTION V1</span><span>GOOD PROJECTION ≠ GUARANTEED CAPTURE</span><span>5 CAPTURES TO WIN</span></footer></div>
}

export default App
