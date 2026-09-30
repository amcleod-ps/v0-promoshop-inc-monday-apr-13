import assert from "node:assert/strict"
import test from "node:test"
import { isSiteIconRequest } from "../../lib/site-icons"

test("Visitors can read the icon files before sign-in", () => {
  for (const path of ["/favicon.ico", "/icon.svg", "/icon-light-32x32.png", "/icon-dark-32x32.png", "/apple-icon.png"]) {
    assert.equal(isSiteIconRequest(path, "GET"), true)
    assert.equal(isSiteIconRequest(path, "HEAD"), true)
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      assert.equal(isSiteIconRequest(path, method), false)
    }
  }
})

test("Other routes and similar file names keep the access gate", () => {
  for (const path of ["/", "/studio", "/admin", "/api/quotes", "/images/mainmemory/promoshop-logo.png", "/private.png", "/icon.svg/", "/icon.svg/extra", "/ICON.svg", "/favicon.ico.json", "/%69con.svg"]) {
    assert.equal(isSiteIconRequest(path, "GET"), false)
    assert.equal(isSiteIconRequest(path, "HEAD"), false)
  }
})
