import "server-only"

/**
 * Best-effort in-memory rate limit for admin image uploads. The dashboard is
 * unauthenticated (URL-is-the-secret), so without any cap a leaked URL lets
 * storage grow without bound. State is per server instance — serverless
 * scale-out multiplies the effective limit — but it still bounds sustained
 * abuse through any single instance without needing extra infrastructure.
 */
const WINDOW_MS = 60_000
const MAX_UPLOADS_PER_WINDOW = 20

let recentUploads: number[] = []

export function checkUploadRateLimit():
  | { ok: true }
  | { ok: false; error: string } {
  const now = Date.now()
  recentUploads = recentUploads.filter((t) => now - t < WINDOW_MS)
  if (recentUploads.length >= MAX_UPLOADS_PER_WINDOW) {
    return {
      ok: false,
      error: "Too many uploads in the last minute. Wait a moment and try again.",
    }
  }
  recentUploads.push(now)
  return { ok: true }
}
