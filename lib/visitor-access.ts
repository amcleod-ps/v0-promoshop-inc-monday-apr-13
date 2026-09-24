import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { passwordMatches, signSession, validSession, VISITOR_COOKIE, SESSION_SECONDS } from "./visitor-access-crypto"

const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }
let cached: { hash: string; enabled: boolean; until: number } | undefined

function passwordPage(error = "", status = 401) {
  return new NextResponse(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Client access | PromoShop Studio</title><style>body{margin:0;background:#ededed;color:#222;font:18px system-ui;display:grid;min-height:100svh;place-items:center}main{box-sizing:border-box;width:min(100%,460px);padding:32px}h1{font-size:32px}label,input,button{display:block}input,button{box-sizing:border-box;width:100%;min-height:48px;font:inherit;margin-top:12px;padding:12px}button{background:#373a36;color:white;border:0;cursor:pointer}input:focus,button:focus{outline:3px solid #b62d25;outline-offset:3px}.error{color:#a51f17}</style><main><p>PromoShop Studio</p><h1>Client access</h1><p>Enter the password shared by your PromoShop representative.</p>${error ? `<p role="alert" class="error">${error}</p>` : ""}<form method="post" action="/site-access"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="256" required autofocus><button type="submit">Enter site</button></form></main></html>`, { status, headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } })
}

export async function visitorGate(request: NextRequest): Promise<NextResponse | null> {
  try {
    if (!cached || cached.until <= Date.now()) {
      const { data, error } = await createAdminClient().from("visitor_access").select("password_hash,enabled").eq("id", true).single()
      if (error || !data) throw new Error("Access configuration unavailable")
      cached = { hash: data.password_hash, enabled: data.enabled, until: Date.now() + 30_000 }
    }
    if (!cached.enabled) return null
    if (validSession(request.cookies.get(VISITOR_COOKIE)?.value, cached.hash)) return null
    if (request.nextUrl.pathname === "/site-access" && request.method === "POST") {
      if (request.headers.get("origin") !== request.nextUrl.origin) return passwordPage("Please open the site and try again.", 403)
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      if (!rateLimit(`visitor:${ip}`, 10, 60_000)) return passwordPage("Too many attempts. Wait one minute and try again.", 429)
      if (Number(request.headers.get("content-length") ?? 0) > 2048) return passwordPage("Password is too long.", 413)
      const body = await request.text()
      if (body.length > 2048) return passwordPage("Password is too long.", 413)
      const password = new URLSearchParams(body).get("password") ?? ""
      if (!passwordMatches(password, cached.hash)) return passwordPage("Incorrect password. Try again.")
      const response = NextResponse.redirect(new URL("/", request.url), 303)
      response.cookies.set(VISITOR_COOKIE, signSession(cached.hash), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS })
      Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }
    return passwordPage()
  } catch {
    return new NextResponse("Client access is temporarily unavailable. Please try again shortly.", { status: 503, headers: privateHeaders })
  }
}
