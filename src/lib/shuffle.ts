/** Fisher–Yates shuffle (copy). */
export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

/**
 * Keep a stable per-user order. New title IDs get shuffled in at the end.
 */
export function syncDeckOrder(existingOrder: string[], allIds: string[]): string[] {
  if (allIds.length === 0) return []
  const allSet = new Set(allIds)
  const kept = existingOrder.filter((id) => allSet.has(id))
  const keptSet = new Set(kept)
  const newcomers = shuffleArray(allIds.filter((id) => !keptSet.has(id)))
  if (kept.length === 0) return shuffleArray(allIds)
  return [...kept, ...newcomers]
}

/** Reshuffle only remaining (unswiped) titles; leave swiped ids at the end. */
export function shakeRemainingOrder(order: string[], swipedIds: Set<string>): string[] {
  const remaining = order.filter((id) => !swipedIds.has(id))
  const done = order.filter((id) => swipedIds.has(id))
  return [...shuffleArray(remaining), ...done]
}

export function orderTitlesByIds<T extends { id: string }>(
  titles: T[],
  order: string[],
): T[] {
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...titles].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}
