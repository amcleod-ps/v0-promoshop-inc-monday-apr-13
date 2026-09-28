import "server-only"
import { cookies } from "next/headers"
import {
  ADMIN_SESSION_COOKIE,
  getAdminPasswordState,
  validateAdminSessionToken,
} from "./admin-session"

/**
 * Per-action authorization check for administrator server actions.
 * Returns null when the request may proceed, or a ready-to-return error
 * result (shape-compatible with every admin action's ErrorResult).
 *
 * Server actions can be invoked outside the dashboard route. Read the
 * current password state for each request so a password change ends old
 * sessions before an action can change data.
 */
export async function requireAdminAction(): Promise<{ ok: false; error: string } | null> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  const state = await getAdminPasswordState()
  if (validateAdminSessionToken(token, state).ok) return null
  return {
    ok: false,
    error: "Administrator sign-in is required. Open /admin and sign in.",
  }
}
