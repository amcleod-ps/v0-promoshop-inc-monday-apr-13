import "server-only"

import { headers } from "next/headers"
import {
  adminGateEnabled,
  isAdminRequestAuthorized,
} from "@/lib/admin-auth"
import type { PricingActionFailure } from "./admin-types"

export type PricingAdminAccess =
  | { allowed: true }
  | {
      allowed: false
      reason: "password_not_configured" | "unauthorized"
    }

/**
 * Pricing administration is intentionally stricter than the legacy dashboard:
 * the shared admin password must exist and the current request must present it.
 * An unset password never grants access to prices or pricing mutations.
 */
export async function getPricingAdminAccess(): Promise<PricingAdminAccess> {
  if (!adminGateEnabled()) {
    return { allowed: false, reason: "password_not_configured" }
  }

  const authorization = (await headers()).get("authorization")
  if (!(await isAdminRequestAuthorized(authorization))) {
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
