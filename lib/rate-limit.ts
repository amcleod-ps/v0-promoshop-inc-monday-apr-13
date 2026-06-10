import "server-only"

/**
 * Minimal in-memory sliding-window rate limiter for the public quote form.
 *
 * State is module-scoped, so on Vercel it is per-serverless-instance and
 * resets on cold start. That's deliberate: it blunts scripted spam bursts
 * with zero infrastructure. If real cross-instance limiting is ever needed,
 * swap this for Upstash Ratelimit / Redis behind the same function shape.
 */
const WINDOWS = new Map<string, number[]>()

// Crude memory bound: a long-lived instance hammered from many IPs resets
// rather than growing without limit.
const MAX_TRACKED_KEYS = 5_000

/** Returns true when the call is allowed, false when the key is over budget. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const cutoff = now - windowMs

  const existed = WINDOWS.has(key)
  const hits = (WINDOWS.get(key) ?? []).filter((t) => t > cutoff)
  // Delete-before-set keeps Map insertion order ≈ recency, so the eviction
  // below removes the least-recently-ACTIVE buckets instead of long-lived
  // (possibly currently-throttled) ones.
  if (existed) WINDOWS.delete(key)
  if (hits.length >= max) {
    WINDOWS.set(key, hits)
    return false
  }

  if (!existed && WINDOWS.size >= MAX_TRACKED_KEYS) {
    // Evict the oldest-inserted entries instead of clearing everything —
    // a full clear() would let a distributed attacker reset every active
    // bucket (including their own) just by burning through 5,000 keys.
    let toEvict = Math.ceil(MAX_TRACKED_KEYS / 10)
    for (const oldest of WINDOWS.keys()) {
      WINDOWS.delete(oldest)
      if (--toEvict <= 0) break
    }
  }
  hits.push(now)
  WINDOWS.set(key, hits)
  return true
}
