import { DEFAULT_STATS, STATS_KEY } from './constants'
import type { GameState, Stats } from './types'

export function loadStats(storage: Storage = localStorage): Stats {
  try {
    const raw = storage.getItem(STATS_KEY)
    if (!raw) return { ...DEFAULT_STATS }
    return { ...DEFAULT_STATS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(stats: Stats, storage: Storage = localStorage): void {
  storage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function recordGame(stats: Stats, game: GameState): Stats {
  if (!game.outcome) return stats
  const won = game.outcome.winner === 'player'
  const ruined = game.outcome.reason === 'ruin'
  const nextGames = stats.gamesPlayed + 1
  const remainingEnergy = game.player.energy
  return {
    gamesPlayed: nextGames,
    wins: stats.wins + (won ? 1 : 0),
    losses: stats.losses + (won ? 0 : 1),
    captures: stats.captures + game.player.captures,
    ruins: stats.ruins + (ruined ? 1 : 0),
    averageEnergyRemaining: Math.round((stats.averageEnergyRemaining * stats.gamesPlayed + remainingEnergy) / nextGames * 10) / 10,
  }
}
