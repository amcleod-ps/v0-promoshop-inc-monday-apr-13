import { NextResponse, type NextRequest } from "next/server"
import { visitorGate } from "@/lib/visitor-access"
import { adminGate } from "@/lib/admin-gate"

export default async function proxy(request: NextRequest) {
  const gate = await visitorGate(request)
  if (gate) return gate

  const { pathname } = request.nextUrl
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/")
  const isLegacyDashboard = pathname === "/admin-dashboard" || pathname.startsWith("/admin-dashboard/")

  // /admin is the primary dashboard address. The password-only HTML gate
  // signs an HttpOnly session cookie on success; protected pages re-read the
  // password state on every request so a rotation revokes old sessions.
  if (isAdmin) {
    const denied = await adminGate(request)
    if (denied) return denied
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    return response
  }

  // /admin-dashboard is the legacy address. GET (and HEAD) move permanently
  // to /admin. Non-GET methods stay here: existing server actions still post
  // to this path, and the gate protects them the same way.
  if (isLegacyDashboard) {
    if (request.method === "GET" || request.method === "HEAD") {
      const target = request.nextUrl.clone()
      target.pathname = pathname.replace(/^\/admin-dashboard/, "/admin")
      const response = NextResponse.redirect(target, 308)
      response.headers.set("Cache-Control", "private, no-store")
      response.headers.set("X-Robots-Tag", "noindex, nofollow")
      return response
    }
    const denied = await adminGate(request)
    if (denied) return denied
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    return response
  }

  const response = NextResponse.next()
  response.headers.set("Cache-Control", "private, no-store")
  response.headers.set("X-Robots-Tag", "noindex, nofollow")
  return response
}

export const config = {
  matcher: ["/((?!_next/static/).*)"],
}
