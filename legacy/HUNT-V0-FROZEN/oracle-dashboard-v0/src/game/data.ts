import type { Opportunity, SignalDefinition, TransitionMatrix } from './types'

export const BASE_PRIOR = { growth: 0.34, stable: 0.42, decline: 0.24 }

export const BASE_TRANSITION_MATRIX: TransitionMatrix = {
  growth: { growth: 0.75, stable: 0.2, decline: 0.05 },
  stable: { growth: 0.2, stable: 0.6, decline: 0.2 },
  decline: { growth: 0.05, stable: 0.25, decline: 0.7 },
}

export const SIGNALS: SignalDefinition[] = [
  { id: 'demand-accelerated', label: 'Demand accelerated', detail: 'Orders moved faster than the recent baseline.', tone: 'positive', likelihoods: { growth: 0.75, stable: 0.35, decline: 0.12 } },
  { id: 'demand-softened', label: 'Demand softened', detail: 'New requests arrived below the recent baseline.', tone: 'negative', likelihoods: { growth: 0.14, stable: 0.38, decline: 0.72 } },
  { id: 'prototype-succeeded', label: 'Prototype test succeeded', detail: 'A key experiment cleared its acceptance threshold.', tone: 'positive', likelihoods: { growth: 0.68, stable: 0.34, decline: 0.16 } },
  { id: 'prototype-failed', label: 'Prototype test failed', detail: 'A key experiment missed its acceptance threshold.', tone: 'negative', likelihoods: { growth: 0.15, stable: 0.33, decline: 0.7 } },
  { id: 'failure-rate-increased', label: 'Failure rate increased', detail: 'Reliability drifted outside its normal range.', tone: 'negative', likelihoods: { growth: 0.12, stable: 0.32, decline: 0.74 } },
  { id: 'reliability-improving', label: 'Reliability improving', detail: 'Fewer incidents were observed this cycle.', tone: 'positive', likelihoods: { growth: 0.7, stable: 0.44, decline: 0.18 } },
  { id: 'new-customers', label: 'New customers arrived', detail: 'A cluster of previously unseen buyers appeared.', tone: 'positive', likelihoods: { growth: 0.64, stable: 0.42, decline: 0.2 } },
  { id: 'customers-churned', label: 'Customers quietly churned', detail: 'Several long-standing users did not renew.', tone: 'negative', likelihoods: { growth: 0.16, stable: 0.36, decline: 0.66 } },
  { id: 'operating-costs-rose', label: 'Operating costs rose', detail: 'Input and delivery costs moved higher.', tone: 'negative', likelihoods: { growth: 0.22, stable: 0.48, decline: 0.68 } },
  { id: 'costs-stayed-flat', label: 'Operating costs stayed flat', detail: 'The cost base remained within its normal band.', tone: 'neutral', likelihoods: { growth: 0.44, stable: 0.54, decline: 0.38 } },
  { id: 'research-accelerated', label: 'Research progress accelerated', detail: 'The next milestone arrived earlier than planned.', tone: 'positive', likelihoods: { growth: 0.72, stable: 0.3, decline: 0.12 } },
  { id: 'research-stalled', label: 'Research progress stalled', detail: 'The next milestone slipped again.', tone: 'negative', likelihoods: { growth: 0.18, stable: 0.38, decline: 0.64 } },
  { id: 'production-bottleneck', label: 'Production bottleneck found', detail: 'A constraint appeared in the delivery chain.', tone: 'negative', likelihoods: { growth: 0.2, stable: 0.38, decline: 0.67 } },
  { id: 'production-capacity', label: 'Production capacity expanded', detail: 'A second route to delivery came online.', tone: 'positive', likelihoods: { growth: 0.67, stable: 0.36, decline: 0.16 } },
  { id: 'sentiment-diverged', label: 'Sentiment diverged', detail: 'Observers strongly disagreed about the next phase.', tone: 'neutral', likelihoods: { growth: 0.36, stable: 0.5, decline: 0.34 } },
  { id: 'competitor-quiet', label: 'Competitors went quiet', detail: 'The usual noise from adjacent teams disappeared.', tone: 'neutral', likelihoods: { growth: 0.3, stable: 0.52, decline: 0.38 } },
  { id: 'lead-times-shortened', label: 'Lead times shortened', detail: 'Requests were fulfilled with less waiting.', tone: 'positive', likelihoods: { growth: 0.66, stable: 0.4, decline: 0.2 } },
  { id: 'lead-times-lengthened', label: 'Lead times lengthened', detail: 'Fulfilment required more waiting than usual.', tone: 'negative', likelihoods: { growth: 0.2, stable: 0.4, decline: 0.7 } },
  { id: 'quality-complaints', label: 'Quality complaints increased', detail: 'More users reported friction after delivery.', tone: 'negative', likelihoods: { growth: 0.12, stable: 0.34, decline: 0.72 } },
  { id: 'quality-praise', label: 'Quality praise spread', detail: 'Independent users highlighted the experience.', tone: 'positive', likelihoods: { growth: 0.68, stable: 0.43, decline: 0.2 } },
  { id: 'cash-buffer', label: 'Cash buffer widened', detail: 'The operating buffer is larger than forecast.', tone: 'positive', likelihoods: { growth: 0.56, stable: 0.54, decline: 0.26 } },
  { id: 'cash-buffer-thinned', label: 'Cash buffer thinned', detail: 'The operating buffer is under pressure.', tone: 'negative', likelihoods: { growth: 0.18, stable: 0.4, decline: 0.7 } },
  { id: 'small-breakthrough', label: 'Small breakthrough logged', detail: 'A modest but repeatable improvement was verified.', tone: 'positive', likelihoods: { growth: 0.58, stable: 0.4, decline: 0.2 } },
  { id: 'small-regression', label: 'Small regression logged', detail: 'A modest setback appeared in the latest sample.', tone: 'negative', likelihoods: { growth: 0.2, stable: 0.4, decline: 0.6 } },
]

