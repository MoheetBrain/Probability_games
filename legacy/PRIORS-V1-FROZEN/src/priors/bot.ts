import { MAX_EVIDENCE_PER_ROUND } from './constants'
import { allExpectedValues, maxStake, normalisedEntropy, payoutMultiplier } from './math'
import { evidenceIndex } from './rounds'
import type { BotContext, PlayerAction } from './types'

export function botContext(context: BotContext): BotContext {
  return {
    chips: context.chips,
    points: context.points,
    priors: [...context.priors],
    likelihoods: context.likelihoods.map((row) => [...row]),
    posterior: [...context.posterior],
    evidenceCount: context.evidenceCount,
    roundNumber: context.roundNumber,
  }
}

export function chooseBotAction(context: BotContext): PlayerAction {
  const availableStake = maxStake(context.chips)
  const bestState = context.posterior.reduce((best, probability, state) => probability > context.posterior[best] ? state : best, 0)
  const confidence = context.posterior[bestState] ?? 0
  const bestEv = availableStake > 0 ? allExpectedValues(context.posterior, context.priors, availableStake)[bestState] : -Infinity
  const entropy = normalisedEntropy(context.posterior)

  if (availableStake > 0 && bestEv > .25 && confidence >= .52) {
    const stake = confidence >= .8 && availableStake >= 3 ? 3 : confidence >= .65 && availableStake >= 2 ? 2 : 1
    return { type: 'bet', state: bestState, stake: Math.min(stake, availableStake) as 1 | 2 | 3 }
  }

  if (context.chips > 1 && context.evidenceCount < MAX_EVIDENCE_PER_ROUND && (entropy > .38 || context.evidenceCount < 2)) return { type: 'sample' }

  const fallbackState = context.posterior.reduce((best, probability, state) => probability > context.posterior[best] ? state : best, 0)
  const fallbackStake = Math.max(1, Math.min(availableStake, confidence >= .7 ? 2 : 1)) as 1 | 2 | 3
  return { type: 'bet', state: fallbackState, stake: fallbackStake }
}

export function botHasNoHiddenState(context: BotContext): boolean {
  return !('hiddenState' in context)
}

export function describeBotBelief(context: BotContext): string {
  const index = context.posterior.reduce((best, probability, state) => probability > context.posterior[best] ? state : best, 0)
  return `leans ${String.fromCharCode(65 + index)} · ${Math.round((context.posterior[index] ?? 0) * 100)}% · ×${payoutMultiplier(context.priors[index] ?? 0)}`
}

export { evidenceIndex }
