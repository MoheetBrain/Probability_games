export type Random = {
  next: () => number
  int: (min: number, max: number) => number
  pick: <T>(values: readonly T[]) => T
  shuffle: <T>(values: readonly T[]) => T[]
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0
  const next = () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(values: readonly T[]) => values[Math.floor(next() * values.length)] as T,
    shuffle: <T,>(values: readonly T[]) => {
      const result = [...values]
      for (let index = result.length - 1; index > 0; index -= 1) {
        const target = Math.floor(next() * (index + 1))
        ;[result[index], result[target]] = [result[target] as T, result[index] as T]
      }
      return result
    },
  }
}

export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

