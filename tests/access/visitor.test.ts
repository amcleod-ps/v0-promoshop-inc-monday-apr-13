import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scryptSync } from 'node:crypto'
import { passwordMatches, signSession, validSession, SESSION_SECONDS } from '../../lib/visitor-access-crypto'
import { isAdminRequestAuthorized } from '../../lib/admin-auth'
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
test('visitor password and absent administrator configuration do not authorize admin', async () => {
  const saved = process.env.ADMIN_DASHBOARD_PASSWORD
  delete process.env.ADMIN_DASHBOARD_PASSWORD
  assert.equal(await isAdminRequestAuthorized(null), false)
  process.env.ADMIN_DASHBOARD_PASSWORD = 'independent-admin-password'
  assert.equal(await isAdminRequestAuthorized('Basic '+Buffer.from('client:test-password').toString('base64')), false)
  assert.equal(await isAdminRequestAuthorized('Basic '+Buffer.from('admin:independent-admin-password').toString('base64')), true)
  if(saved === undefined) delete process.env.ADMIN_DASHBOARD_PASSWORD
  else process.env.ADMIN_DASHBOARD_PASSWORD = saved
})
