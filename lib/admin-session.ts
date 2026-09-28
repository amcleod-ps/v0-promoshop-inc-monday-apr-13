import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  adminPasswordHashWellFormed,
  adminPasswordStrongEnough,
  hashAdminPassword,
  verifyAdminPassword,
  type AdminPasswordState,
} from "./admin-session-crypto"

/**
 * Server-side administrator credential state + rotation.
 *
 * The active administrator credential lives in the singleton `admin_access`
 * table (migration 0019, service-role only, forced RLS, no policies). The
 * ADMIN_DASHBOARD_PASSWORD environment variable is the fallback ONLY while
 * the table has no row at all; the moment a row exists, the database hash is
 * the sole authority and the environment password is retired. Any failure —
 * a read error, missing service-role configuration, or a row with a missing
 * or malformed password_hash — FAILS CLOSED to { source: "none" }.
 *
 * Recovery when the database password is lost is external: the account owner
 * deletes or replaces the row through the authorized Supabase control plane
 * (SQL Editor / Dashboard). There is no public recovery route by design.
 *
 * Nothing here logs credentials, and error results carry no credential data.
 */

// Pure cryptography lives in ./admin-session-crypto (no "server-only") so it
// can run under tsx unit tests; re-export it so server callers — the proxy,
// future server actions — need only this one import.
export {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminPasswordStrongEnough,
  createAdminSessionToken,
  hashAdminPassword,
  validateAdminSessionToken,
  verifyAdminPassword,
  type AdminPasswordState,
  type AdminSessionCheck,
} from "./admin-session-crypto"

export type AdminRotationResult =
  | { ok: true }
  | {
      ok: false
      reason:
        | "unavailable"
        | "wrong-current"
        | "weak"
        | "unchanged"
        | "no-current-secret"
        | "concurrent-change"
    }

/**
 * Read the active password state.
 *
 * - Row present with a well-formed hash → database is authoritative.
 * - Row truly absent (PGRST116 / null data) → environment fallback, or none.
 * - Anything else — read error, or a row whose password_hash is missing or
 *   malformed — fails closed to { source: "none" }. A malformed row must
 *   never re-arm the environment password: that would let a corrupt (or
 *   tampered) table silently restore a credential the rotation retired.
 */
export async function getAdminPasswordState(): Promise<AdminPasswordState> {
  let data: { password_hash?: unknown } | null = null
  try {
    const result = await createAdminClient()
      .from("admin_access")
      .select("password_hash")
      .eq("id", true)
      .maybeSingle()
    if (result.error) return { source: "none" }
    data = result.data
  } catch {
    // Missing env vars / unreachable project: deny rather than fall back.
    return { source: "none" }
  }
  if (data !== null) {
    // A row exists: it is the only authority. Well-formed hash or fail closed.
    return adminPasswordHashWellFormed(data.password_hash)
      ? { source: "database", hash: data.password_hash }
      : { source: "none" }
  }
  const password = process.env.ADMIN_DASHBOARD_PASSWORD
  return password ? { source: "environment", password } : { source: "none" }
}

/**
 * Compare-and-swap rotation. The caller must have already verified
 * `currentPassword` against `expectedState`.
 *
 * - Database row present: UPDATE … WHERE password_hash = <expected hash>.
 *   A concurrent rotation on another instance changes the hash first, this
 *   update matches zero rows, and the call fails closed.
 * - No row yet and the environment password is current: INSERT the first
 *   row. From that write on, getAdminPasswordState prefers the database and
 *   the environment password is permanently retired.
 * - PostgREST UNIQUE violation (23505) means a concurrent first insert won
 *   the race; also reported as a concurrent change.
 *
 * Errors are distinguished by category only; no credential material is
 * included in any result.
 */
export async function rotateAdminPassword(input: {
  currentPassword: string
  newPassword: string
  expectedState: AdminPasswordState
}): Promise<AdminRotationResult> {
  const { currentPassword, newPassword, expectedState } = input

  if (expectedState.source === "none") return { ok: false, reason: "no-current-secret" }
  if (newPassword === currentPassword) return { ok: false, reason: "unchanged" }
  if (!adminPasswordStrongEnough(newPassword)) return { ok: false, reason: "weak" }
  // Defence in depth: re-verify the current password inside the rotation so
  // a future caller cannot accidentally skip the check.
  if (!(await verifyAdminPassword(currentPassword, expectedState))) {
    return { ok: false, reason: "wrong-current" }
  }

  const newHash = hashAdminPassword(newPassword)
  let client
  try {
    client = createAdminClient()
  } catch {
    return { ok: false, reason: "unavailable" }
  }

  if (expectedState.source === "database") {
    const { data, error } = await client
      .from("admin_access")
      .update({ password_hash: newHash, updated_at: new Date().toISOString() })
      .eq("id", true)
      .eq("password_hash", expectedState.hash)
      .select("id")
    if (error) return { ok: false, reason: "unavailable" }
    if (!data || data.length === 0) return { ok: false, reason: "concurrent-change" }
    return { ok: true }
  }

  const { error } = await client
    .from("admin_access")
    .insert({ id: true, password_hash: newHash })
  if (error) {
    return { ok: false, reason: error.code === "23505" ? "concurrent-change" : "unavailable" }
  }
  return { ok: true }
}
