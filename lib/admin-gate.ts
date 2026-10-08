import "server-only"
import { NextResponse, type NextRequest } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { siteIconLinks } from "@/lib/site-icons"
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_SECONDS,
  createAdminSessionToken,
  getAdminPasswordState,
  rotateAdminPassword,
  validateAdminSessionToken,
  verifyAdminPassword,
} from "./admin-session"

/**
 * Administrator website gate: password-only HTML sign-in at /admin, with a
 * self-service Reset Password flow at /admin/reset. This replaces the
 * browser Basic Authentication prompt for the dashboard pages.
 *
 * Password authority lives in lib/admin-session.ts (the singleton
 * admin_access table, environment fallback only until the first row exists).
 * Every protected request re-reads that state, so a rotation revokes every
 * session signed under the old secret immediately, on every instance. When
 * no credential is available — the table read failed, the service-role key
 * is unset, or the row is malformed — the gate FAILS CLOSED: no sign-in, no
 * reset, no dashboard.
 *
 * No username, no email, no SMS. Nothing here logs credentials.
 */

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

function signInPage(error = "", status = 401) {
  const form = `<h1>Admin sign in</h1><p>Enter the administrator password.</p>${error ? `<p role="alert" class="error">${error}</p>` : ""}<form method="post" action="/admin"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="${ADMIN_PASSWORD_MAX_LENGTH}" required autofocus><button type="submit">Sign in</button></form><form method="get" action="/admin/reset"><button type="submit">Reset Password</button></form>`
  return pageShell("Admin sign in", form, status)
}

function resetPage(error = "", status = 200) {
  const form = `<h1>Reset password</h1><p>Choose a new administrator password. Use 12 or more characters. Use letters and numbers.</p>${error ? `<p role="alert" class="error">${error}</p>` : ""}<form method="post" action="/admin/reset"><label for="current">Current password</label><input id="current" name="current" type="password" autocomplete="current-password" maxlength="${ADMIN_PASSWORD_MAX_LENGTH}" required autofocus><label for="next">New password</label><input id="next" name="next" type="password" autocomplete="new-password" maxlength="${ADMIN_PASSWORD_MAX_LENGTH}" required><label for="confirm">Repeat new password</label><input id="confirm" name="confirm" type="password" autocomplete="new-password" maxlength="${ADMIN_PASSWORD_MAX_LENGTH}" required><button type="submit">Save new password</button></form>`
  return pageShell("Reset password", form, status)
}

function unavailable(): NextResponse {
  return new NextResponse("Admin sign-in is not configured. Contact the site administrator.", {
    status: 503,
    headers: privateHeaders,
  })
}

function setAdminSessionCookie(request: NextRequest, response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  })
}

function denyOverlongPost(request: NextRequest, page: (error: string, status: number) => NextResponse): NextResponse | null {
  if (Number(request.headers.get("content-length") ?? 0) > POST_BODY_MAX) return page("The form data is too long.", 413)
  return null
}

/**
 * Gate for the administrator pages. Returns null when the request may
 * proceed to the dashboard, or the response to send instead (sign-in form,
 * reset form, redirect, or a failure page).
 */
export async function adminGate(request: NextRequest): Promise<NextResponse | null> {
  try {
    const { pathname } = request.nextUrl
    // Dashboard actions also post to /admin. Check their session below.
    const isSignInPost = pathname === "/admin" && request.method === "POST" && !request.headers.has("next-action")
    const isReset = pathname === "/admin/reset"
    // No cache: read the state on every request so a rotation invalidates
    // sessions signed with the old secret immediately, on every instance.
    const state = await getAdminPasswordState()
    if (state.source === "none") return unavailable()

    // Reset comes before the session check so a signed-in administrator can
    // open the form too; the POST still requires the current password.
    if (isReset) {
      if (request.method === "GET") return resetPage()
      if (request.method !== "POST") return signInPage()
      if (request.headers.get("origin") !== request.nextUrl.origin) return resetPage("Please open the site and try again.", 403)
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      if (!rateLimit(`admin-reset:${ip}`, 5, 60_000)) return resetPage("Too many attempts. Wait one minute and try again.", 429)
      const denied = denyOverlongPost(request, resetPage)
      if (denied) return denied
      const body = await request.text()
      if (body.length > POST_BODY_MAX) return resetPage("The form data is too long.", 413)
      const fields = new URLSearchParams(body)
      const current = fields.get("current") ?? ""
      const next = fields.get("next") ?? ""
      const confirm = fields.get("confirm") ?? ""
      if (!(await verifyAdminPassword(current, state))) return resetPage("The current password is wrong. Try again.")
      if (next !== confirm) return resetPage("The new passwords do not match. Try again.")
      if (next === current) return resetPage("The new password must be different.")
      // rotateAdminPassword re-verifies the current password, enforces
      // strength, and compare-and-swaps on the expected state, so a
      // concurrent rotation on another instance fails closed.
      const rotated = await rotateAdminPassword({ currentPassword: current, newPassword: next, expectedState: state })
      if (!rotated.ok) {
        if (rotated.reason === "weak") return resetPage("The new password is too weak. Use 12 or more characters. Use letters and numbers.")
        if (rotated.reason === "concurrent-change") return resetPage("The password was just changed elsewhere. Try again with the new password.", 409)
        if (rotated.reason === "wrong-current") return resetPage("The current password is wrong. Try again.")
        return unavailable()
      }
      // Sign the session against the post-rotation state, not the pre-change
      // one — a token bound to the retired secret would fail on the next read.
      const freshState = await getAdminPasswordState()
      if (freshState.source === "none") return unavailable()
      const token = createAdminSessionToken(freshState)
      if (token === null) return unavailable()
      const response = NextResponse.redirect(new URL("/admin", request.url), 303)
      setAdminSessionCookie(request, response, token)
      Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }

    if (isSignInPost) {
      if (request.headers.get("origin") !== request.nextUrl.origin) return signInPage("Please open the site and try again.", 403)
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      if (!rateLimit(`admin:${ip}`, 10, 60_000)) return signInPage("Too many attempts. Wait one minute and try again.", 429)
      const denied = denyOverlongPost(request, signInPage)
      if (denied) return denied
      const body = await request.text()
      if (body.length > POST_BODY_MAX) return signInPage("Password is too long.", 413)
      const password = new URLSearchParams(body).get("password") ?? ""
      if (!(await verifyAdminPassword(password, state))) return signInPage("Incorrect password. Try again.")
      const token = createAdminSessionToken(state)
      if (token === null) return unavailable()
      const response = NextResponse.redirect(new URL("/admin", request.url), 303)
      setAdminSessionCookie(request, response, token)
      Object.entries(privateHeaders).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }

    if (validateAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value, state).ok) return null

    return signInPage()
  } catch {
    return unavailable()
  }
}
