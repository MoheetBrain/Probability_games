import type { LifetimeStats, TurnRecord } from './types'

export const STATS_KEY = 'oracle-lifetime-stats-v0'

export const DEFAULT_STATS: LifetimeStats = {
  totalRuns: 0,
  bestCapital: 10000,
  averageBrier: 0,
  forecastAccuracy: 0,
  calibration: 0,
  averageBetSize: 0,
  ruinCount: 0,
  longestSurvival: 0,
  oracleRating: 500,
  totalTurns: 0,
}

export function loadStats(storage: Storage = localStorage): LifetimeStats {
  try {
    const raw = storage.getItem(STATS_KEY)
    if (!raw) return { ...DEFAULT_STATS }
    return { ...DEFAULT_STATS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_STATS }
  }
}

export function saveStats(stats: LifetimeStats, storage: Storage = localStorage): void {
  storage.setItem(STATS_KEY, JSON.stringify(stats))
}

export function updateLifetimeStats(previous: LifetimeStats, records: TurnRecord[], finalCapital: number, ruined: boolean): LifetimeStats {
  if (!records.length) return previous
  const turns = records.length
  const brierTotal = records.reduce((sum, record) => sum + record.brier, 0)
  const accuracyTotal = records.reduce((sum, record) => sum + record.forecast[record.actualState], 0)
  const calibration = records.reduce((sum, record) => sum + record.calibration, 0) / turns
  const betTotal = records.reduce((sum, record) => sum + record.stake, 0)
  const decisionAverage = records.reduce((sum, record) => sum + record.decisionQuality, 0) / turns
  const ratingDelta = (decisionAverage - 60) * 1.8
  return {
    totalRuns: previous.totalRuns + 1,
    bestCapital: Math.max(previous.bestCapital, finalCapital),
    averageBrier: (previous.averageBrier * previous.totalTurns + brierTotal) / (previous.totalTurns + turns),
    forecastAccuracy: (previous.forecastAccuracy * previous.totalTurns + accuracyTotal) / (previous.totalTurns + turns),
    calibration: (previous.calibration * previous.totalTurns + calibration * turns) / (previous.totalTurns + turns),
    averageBetSize: (previous.averageBetSize * previous.totalTurns + betTotal) / (previous.totalTurns + turns),
    ruinCount: previous.ruinCount + (ruined ? 1 : 0),
    longestSurvival: Math.max(previous.longestSurvival, turns),
    oracleRating: Math.max(0, Math.min(999, Math.round(previous.oracleRating + ratingDelta))),
    totalTurns: previous.totalTurns + turns,
  }
}
