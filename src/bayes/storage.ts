import { createProfile } from './player'
import type { PlayerProfile } from './types'

const PROFILE_KEY = 'bayes-v1-profile'

export function loadProfile(): PlayerProfile {
  try {
    const value = localStorage.getItem(PROFILE_KEY)
    if (!value) return createProfile()
    const parsed = JSON.parse(value) as PlayerProfile
    const fallback = createProfile()
    return {
      ...fallback,
      ...parsed,
      skills: { ...fallback.skills, ...parsed.skills },
      misconceptions: { ...fallback.misconceptions, ...parsed.misconceptions },
      schedule: { ...fallback.schedule, ...parsed.schedule },
      confidence: { ...fallback.confidence, ...parsed.confidence },
    }
  } catch {
    return createProfile()
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)) } catch { /* local play remains available */ }
}

export function clearProfile(): void {
  try { localStorage.removeItem(PROFILE_KEY) } catch { /* no-op */ }
}

