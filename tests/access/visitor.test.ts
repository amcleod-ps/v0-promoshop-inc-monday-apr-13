import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scryptSync } from 'node:crypto'
import { hashPassword, passwordMatches, passwordStrongEnough, signSession, validSession, SESSION_SECONDS } from '../../lib/visitor-access-crypto'
import { createAdminSessionToken, validateAdminSessionToken } from '../../lib/admin-session-crypto'
const salt = 'a'.repeat(32)
const hash = salt + ':' + scryptSync('test-password', salt, 32).toString('hex')
test('correct password works; incorrect and overlong passwords fail', () => {
  assert.equal(passwordMatches('test-password', hash), true)
  assert.equal(passwordMatches('wrong', hash), false)
  assert.equal(passwordMatches('x'.repeat(257), hash), false)
  assert.equal(passwordMatches('test-password', 'invalid'), false)
})
test('session rejects forgery, expiry, wrong signing key and excessive lifetime', () => {
  const token = signSession(hash)
  assert.equal(validSession(token, hash), true)
  assert.equal(validSession(undefined, hash), false)
  assert.equal(validSession(token.slice(0,-1)+'z', hash), false)
  assert.equal(validSession(token, 'different-secret'), false)
  assert.equal(validSession(signSession(hash, Math.floor(Date.now()/1000)-1), hash), false)
  assert.equal(validSession(signSession(hash, Math.floor(Date.now()/1000)+SESSION_SECONDS+60), hash), false)
})
test('visitor session cannot authorize administrator access', () => {
  const adminState = { source: 'environment' as const, password: 'independent-admin-password' }
  assert.equal(validateAdminSessionToken(signSession(hash), adminState).ok, false)
  const adminToken = createAdminSessionToken(adminState)
  assert.ok(adminToken)
  assert.equal(validateAdminSessionToken(adminToken, adminState).ok, true)
})
test('hashPassword produces a fresh salted hash that verifies only for its password', () => {
  const fresh = hashPassword('Correct-Horse-42')
  assert.match(fresh, /^[a-f0-9]{32}:[a-f0-9]{64}$/)
  assert.notEqual(hashPassword('Correct-Horse-42'), fresh)
  assert.equal(passwordMatches('Correct-Horse-42', fresh), true)
  assert.equal(passwordMatches('correct-horse-42', fresh), false)
})
test('password strength rule rejects short, letter-only and digit-only passwords', () => {
  assert.equal(passwordStrongEnough('Short1ab'), false)
  assert.equal(passwordStrongEnough('onlylettersaa'), false)
  assert.equal(passwordStrongEnough('12345678901'), false)
  assert.equal(passwordStrongEnough('x'.repeat(300) + '1a'), false)
  assert.equal(passwordStrongEnough('Long-Enough-9'), true)
})
test('sessions are bound to the signing hash, so a password change revokes them', () => {
  const oldHash = hashPassword('Old-Password-1')
  const newHash = hashPassword('New-Password-2')
  const token = signSession(oldHash)
  assert.equal(validSession(token, oldHash), true)
  assert.equal(validSession(token, newHash), false)
  assert.equal(validSession(signSession(newHash), oldHash), false)
})
