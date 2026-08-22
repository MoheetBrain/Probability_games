import { CAPTURES_TO_WIN, DIRECTIONS, INITIAL_ENERGY, PLAYER_START, BOT_START, BOARD_SIZE } from './constants'
import { conditionOnMiss, createUniformBelief, expectedTrapValue, probabilityOfNextSquare, propagateBelief, updateBeliefWithScan } from './bayes'
import { chooseBotAction } from './bot'
import { isLegalMove, isLegalTrapTarget, legalHunterMoves, moveGhost, randomGhost, sampleScan, samePosition } from './ghost'
import type { Action, BotDecisionContext, GameOverrides, GameState, PlayerId, PlayerState, Position, PublicEvent, TrapResolution } from './types'

function clonePosition(position: Position): Position {
  return { row: position.row, col: position.col }
}

function clonePlayer(player: PlayerState): PlayerState {
  return { position: clonePosition(player.position), energy: player.energy, captures: player.captures }
}

function cloneEvent(event: PublicEvent): PublicEvent {
  return {
    ...event,
    from: event.from ? clonePosition(event.from) : undefined,
    to: event.to ? clonePosition(event.to) : undefined,
    target: event.target ? clonePosition(event.target) : undefined,
  }
}

export function createInitialGame(random: () => number = Math.random, overrides: GameOverrides = {}): GameState {
  const player: PlayerState = { position: clonePosition(PLAYER_START), energy: INITIAL_ENERGY, captures: 0, ...overrides.player }
  const bot: PlayerState = { position: clonePosition(BOT_START), energy: INITIAL_ENERGY, captures: 0, ...overrides.bot }
  const ghost = randomGhost(random, [player.position, bot.position])
  const uniform = createUniformBelief()
  return {
    turn: overrides.turn ?? 1,
    activePlayer: overrides.activePlayer ?? 'player',
    player,
    bot,
    ghost: { position: clonePosition(overrides.ghost?.position ?? ghost.position), direction: overrides.ghost?.direction ?? ghost.direction },
    playerBelief: overrides.playerBelief ?? uniform,
    botBelief: overrides.botBelief ?? createUniformBelief(),
    publicEvents: overrides.publicEvents?.map(cloneEvent) ?? [],
    debug: overrides.debug ?? false,
    coachMode: overrides.coachMode ?? true,
    gameOver: false,
  }
}

export function activePlayer(state: GameState): PlayerState {
  return state.activePlayer === 'player' ? state.player : state.bot
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'player' ? 'bot' : 'player'
}

export function legalAction(state: GameState, action: Action, actor: PlayerId = state.activePlayer): boolean {
  if (state.gameOver || actor !== state.activePlayer) return false
  const player = actor === 'player' ? state.player : state.bot
  const opponent = actor === 'player' ? state.bot : state.player
  if (action.type === 'move') return isLegalMove(player.position, action.to, opponent.position)
  if (action.type === 'scan') return player.energy >= 1
  return player.energy >= action.stake && isLegalTrapTarget(player.position, action.target) && [1, 2, 3].includes(action.stake)
}

export function legalActions(state: GameState, actor: PlayerId = state.activePlayer): Action[] {
  if (state.gameOver || actor !== state.activePlayer) return []
  const player = actor === 'player' ? state.player : state.bot
  const opponent = actor === 'player' ? state.bot : state.player
  const actions: Action[] = legalHunterMoves(player.position, opponent.position).map((to) => ({ type: 'move', to }))
  if (player.energy >= 1) actions.push({ type: 'scan' })
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const target = { row, col }
      if (!isLegalTrapTarget(player.position, target)) continue
      for (const stake of [1, 2, 3] as const) if (player.energy >= stake) actions.push({ type: 'trap', target, stake })
    }
  }
  return actions
}

export function botContext(state: GameState): BotDecisionContext {
  return {
    bot: clonePlayer(state.bot),
    opponent: clonePlayer(state.player),
    belief: state.botBelief,
    publicEvents: state.publicEvents.map(cloneEvent),
    turn: state.turn,
  }
}

function eventFor(state: GameState, actor: PlayerId, action: Action): PublicEvent {
  const player = actor === 'player' ? state.player : state.bot
  return {
    id: `${state.turn}-${actor}-${state.publicEvents.length}`,
    turn: state.turn,
    actor,
    action: action.type,
    from: action.type === 'move' ? clonePosition(player.position) : undefined,
    to: action.type === 'move' ? clonePosition(action.to) : undefined,
    target: action.type === 'trap' ? clonePosition(action.target) : undefined,
    stake: action.type === 'trap' ? action.stake : undefined,
  }
}

function withBeliefs(state: GameState, playerBelief: GameState['playerBelief'], botBelief: GameState['botBelief']): GameState {
  return { ...state, playerBelief, botBelief }
}

