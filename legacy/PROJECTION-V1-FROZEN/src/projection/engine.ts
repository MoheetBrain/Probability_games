import { applyEvidence, conditionOnMiss, createPriorBelief, normaliseBelief, probabilityOfNextPosition, propagateBelief, sectorMarginal } from './bayes'
import { chooseBotAction } from './bot'
import { CAPTURES_TO_WIN, EVIDENCE_IDS, INITIAL_CHIPS, MAX_EVIDENCE, MAX_STAKE } from './constants'
import { chebyshevDistance, isLegalTrapTarget, legalHunterMoves, moveGhost, randomGhost, sampleEvidence } from './ghost'
import { createScenario, levelForCaptures } from './scenario'
import type { Action, BotContext, GameOverrides, GameState, PlayerId, PlayerState, Position, PublicEvent, TrapResolution } from './types'

function clonePosition(position: Position): Position { return { row: position.row, col: position.col } }
function clonePlayer(player: PlayerState): PlayerState { return { position: clonePosition(player.position), chips: player.chips, captures: player.captures } }
function cloneAction(action: Action): Action { return action.type === 'move' ? { type: 'move', to: clonePosition(action.to) } : action.type === 'trap' ? { type: 'trap', target: clonePosition(action.target), stake: action.stake } : { type: 'sample' } }
function cloneEvent(event: PublicEvent): PublicEvent { return { ...event, from: event.from && clonePosition(event.from), to: event.to && clonePosition(event.to), target: event.target && clonePosition(event.target) } }

export function createInitialGame(random: () => number = Math.random, overrides: GameOverrides = {}): GameState {
  const scenario = overrides.scenario ?? createScenario(1, random)
  const playerPosition = overrides.player?.position ?? { row: 6, col: 3 }
  const botPosition = overrides.bot?.position ?? { row: 0, col: 3 }
  const ghost = randomGhost(scenario, random)
  return {
    mode: overrides.mode ?? 'solo',
    activePlayer: overrides.activePlayer ?? 'player',
    turn: 1,
    level: scenario.level,
    scenario,
    player: { position: clonePosition(playerPosition), chips: INITIAL_CHIPS, captures: 0, ...overrides.player },
    bot: { position: clonePosition(botPosition), chips: INITIAL_CHIPS, captures: 0, ...overrides.bot },
    ghost: overrides.ghost?.position && overrides.ghost?.direction ? { position: clonePosition(overrides.ghost.position), direction: overrides.ghost.direction } : ghost,
    playerBelief: overrides.playerBelief ?? createPriorBelief(scenario.priors),
    botBelief: overrides.botBelief ?? createPriorBelief(scenario.priors),
    playerEvidence: [],
    botEvidence: [],
    publicEvents: [],
    gameOver: false,
    coachMode: true,
    debug: false,
    personality: 'balanced',
  }
}

function playerFor(state: GameState, actor: PlayerId): PlayerState { return actor === 'player' ? state.player : state.bot }
function opponentOf(actor: PlayerId): PlayerId { return actor === 'player' ? 'bot' : 'player' }
function legalMove(from: Position, to: Position, opponent: Position): boolean { return legalHunterMoves(from, opponent).some((position) => position.row === to.row && position.col === to.col) }

export function legalAction(state: GameState, action: Action, actor: PlayerId = state.activePlayer): boolean {
  if (state.gameOver || actor !== state.activePlayer) return false
  const current = playerFor(state, actor)
  const opponent = playerFor(state, opponentOf(actor))
  if (action.type === 'move') return legalMove(current.position, action.to, opponent.position)
  if (action.type === 'sample') return current.chips >= 1 && (actor === 'player' ? state.playerEvidence : state.botEvidence).length < MAX_EVIDENCE
  return current.chips >= action.stake && [1, 2, 3].includes(action.stake) && isLegalTrapTarget(current.position, action.target)
}

