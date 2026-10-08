import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import { scryptSync } from "node:crypto"

// Use a local database fixture. This check does not use client credentials.
const require = createRequire(import.meta.url)
const content = new Map()
const collections = []
let adminHash = null
let databaseWrites = 0
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, "http://localhost")
  const table = url.pathname.split("/").at(-1)
  let data = []
  if (table === "visitor_access") data = { id: true, enabled: false, password_hash: "fixture" }
  if (table === "admin_access") data = adminHash ? { password_hash: adminHash } : null
  if (table === "site_content") data = [...content.values()]
  if (table === "collections") data = collections
  if (table === "site_images") data = [{ key: "home.hero", label: "Fixture image", url: null, alt_text: "" }]
  if (request.method === "POST" && ["site_content", "collections"].includes(table)) {
    let body = ""
    for await (const chunk of request) body += chunk
    const row = JSON.parse(body)
    databaseWrites++
    if (table === "site_content") {
      content.set(row.key, { ...row, updated_at: new Date().toISOString() })
      data = row
    } else {
      const saved = { ...row, id: "00000000-0000-4000-8000-000000000001", is_active: true, sort_order: 1 }
      collections.push(saved)
      data = saved
    }
  }
  response.writeHead(200, { "Content-Type": "application/json" })
  response.end(JSON.stringify(data))
})
await new Promise((resolve) => fixture.listen(0, "127.0.0.1", resolve))
const databaseUrl = `http://127.0.0.1:${fixture.address().port}`

const portReservation = createServer()
await new Promise((resolve) => portReservation.listen(0, "127.0.0.1", resolve))
const port = portReservation.address().port
await new Promise((resolve) => portReservation.close(resolve))
const origin = `http://localhost:${port}`
const password = "Local-fixture-password-42"
const app = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--port", String(port)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: databaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-fixture-anon",
    SUPABASE_SERVICE_ROLE_KEY: "local-fixture-server",
    ADMIN_DASHBOARD_PASSWORD: password,
    TIERED_PRICING_ENABLED: "false",
  },
  stdio: ["ignore", "pipe", "pipe"],
})
let output = ""
app.stdout.on("data", (chunk) => { output += chunk })
app.stderr.on("data", (chunk) => { output += chunk })

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("The local server did not start.")), 30000)
    const ready = () => {
      if (output.includes("Ready")) { clearTimeout(timer); resolve() }
    }
    app.stdout.on("data", ready)
    app.once("exit", () => { clearTimeout(timer); reject(new Error("The local server stopped.")) })
    ready()
  })
  const manifest = JSON.parse(await readFile(".next/server/server-reference-manifest.json", "utf8"))
  function actionId(name) {
    const id = Object.entries(manifest.node).find(([, action]) => action.exportedName === name)?.[0]
    assert.ok(id, `The build must contain ${name}.`)
    return id
  }
  const saveId = actionId("updateSiteContent")
  const createId = actionId("createCollection")
  async function action(path, id, args, cookie = "", requestOrigin = origin) {
    return fetch(origin + path, {
      method: "POST",
      headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Origin: requestOrigin, Cookie: cookie },
      body: JSON.stringify(args),
      redirect: "manual",
    })
  }

  const denied = await action("/admin", saveId, ["studio.page.heading", "Heading", "Unauthorized value"])
  assert.equal(denied.status, 401)
  assert.equal(databaseWrites, 0)

  const wrongLogin = await fetch(origin + "/admin", {
    method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ password: "wrong" }), redirect: "manual",
  })
  assert.match(await wrongLogin.text(), /Incorrect password/)
  assert.equal(wrongLogin.headers.get("set-cookie"), null)

  const login = await fetch(origin + "/admin", {
    method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ password }), redirect: "manual",
  })
  assert.equal(login.status, 303)
  const session = login.headers.get("set-cookie")
  assert.match(session, /HttpOnly/i)
  const cookie = session.split(";")[0]

  // The save exceeds the login form limit but stays within the text limit.
  const value = "Local save check ".repeat(160)
  const saved = await action("/admin", saveId, ["studio.page.heading", "Fixture heading", value], cookie)
  const savedBody = await saved.text()
  assert.equal(saved.status, 200)
  assert.match(saved.headers.get("content-type"), /text\/x-component/)
  assert.match(savedBody, /"ok":true/)
  assert.equal(content.get("studio.page.heading").value, value)
  const reloaded = await fetch(origin + "/studio")
  assert.match(await reloaded.text(), /Local save check/)

  const created = await action("/admin", createId, [{ name: "Local test collection", slug: "local-test-collection" }], cookie)
  assert.match(await created.text(), /"ok":true/)
  assert.equal(collections[0].name, "Local test collection")
  const dashboard = await fetch(origin + "/admin", { headers: { Cookie: cookie } })
  const dashboardBody = await dashboard.text()
  assert.equal(dashboard.status, 200)
  assert.ok(dashboardBody.includes("Local test collection"), `The reloaded dashboard must contain the saved collection. ${dashboardBody.includes("Server is not configured") ? "The server configuration is missing." : ""}`)

  const beforeRejected = databaseWrites
  const forged = await action("/admin", saveId, ["studio.page.heading", "Heading", "forged"], `${cookie.split("=")[0]}=forged`)
  assert.equal(forged.status, 401)
  const otherRoute = await action("/studio", saveId, ["studio.page.heading", "Heading", "other route"])
  assert.doesNotMatch(await otherRoute.text(), /"ok":true/)
  const otherOrigin = await action("/admin", saveId, ["studio.page.heading", "Heading", "other origin"], cookie, "https://untrusted.example")
  assert.equal(otherOrigin.status, 500)
  assert.equal(databaseWrites, beforeRejected)

  const salt = "a".repeat(32)
  adminHash = `${salt}:${scryptSync("Rotated-local-password-9", salt, 32).toString("hex")}`
  const revoked = await action("/admin", saveId, ["studio.page.heading", "Heading", "revoked"], cookie)
  assert.equal(revoked.status, 401)
  assert.equal(databaseWrites, beforeRejected)
  const freshLogin = await fetch(origin + "/admin", {
    method: "POST", headers: { Origin: origin }, body: new URLSearchParams({ password: "Rotated-local-password-9" }), redirect: "manual",
  })
  assert.equal(freshLogin.status, 303)
  const freshCookie = freshLogin.headers.get("set-cookie").split(";")[0]
  const databaseSessionSave = await action("/admin", saveId, ["studio.page.heading", "Heading", "Database session save"], freshCookie)
  assert.match(await databaseSessionSave.text(), /"ok":true/)
  assert.equal(content.get("studio.page.heading").value, "Database session save")
  console.log("PASS: dashboard save, add, reload, sign-in, session, origin, and route access checks.")
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  app.kill("SIGTERM")
  await new Promise((resolve) => app.once("exit", resolve))
  await new Promise((resolve) => fixture.close(resolve))
}
