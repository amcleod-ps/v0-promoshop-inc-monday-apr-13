import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

/**
 * Pure administrator password + session cryptography.
 *
 * Deliberately free of "server-only", environment reads and database access:
 * every function takes its inputs explicitly, so this module runs under tsx
 * unit tests and can be reused by any server-side caller. The singleton-row
 * state read and the compare-and-swap rotation live in
 * lib/admin-session.ts, which re-exports everything here so server callers
 * (the proxy, future server actions) need only one import.
 *
 * Nothing here logs credentials or includes them in return values.
 */

export const ADMIN_SESSION_COOKIE = "promoshop-admin"
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12
export const ADMIN_PASSWORD_MAX_LENGTH = 256

/** "saltHex:hashHex" — the format the admin_access CHECK constraint enforces. */
export const ADMIN_PASSWORD_HASH_FORMAT = /^[a-f0-9]{32}:[a-f0-9]{64}$/

/** Discriminated password state: which secret is currently authoritative. */
export type AdminPasswordState =
  | { source: "database"; hash: string }
  | { source: "environment"; password: string }
  | { source: "none" }

export type AdminSessionCheck =
  | { ok: true; expiresAt: number; reason?: never }
  | { ok: false; reason: "malformed" | "expired" | "signature" | "no-secret" }

/**
 * Type guard for stored hash values. A row whose password_hash is missing or
 * malformed must fail closed — never fall back to another credential source.
 */
export function adminPasswordHashWellFormed(value: unknown): value is string {
  return typeof value === "string" && ADMIN_PASSWORD_HASH_FORMAT.test(value)
}

/**
 * Timing-safe comparison against the active secret. scrypt derives are
 * constant-cost regardless of candidate content, and the final comparison
 * uses timingSafeEqual. A malformed stored hash never matches.
 */
export async function verifyAdminPassword(
  candidate: string,
  state: AdminPasswordState,
): Promise<boolean> {
  if (candidate.length === 0 || candidate.length > ADMIN_PASSWORD_MAX_LENGTH) return false
  if (state.source === "database") {
    if (!adminPasswordHashWellFormed(state.hash)) return false
    const [salt, expected] = state.hash.split(":")
    return timingSafeEqual(scryptSync(candidate, salt, 32), Buffer.from(expected, "hex"))
  }
  if (state.source === "environment") {
    // Compare fixed-length digests so the environment password is never the
    // direct input to a comparison whose length could leak.
    const a = scryptSync(candidate, "admin-env-compare", 32)
    const b = scryptSync(state.password, "admin-env-compare", 32)
    return timingSafeEqual(a, b)
  }
  return false
}

/** Fresh salted scrypt hash in the ADMIN_PASSWORD_HASH_FORMAT format. */
export function hashAdminPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`
}

/** Minimum bar for the administrator password: 12+ chars with a letter and a digit. */
export function adminPasswordStrongEnough(password: string): boolean {
  if (password.length < 12 || password.length > ADMIN_PASSWORD_MAX_LENGTH) return false
  return /[a-zA-Z]/.test(password) && /[0-9]/.test(password)
}

/**
 * Sign a session token bound to the current secret's key material. Any
 * password rotation changes the key, so tokens signed under the old secret
 * fail verification immediately on every instance. Returns null when no
 * secret exists to bind to.
 */
export function createAdminSessionToken(
  state: AdminPasswordState,
  expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_SECONDS,
): string | null {
  const key = sessionKeyMaterial(state)
  if (key === null) return null
  const mac = createHmac("sha256", key).update(`admin:${expiresAt}`).digest("hex")
  return `${expiresAt}.${mac}`
}

/**
 * Validate a session cookie token. Format, lifetime and signature are all
 * checked; the signature is compared timing-safely against a token re-signed
 * with the current secret, so a rotated password revokes old sessions.
 */
export function validateAdminSessionToken(
  token: string | undefined,
  state: AdminPasswordState,
): AdminSessionCheck {
  if (!token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return { ok: false, reason: "malformed" }
  const key = sessionKeyMaterial(state)
  if (key === null) return { ok: false, reason: "no-secret" }
  const expiresAt = Number(token.split(".")[0])
  const now = Math.floor(Date.now() / 1000)
  if (expiresAt <= now || expiresAt > now + ADMIN_SESSION_SECONDS) {
    return { ok: false, reason: "expired" }
  }
  const expected = createAdminSessionToken(state, expiresAt)
  if (expected === null || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return { ok: false, reason: "signature" }
  }
  return { ok: true, expiresAt }
}

/** Key material the session HMAC is bound to; null when no secret exists. */
function sessionKeyMaterial(state: AdminPasswordState): string | null {
  if (state.source === "database") return `database:${state.hash}`
  if (state.source === "environment") return `environment:${state.password}`
  return null
}
