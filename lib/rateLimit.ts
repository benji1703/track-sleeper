// In-memory per-instance token bucket. Good enough for a single-family app on
// Fluid Compute (instances are reused); swap for Upstash Ratelimit if this
// ever needs to be exact across instances.
const store = new Map<string, { count: number; reset: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = store.get(key)
  if (!entry || entry.reset < now) {
    store.set(key, { count: 1, reset: now + windowMs })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}
