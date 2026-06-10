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

  const hits = (WINDOWS.get(key) ?? []).filter((t) => t > cutoff)
  if (hits.length >= max) {
    WINDOWS.set(key, hits)
    return false
  }

  if (!WINDOWS.has(key) && WINDOWS.size >= MAX_TRACKED_KEYS) WINDOWS.clear()
  hits.push(now)
  WINDOWS.set(key, hits)
  return true
}
