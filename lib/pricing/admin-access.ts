import "server-only"

import { cookies } from "next/headers"
import {
  ADMIN_SESSION_COOKIE,
  getAdminPasswordState,
  validateAdminSessionToken,
} from "@/lib/admin-session"
import type { PricingActionFailure } from "./admin-types"

export type PricingAdminAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: "password_not_configured" | "unauthorized"
    }

/**
 * Pricing administration requires the current administrator session.
 * A missing password state never grants access to prices or mutations.
 */
export async function getPricingAdminAccess(): Promise<PricingAdminAccess> {
  const state = await getAdminPasswordState()
  if (state.source === "none") {
    return { allowed: false, reason: "password_not_configured" }
  }

  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!validateAdminSessionToken(token, state).ok) {
    return { allowed: false, reason: "unauthorized" }
  }

  return { allowed: true }
}

export async function requirePricingAdminAction(): Promise<
  PricingActionFailure | null
> {
  const access = await getPricingAdminAccess()
  if (access.allowed) return null

  if (access.reason === "password_not_configured") {
    return {
      ok: false,
      code: "not_configured",
      error:
        "Pricing administration is unavailable until the admin password is configured.",
    }
  }

  return {
    ok: false,
    code: "not_authorized",
    error: "Administrator authentication is required.",
  }
}
