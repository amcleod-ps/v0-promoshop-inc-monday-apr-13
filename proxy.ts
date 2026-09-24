import { NextResponse, type NextRequest } from "next/server"
import { visitorGate } from "@/lib/visitor-access"
import { isAdminRequestAuthorized } from "@/lib/admin-auth"

export default async function proxy(request: NextRequest) {
  const gate = await visitorGate(request)
  if (gate) return gate
  if (!request.nextUrl.pathname.startsWith("/admin-dashboard")) {
    const response = NextResponse.next()
    response.headers.set("Cache-Control", "private, no-store")
    response.headers.set("X-Robots-Tag", "noindex, nofollow")
    return response
  }
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
  matcher: ["/((?!_next/static/).*)"],
}
