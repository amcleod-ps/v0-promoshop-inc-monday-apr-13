import "server-only"
import { headers } from "next/headers"
import { isAdminRequestAuthorized } from "./admin-auth"

/**
 * Per-action authorization check for the /admin-dashboard server actions.
 * Returns null when the request may proceed, or a ready-to-return error
 * result (shape-compatible with every admin action's ErrorResult).
 *
 * This exists because server actions are invocable from ANY route via their
 * Next-Action id, so the proxy.ts gate on /admin-dashboard alone cannot
 * protect them. The browser attaches the cached Basic credentials to the
 * action's same-path POST, so dashboard users pass this check transparently.
 */
export async function requireAdminAction(): Promise<{ ok: false; error: string } | null> {
  const authorization = (await headers()).get("authorization")
  if (await isAdminRequestAuthorized(authorization)) return null
  return {
    ok: false,
    error: "Unauthorized: admin password required. Reload /admin-dashboard and sign in.",
  }
}