function evaluateOutcome(state: GameState, actor: PlayerId): GameState['outcome'] {
  const actorState = actor === 'player' ? state.player : state.bot
  const other = opponentOf(actor)
  const otherState = other === 'player' ? state.player : state.bot
  if (actorState.captures >= CAPTURES_TO_WIN) return { winner: actor, reason: 'captures' }
  if (actorState.energy <= 0) return { winner: other, reason: 'ruin' }
  if (otherState.energy <= 0) return { winner: actor, reason: 'ruin' }
  return undefined
}

function resolveTrap(
  state: GameState,
  actor: PlayerId,
  action: Extract<Action, { type: 'trap' }>,
  beliefBeforeMove: GameState['playerBelief'],
  movedGhost: GameState['ghost'],
  random: () => number,
): { state: GameState; resolution: TrapResolution } {
  const estimatedHitProbability = probabilityOfNextSquare(beliefBeforeMove, action.target)
  const hit = samePosition(movedGhost.position, action.target)
  const actorState = actor === 'player' ? { ...state.player } : { ...state.bot }
  actorState.energy -= action.stake
  let ghost = movedGhost
  let playerBelief = propagateBelief(state.playerBelief)
  let botBelief = propagateBelief(state.botBelief)
  const resolution: TrapResolution = {
    actor,
    target: clonePosition(action.target),
    stake: action.stake,
    result: hit ? 'hit' : 'miss',
    estimatedHitProbability,
    expectedValue: expectedTrapValue(estimatedHitProbability, action.stake),
    energyDelta: hit ? action.stake * 2 : -action.stake,
    revealedGhost: hit ? clonePosition(action.target) : undefined,
  }

  if (hit) {
    actorState.captures += 1
    actorState.energy += action.stake * 3
    ghost = randomGhost(random, [state.player.position, state.bot.position])
    playerBelief = createUniformBelief()
    botBelief = createUniformBelief()
  } else {
    playerBelief = conditionOnMiss(playerBelief, action.target)
    botBelief = conditionOnMiss(botBelief, action.target)
  }

  const next = actor === 'player' ? { ...state, player: actorState, ghost, playerBelief, botBelief } : { ...state, bot: actorState, ghost, playerBelief, botBelief }
  return { state: next, resolution }
}

/** Resolve one complete ply: action, one ghost move, optional trap result, then hand over. */
export function applyAction(state: GameState, action: Action, random: () => number = Math.random): GameState {
  const actor = state.activePlayer
  if (!legalAction(state, action, actor)) return state
  const publicEvent = eventFor(state, actor, action)
  const player = clonePlayer(state.player)
  const bot = clonePlayer(state.bot)
  let next: GameState = {
    ...state,
    turn: state.turn + 1,
    player,
    bot,
    playerBelief: state.playerBelief,
    botBelief: state.botBelief,
    publicEvents: [...state.publicEvents, publicEvent],
    lastAction: { ...action, actor },
    lastResolution: undefined,
    playerLastScan: state.playerLastScan,
  }

  if (action.type === 'move') {
    const movingPlayer = actor === 'player' ? next.player : next.bot
    movingPlayer.position = clonePosition(action.to)
  }

  if (action.type === 'scan') {
    const scanningPlayer = actor === 'player' ? next.player : next.bot
    scanningPlayer.energy -= 1
    const result = sampleScan(next.ghost.position, scanningPlayer.position, random)
    const belief = actor === 'player' ? next.playerBelief : next.botBelief
    const updated = updateBeliefWithScan(belief, scanningPlayer.position, result)
    next = withBeliefs(next, actor === 'player' ? updated : next.playerBelief, actor === 'bot' ? updated : next.botBelief)
    if (actor === 'player') next.playerLastScan = { turn: state.turn, result }
  }

  const beliefBeforeMove = actor === 'player' ? next.playerBelief : next.botBelief
  const movedGhost = moveGhost(next.ghost, random)
  if (action.type === 'trap') {
    const resolved = resolveTrap(next, actor, action, beliefBeforeMove, movedGhost, random)
    next = { ...resolved.state, lastResolution: resolved.resolution }
    const event = next.publicEvents[next.publicEvents.length - 1]
    next.publicEvents = [...next.publicEvents.slice(0, -1), { ...event, result: resolved.resolution.result }]
  } else {
    next = { ...next, ghost: movedGhost, playerBelief: propagateBelief(next.playerBelief), botBelief: propagateBelief(next.botBelief) }
  }

  const outcome = evaluateOutcome(next, actor)
  if (outcome) return { ...next, outcome, gameOver: true }
  return { ...next, activePlayer: opponentOf(actor) }
}

export function applyBotTurn(state: GameState, random: () => number = Math.random): GameState {
  if (state.gameOver || state.activePlayer !== 'bot') return state
  return applyAction(state, chooseBotAction(botContext(state)), random)
}

export function simulateMatch(random: () => number = Math.random, maxActions = 500): GameState {
  let state = createInitialGame(random)
  let actionCount = 0
  while (!state.gameOver && actionCount < maxActions) {
    const action = state.activePlayer === 'bot'
      ? chooseBotAction(botContext(state))
      : legalActions(state, 'player')[Math.floor(random() * legalActions(state, 'player').length)]
    state = applyAction(state, action, random)
    actionCount += 1
  }
  return state
}
