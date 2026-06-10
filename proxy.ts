import { NextResponse, type NextRequest } from "next/server"
import { isAdminRequestAuthorized } from "@/lib/admin-auth"

/**
 * Gate for /admin-dashboard (the matcher below keeps every other route on
 * the zero-overhead path).
 *
 * When ADMIN_DASHBOARD_PASSWORD is set, the page and the server-action
 * POSTs it issues require HTTP Basic auth (any username + that password).
 * When unset, the gate stays open — the historical URL-as-secret mode the
 * client asked to keep (see docs/hardening-status.md).
 *
 * The X-Robots-Tag header replaces the old robots.txt Disallow line, which
 * advertised the dashboard URL to anyone who read /robots.txt.
 */
export default async function proxy(request: NextRequest) {
  const authorized = await isAdminRequestAuthorized(request.headers.get("authorization"))

  if (!authorized) {
    return new NextResponse("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="PromoShop admin dashboard", charset="UTF-8"',
        "X-Robots-Tag": "noindex, nofollow",
      },
    })
  }

  const response = NextResponse.next()
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = {
  matcher: ["/admin-dashboard/:path*"],
}
