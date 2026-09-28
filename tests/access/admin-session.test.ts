import { test } from "node:test"
import assert from "node:assert/strict"
import { scryptSync } from "node:crypto"
import {
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_SESSION_SECONDS,
  adminPasswordHashWellFormed,
  adminPasswordStrongEnough,
  createAdminSessionToken,
  hashAdminPassword,
  validateAdminSessionToken,
  verifyAdminPassword,
  type AdminPasswordState,
} from "../../lib/admin-session-crypto"

const ENV_PASSWORD = "foundation-env-password-7"
const envState: AdminPasswordState = { source: "environment", password: ENV_PASSWORD }
const noState: AdminPasswordState = { source: "none" }

function dbStateFor(password: string): AdminPasswordState {
  return { source: "database", hash: hashAdminPassword(password) }
}

test("hashAdminPassword produces a fresh salted scrypt hash in the table CHECK format", () => {
  const hash = hashAdminPassword("Correct-Horse-42")
  assert.match(hash, /^[a-f0-9]{32}:[a-f0-9]{64}$/)
  const [salt, expected] = hash.split(":")
  assert.equal(scryptSync("Correct-Horse-42", salt, 32).toString("hex"), expected)
  // Fresh salt every time: two hashes of one password differ.
  assert.notEqual(hashAdminPassword("Correct-Horse-42"), hash)
  assert.equal(adminPasswordHashWellFormed(hash), true)
})

test("database-state verification accepts only the exact password, timing-safely", async () => {
  const state = dbStateFor("Admin-Password-99")
  assert.equal(await verifyAdminPassword("Admin-Password-99", state), true)
  assert.equal(await verifyAdminPassword("admin-password-99", state), false)
  assert.equal(await verifyAdminPassword("Admin-Password-98", state), false)
  assert.equal(await verifyAdminPassword("", state), false)
  assert.equal(await verifyAdminPassword("x".repeat(ADMIN_PASSWORD_MAX_LENGTH + 1), state), false)
})

test("malformed stored hashes never match and never throw", async () => {
  for (const hash of ["invalid", ":", "zz".repeat(16) + ":" + "ab".repeat(32), "a".repeat(32)]) {
    assert.equal(adminPasswordHashWellFormed(hash), false)
    assert.equal(await verifyAdminPassword("anything-1", { source: "database", hash }), false)
  }
  for (const value of [undefined, null, 42, {}]) {
    assert.equal(adminPasswordHashWellFormed(value), false)
  }
})

test("environment-state verification uses only the env password", async () => {
  assert.equal(await verifyAdminPassword(ENV_PASSWORD, envState), true)
  assert.equal(await verifyAdminPassword("wrong-password-1", envState), false)
})

test("a database hash permanently retires the environment password", async () => {
  // The invariant getAdminPasswordState enforces at read time: once any row
  // exists, state resolution prefers the database, and verification against
  // that state must reject the old environment password.
  const rotated = dbStateFor("Rotated-Password-3")
  assert.equal(await verifyAdminPassword(ENV_PASSWORD, rotated), false)
  assert.equal(await verifyAdminPassword("Rotated-Password-3", rotated), true)
})

test("none state denies every candidate, including the env password", async () => {
  assert.equal(await verifyAdminPassword(ENV_PASSWORD, noState), false)
  assert.equal(await verifyAdminPassword("anything-1", noState), false)
})

test("strength rule enforces 12+ chars with a letter and a digit, and the max length", () => {
  assert.equal(adminPasswordStrongEnough("Short1ab"), false) // 8 chars
  assert.equal(adminPasswordStrongEnough("onlylettersaa"), false) // no digit
  assert.equal(adminPasswordStrongEnough("123456789012"), false) // no letter
  assert.equal(adminPasswordStrongEnough(""), false)
  assert.equal(adminPasswordStrongEnough("x".repeat(ADMIN_PASSWORD_MAX_LENGTH + 1) + "1a"), false)
  assert.equal(adminPasswordStrongEnough("a1" + "x".repeat(ADMIN_PASSWORD_MAX_LENGTH - 2)), true)
  assert.equal(adminPasswordStrongEnough("Long-Enough-9"), true)
})

test("sessions validate, reject forgery, and reject excessive lifetime", () => {
  const state = dbStateFor("Session-Password-1")
  const token = createAdminSessionToken(state)
  assert.ok(token)
  assert.equal(validateAdminSessionToken(token, state).ok, true)

  assert.equal(validateAdminSessionToken(undefined, state).reason, "malformed")
  assert.equal(validateAdminSessionToken("", state).reason, "malformed")
  assert.equal(validateAdminSessionToken("not-a-token", state).reason, "malformed")
  assert.equal(
    validateAdminSessionToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), state).reason,
    "signature",
  )

  const now = Math.floor(Date.now() / 1000)
  const alreadyExpired = createAdminSessionToken(state, now - 1)
  assert.ok(alreadyExpired)
  assert.equal(validateAdminSessionToken(alreadyExpired, state).reason, "expired")
  const tooLongLived = createAdminSessionToken(state, now + ADMIN_SESSION_SECONDS + 60)
  assert.ok(tooLongLived)
  assert.equal(validateAdminSessionToken(tooLongLived, state).reason, "expired")
})

test("rotation revokes sessions: tokens are bound to the signing secret", () => {
  const before = dbStateFor("Before-Rotation-1")
  const after = dbStateFor("After-Rotation-2")
  const token = createAdminSessionToken(before)
  assert.ok(token)
  assert.equal(validateAdminSessionToken(token, before).ok, true)
  // Same token, new secret: the signature no longer verifies.
  assert.equal(validateAdminSessionToken(token, after).reason, "signature")
  // And a token signed under the new secret fails under the old one.
  const newToken = createAdminSessionToken(after)
  assert.ok(newToken)
  assert.equal(validateAdminSessionToken(newToken, before).reason, "signature")
})

test("env-sourced sessions die when a database hash appears; no secret means no session", () => {
  const envToken = createAdminSessionToken(envState)
  assert.ok(envToken)
  assert.equal(validateAdminSessionToken(envToken, envState).ok, true)
  assert.equal(validateAdminSessionToken(envToken, dbStateFor(ENV_PASSWORD)).reason, "signature")
  assert.equal(validateAdminSessionToken(envToken, noState).reason, "no-secret")
  assert.equal(createAdminSessionToken(noState), null)
})