function eventFor(state: GameState, actor: PlayerId, action: Action): PublicEvent {
  const current = playerFor(state, actor)
  return { id: `${state.turn}-${actor}-${state.publicEvents.length}`, turn: state.turn, actor, action: action.type, from: action.type === 'move' ? clonePosition(current.position) : undefined, to: action.type === 'move' ? clonePosition(action.to) : undefined, target: action.type === 'trap' ? clonePosition(action.target) : undefined, stake: action.type === 'trap' ? action.stake : undefined }
}

function ageEvidence(evidence: GameState['playerEvidence']): GameState['playerEvidence'] { return evidence.map((token) => ({ ...token, age: token.age + 1 })) }
function expectedTrapValue(probability: number, stake: number): number { return stake * (3 * probability - 1) }

function outcomeFor(state: GameState, actor: PlayerId): GameState['outcome'] {
  const current = playerFor(state, actor)
  const other = playerFor(state, opponentOf(actor))
  if (current.captures >= CAPTURES_TO_WIN) return { winner: actor, reason: 'captures' }
  if (current.chips <= 0) return { winner: opponentOf(actor), reason: 'ruin' }
  if (other.chips <= 0) return { winner: actor, reason: 'ruin' }
  return undefined
}

export function applyAction(state: GameState, action: Action, random: () => number = Math.random): GameState {
  const actor = state.activePlayer
  if (!legalAction(state, action, actor)) return state
  const publicEvent = eventFor(state, actor, action)
  const player = clonePlayer(state.player)
  const bot = clonePlayer(state.bot)
  let playerBelief = state.playerBelief
  let botBelief = state.botBelief
  let playerEvidence = state.playerEvidence
  let botEvidence = state.botEvidence
  let actorBelief = actor === 'player' ? playerBelief : botBelief
  let movedGhost = state.ghost
  let scenario = state.scenario
  let resolution: TrapResolution | undefined

  if (action.type === 'move') { if (actor === 'player') player.position = clonePosition(action.to); else bot.position = clonePosition(action.to) }

  if (action.type === 'sample') {
    const evidenceIndex = sampleEvidence(state.ghost, state.scenario, random)
    actorBelief = applyEvidence(actorBelief, evidenceIndex, state.scenario.likelihoods)
    const evidence = { id: (actor === 'player' ? playerEvidence : botEvidence).length, type: EVIDENCE_IDS[evidenceIndex], age: 0 }
    if (actor === 'player') { player.chips -= 1; playerEvidence = [...playerEvidence, evidence] } else { bot.chips -= 1; botEvidence = [...botEvidence, evidence] }
  }

  if (action.type === 'trap') {
    const estimatedHitProbability = probabilityOfNextPosition(actorBelief, action.target, state.scenario.movement)
    resolution = { actor, target: clonePosition(action.target), stake: action.stake, result: 'miss', estimatedHitProbability, expectedValue: expectedTrapValue(estimatedHitProbability, action.stake), energyDelta: -action.stake }
    if (actor === 'player') player.chips -= action.stake; else bot.chips -= action.stake
  }

  if (action.type === 'sample') {
    if (actor === 'player') playerBelief = actorBelief; else botBelief = actorBelief
  }
  movedGhost = moveGhost(state.ghost, state.scenario.movement, random)
  playerBelief = propagateBelief(playerBelief, state.scenario.movement)
  botBelief = propagateBelief(botBelief, state.scenario.movement)

  if (action.type === 'trap' && resolution) {
    const hit = movedGhost.position.row === action.target.row && movedGhost.position.col === action.target.col
    resolution.result = hit ? 'hit' : 'miss'
    if (hit) {
      const current = actor === 'player' ? player : bot
      current.captures += 1
      current.chips += action.stake * 3
      resolution.energyDelta = action.stake * 2
      resolution.revealedGhost = clonePosition(action.target)
      scenario = createScenario(levelForCaptures(current.captures), random)
      movedGhost = randomGhost(scenario, random)
      playerBelief = createPriorBelief(scenario.priors)
      botBelief = createPriorBelief(scenario.priors)
      playerEvidence = []
      botEvidence = []
    } else {
      playerBelief = conditionOnMiss(playerBelief, action.target)
      botBelief = conditionOnMiss(botBelief, action.target)
    }
  }

  const publicEvents = [...state.publicEvents, { ...publicEvent, result: action.type === 'trap' ? resolution?.result : undefined }]
  const next: GameState = { ...state, turn: state.turn + 1, player, bot, ghost: movedGhost, playerBelief, botBelief, playerEvidence: action.type === 'trap' && resolution?.result === 'hit' ? [] : ageEvidence(playerEvidence), botEvidence: action.type === 'trap' && resolution?.result === 'hit' ? [] : ageEvidence(botEvidence), publicEvents, lastAction: { ...cloneAction(action), actor }, lastResolution: resolution, scenario, level: scenario.level }
  const outcome = outcomeFor(next, actor)
  if (outcome) return { ...next, gameOver: true, outcome }
  return { ...next, activePlayer: state.mode === 'duel' ? opponentOf(actor) : 'player' }
}

