/**
 * Admin-dashboard access gate, shared by `proxy.ts` (edge runtime) and the
 * `/admin-dashboard` server actions (node runtime) — so it uses only Web
 * APIs (atob, TextDecoder, crypto.subtle) and no `next/*` imports.
 *
 * Behaviour is controlled by the ADMIN_DASHBOARD_PASSWORD env var:
 *   * unset  — gate is OPEN. This preserves the dashboard's historical
 *              URL-as-secret mode, which the client explicitly asked to keep
 *              (deferral on record in docs/hardening-status.md, 2026-06-01).
 *   * set    — every request to /admin-dashboard (page loads AND the server
 *              actions it posts) must carry HTTP Basic credentials whose
 *              password matches. The username is ignored.
 *
 * Server actions are NOT scoped to the page that renders them — a POST with
 * a valid Next-Action id executes from any route — so the proxy matcher on
 * /admin-dashboard alone is not enough. Each admin action therefore
 * re-verifies the same header via requireAdminAction() in
 * lib/admin-auth-action.ts.
 */

export function adminGateEnabled(): boolean {
  return Boolean(process.env.ADMIN_DASHBOARD_PASSWORD)
}

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return new Uint8Array(digest)
}

// Compare via fixed-length digests so the comparison cost doesn't depend on
// how much of the secret matches (timing-safe enough for a shared password).
async function secretsMatch(candidate: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(candidate), sha256(secret)])
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

function decodeBase64Utf8(value: string): string | null {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export async function isAdminRequestAuthorized(
  authorizationHeader: string | null,
): Promise<boolean> {
  const password = process.env.ADMIN_DASHBOARD_PASSWORD
  if (!password) return true

  if (!authorizationHeader?.startsWith("Basic ")) return false
  const decoded = decodeBase64Utf8(authorizationHeader.slice("Basic ".length).trim())
  if (decoded === null) return false

  // "user:pass" — username is ignored, password is everything after the
  // first colon (passwords may themselves contain colons).
  const colon = decoded.indexOf(":")
  if (colon === -1) return false
  return secretsMatch(decoded.slice(colon + 1), password)
}