export const OPPORTUNITIES: Opportunity[] = [
  { id: 'slow-burn', title: 'Measured expansion', subtitle: 'A steady route with limited upside.', multipliers: { growth: 1.8, stable: 1.16, decline: 0.72 }, volatility: 'LOW', accent: 'cyan' },
  { id: 'breakout', title: 'Breakout allocation', subtitle: 'Large upside, but the floor is thin.', multipliers: { growth: 3.6, stable: 1.04, decline: 0.2 }, volatility: 'HIGH', accent: 'violet' },
  { id: 'contrarian', title: 'Contrarian position', subtitle: 'A cheap option against the obvious story.', multipliers: { growth: 0.7, stable: 1.08, decline: 4.5 }, volatility: 'EXTREME', accent: 'rose' },
  { id: 'carry', title: 'Quiet carry', subtitle: 'A little edge, with a very forgiving downside.', multipliers: { growth: 1.38, stable: 1.12, decline: 0.84 }, volatility: 'LOW', accent: 'amber' },
  { id: 'moonshot', title: 'Long-shot experiment', subtitle: 'Rare payoff. Most paths go nowhere.', multipliers: { growth: 5.2, stable: 0.74, decline: 0.42 }, volatility: 'EXTREME', accent: 'violet' },
  { id: 'resilience', title: 'Resilience hedge', subtitle: 'Pays for stability when conditions turn.', multipliers: { growth: 0.9, stable: 1.35, decline: 1.75 }, volatility: 'MEDIUM', accent: 'cyan' },
  { id: 'levered-growth', title: 'Conviction push', subtitle: 'A high-EV route that punishes overconfidence.', multipliers: { growth: 3.2, stable: 0.88, decline: 0.12 }, volatility: 'HIGH', accent: 'rose' },
  { id: 'balanced', title: 'Balanced exposure', subtitle: 'The market has already priced in some uncertainty.', multipliers: { growth: 1.62, stable: 1.14, decline: 0.62 }, volatility: 'MEDIUM', accent: 'amber' },
  { id: 'stability', title: 'Stability premium', subtitle: 'A modest return for a calmer path.', multipliers: { growth: 1.12, stable: 1.28, decline: 0.9 }, volatility: 'LOW', accent: 'cyan' },
  { id: 'binary', title: 'Binary catalyst', subtitle: 'A sharp catalyst with little middle ground.', multipliers: { growth: 4.2, stable: 0.52, decline: 0.3 }, volatility: 'EXTREME', accent: 'violet' },
  { id: 'recovery', title: 'Recovery note', subtitle: 'Looks dull until the world begins to heal.', multipliers: { growth: 1.9, stable: 0.98, decline: 0.55 }, volatility: 'MEDIUM', accent: 'amber' },
  { id: 'defensive', title: 'Defensive shelter', subtitle: 'The cost of safety is visible in the upside.', multipliers: { growth: 0.96, stable: 1.2, decline: 1.4 }, volatility: 'LOW', accent: 'cyan' },
]