export function botContext(state: GameState): BotContext {
  return { bot: clonePlayer(state.bot), opponent: clonePlayer(state.player), belief: state.botBelief, scenario: state.scenario, evidenceCount: state.botEvidence.length, publicEvents: state.publicEvents.map(cloneEvent), personality: state.personality, turn: state.turn }
}

export function applyBotTurn(state: GameState, random: () => number = Math.random): GameState {
  if (state.gameOver || state.mode !== 'duel' || state.activePlayer !== 'bot') return state
  return applyAction(state, chooseBotAction(botContext(state)), random)
}

export function legalActions(state: GameState, actor: PlayerId = state.activePlayer): Action[] {
  if (state.gameOver || actor !== state.activePlayer) return []
  const current = playerFor(state, actor)
  const opponent = playerFor(state, opponentOf(actor))
  const actions: Action[] = legalHunterMoves(current.position, opponent.position).map((to) => ({ type: 'move', to }))
  if (current.chips >= 1) actions.push({ type: 'sample' })
  for (let row = 0; row < 7; row += 1) for (let col = 0; col < 7; col += 1) if (isLegalTrapTarget(current.position, { row, col })) for (const stake of [1, 2, 3] as const) if (current.chips >= stake) actions.push({ type: 'trap', target: { row, col }, stake })
  return actions
}

export interface MatchSimulation {
  state: GameState
  actions: number
  playerWins: number
  botWins: number
}

export function simulateBotMatch(random: () => number = Math.random, maxActions = 500, startLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 1): MatchSimulation {
  let state = createInitialGame(random, { mode: 'duel', scenario: createScenario(startLevel, random) })
  let actions = 0
  while (!state.gameOver && actions < maxActions) {
    if (state.activePlayer === 'bot') state = applyBotTurn(state, random)
    else {
      const available = legalActions(state, 'player')
      state = applyAction(state, available[Math.floor(Math.min(.999999999, Math.max(0, random())) * available.length)], random)
    }
    actions += 1
  }
  return { state, actions, playerWins: state.outcome?.winner === 'player' ? 1 : 0, botWins: state.outcome?.winner === 'bot' ? 1 : 0 }
}

export function setMode(mode: GameState['mode'], random: () => number = Math.random): GameState { return { ...createInitialGame(random), mode } }
export function debugSectorPosterior(state: GameState): number[] { return sectorMarginal(state.playerBelief) }
export function debugNextPosition(state: GameState): number[][] { return propagateBelief(state.playerBelief, state.scenario.movement).map((row) => row.map((cell) => cell.reduce((sum, value) => sum + value, 0))) }
export function targetDistanceToHunter(state: GameState, target: Position): number { return chebyshevDistance(state.player.position, target) }
export { normaliseBelief }
