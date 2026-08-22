import type { TrapResolution } from '../game/types'

export function CoachFeedback({ resolution, visible }: { resolution?: TrapResolution; visible: boolean }) {
  if (!resolution || !visible) return <div className="coach-feedback empty" aria-live="polite" />
  const positive = resolution.expectedValue >= 0
  return (
    <div className="coach-feedback" aria-live="polite">
      <span className="coach-spark">✦</span>
      <span><b>Bayesian review</b> · {resolution.actor === 'player' ? 'your' : 'bot'} estimate: <strong>{Math.round(resolution.estimatedHitProbability * 100)}%</strong> · stake {resolution.stake} at ×3 payoff → <em className={positive ? 'positive' : 'negative'}>{positive ? 'positive' : 'negative'} EV</em>.</span>
    </div>
  )
}
