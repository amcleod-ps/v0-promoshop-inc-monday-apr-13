import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { rateLimit } from "@/lib/rate-limit"
import { siteIconLinks } from "@/lib/site-icons"
import {
  PASSWORD_MAX_LENGTH,
  SESSION_SECONDS,
  VISITOR_COOKIE,
  hashPassword,
  passwordMatches,
  passwordStrongEnough,
  signSession,
  validSession,
} from "./visitor-access-crypto"

const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }
const pageCsp = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"
// Bounded: three password fields plus form overhead must fit.
const POST_BODY_MAX = 2048

function pageShell(title: string, body: string, status: number) {
  const style = "body{margin:0;background:#ededed;color:#222;font:18px system-ui;display:grid;min-height:100svh;place-items:center}main{box-sizing:border-box;width:min(100%,460px);padding:32px}h1{font-size:32px}label,input,button{display:block}input,button{box-sizing:border-box;width:100%;min-height:48px;font:inherit;margin-top:12px;padding:12px}button{background:#373a36;color:white;border:0;cursor:pointer}input:focus,button:focus{outline:3px solid #b62d25;outline-offset:3px}.error{color:#a51f17}"
  return new NextResponse(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} | PromoShop Studio</title>${siteIconLinks}<style>${style}</style><main><p>PromoShop Studio</p>${body}</main></html>`,
    { status, headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": pageCsp } },
  )
}

function passwordPage(error = "", status = 401) {
  const form = `<h1>Client access</h1><p>Enter the password shared by your PromoShop representative.</p>${error ? `<p role="alert" class="error">${error}</p>` : ""}<form method="post" action="/site-access"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="${PASSWORD_MAX_LENGTH}" required autofocus><button type="submit">Enter site</button></form><form method="get" action="/site-access-reset"><button type="submit">Reset Password</button></form>`
  return pageShell("Client access", form, status)
}

function resetPage(error = "", status = 200) {
  const form = `<h1>Reset password</h1><p>Choose a new shared password. Use 10 or more characters. Use letters and numbers.</p>${error ? `<p role="alert" class="error">${error}</p>` : ""}<form method="post" action="/site-access-reset"><label for="current">Current password</label><input id="current" name="current" type="password" autocomplete="current-password" maxlength="${PASSWORD_MAX_LENGTH}" required autofocus><label for="next">New password</label><input id="next" name="next" type="password" autocomplete="new-password" maxlength="${PASSWORD_MAX_LENGTH}" required><label for="confirm">Repeat new password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" maxlength="${PASSWORD_MAX_LENGTH}" required><button type="submit">Save new password</button></form>`
  return pageShell("Reset password", form, status)
}

function denyOverlongPost(request: NextRequest, page: (error: string, status: number) => NextResponse): NextResponse | null {
  if (Number(request.headers.get("content-length") ?? 0) > POST_BODY_MAX) return page("The form data is too long.", 413)
  return null
}

export async function visitorGate(request: NextRequest): Promise<NextResponse | null> {
  try {
    const { pathname } = request.nextUrl
    const isAccessPost = pathname === "/site-access" && request.method === "POST"
    const isReset = pathname === "/site-access-reset"
    // No cache: read the row on every request so a reset invalidates
    // sessions signed with the old hash immediately, on every instance.
    const { data, error } = await createAdminClient().from("visitor_access").select("password_hash,enabled").eq("id", true).single()
    if (error || !data) throw new Error("Access configuration unavailable")
    const { password_hash: hash, enabled } = data
    if (!enabled) return null
    // Reset comes before the session check so a signed-in visitor can open
    // the form too; the POST still requires the current password.
    if (isReset) {
      if (request.method === "GET") return resetPage()
      if (request.method !== "POST") return passwordPage()
      if (request.headers.get("origin") !== request.nextUrl.origin) return resetPage("Please open the site and try again.", 403)
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      if (!rateLimit(`visitor-reset:${ip}`, 5, 60_000)) return resetPage("Too many attempts. Wait one minute and try again.", 429)
      const denied = denyOverlongPost(request, resetPage)
      if (denied) return denied
      const body = await request.text()
      if (body.length > POST_BODY_MAX) return resetPage("The form data is too long.", 413)
      const fields = new URLSearchParams(body)
      const current = fields.get("current") ?? ""
      const next = fields.get("next") ?? ""
      const confirm = fields.get("confirm") ?? ""
      if (!passwordMatches(current, hash)) return resetPage("The current password is wrong. Try again.")
      if (next !== confirm) return resetPage("The new passwords do not match. Try again.")
      if (next === current) return resetPage("The new password must be different.")
      if (!passwordStrongEnough(next)) return resetPage("The new password is too weak. Use 10 or more characters. Use letters and numbers.")
      const newHash = hashPassword(next)
      // Compare-and-swap on the old hash: a concurrent change on another
      // instance updates zero rows, and this request fails closed.
      const { data: swapped, error: swapError } = await createAdminClient()
        .from("visitor_access")
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq("id", true)
        .eq("password_hash", hash)
        .select("id")
      if (swapError) throw swapError
      if (!swapped || swapped.length === 0) return resetPage("The password was just changed elsewhere. Try again with the new password.", 409)
      const response = NextResponse.redirect(new URL("/", request.url), 303)
      response.cookies.set(VISITOR_COOKIE, signSession(newHash), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS })
      Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }
    if (isAccessPost) {
      if (request.headers.get("origin") !== request.nextUrl.origin) return passwordPage("Please open the site and try again.", 403)
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      if (!rateLimit(`visitor:${ip}`, 10, 60_000)) return passwordPage("Too many attempts. Wait one minute and try again.", 429)
      const denied = denyOverlongPost(request, passwordPage)
      if (denied) return denied
      const body = await request.text()
      if (body.length > POST_BODY_MAX) return passwordPage("Password is too long.", 413)
      const password = new URLSearchParams(body).get("password") ?? ""
      if (!passwordMatches(password, hash)) return passwordPage("Incorrect password. Try again.")
      const response = NextResponse.redirect(new URL("/", request.url), 303)
      response.cookies.set(VISITOR_COOKIE, signSession(hash), { httpOnly: true, secure: request.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS })
      Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }
    if (validSession(request.cookies.get(VISITOR_COOKIE)?.value, hash)) return null
    return passwordPage()
  } catch {
    return new NextResponse("Client access is temporarily unavailable. Please try again shortly.", { status: 503, headers: privateHeaders })
  }
}
