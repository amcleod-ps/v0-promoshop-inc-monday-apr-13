import "server-only"

/**
 * Builds a dashboard-facing error result without leaking internal detail.
 *
 * Raw Postgres/Storage messages name tables, columns, and constraints, and —
 * because every admin server action is invocable from any route by its
 * Next-Action id — those messages are reachable even when the
 * `ADMIN_DASHBOARD_PASSWORD` gate is off. We log the real cause server-side
 * (visible in the Vercel function logs) and surface the admin a clean,
 * generic message. The literal `ok: false` return type keeps the result
 * assignable to every action's `ErrorResult` union member.
 */
export function adminActionError(
  message: string,
  cause?: unknown,
): { ok: false; error: string } {
  if (cause != null) {
    console.error(`[admin-dashboard] ${message}`, cause)
  }
  return { ok: false, error: message }
}
