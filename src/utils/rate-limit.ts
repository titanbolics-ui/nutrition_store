// Minimal in-process fixed-window rate limiter, keyed by an arbitrary string
// (e.g. IP). Resets on process restart and isn't shared across instances —
// acceptable for this store's scale; revisit with a Redis-backed counter if
// workerMode is ever scaled horizontally.
const hits = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(
  key: string,
  opts: { max: number; windowMs: number }
): boolean {
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + opts.windowMs })
    return true
  }

  if (entry.count >= opts.max) {
    return false
  }

  entry.count += 1
  return true
}

// Test-only: clears all counters so integration tests hitting the same
// source IP repeatedly don't trip the limiter across unrelated test cases.
export function _resetRateLimitsForTests(): void {
  hits.clear()
}
