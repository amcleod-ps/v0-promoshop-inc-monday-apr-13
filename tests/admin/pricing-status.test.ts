import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { pricingStatusNotice } from "../../lib/pricing/admin-status"

const TECHNICAL_WORDS =
  /flag|database|server|environment|TIERED_PRICING|feature_flags|stage|\btrue\b|\bfalse\b/i

test("both gates on shows a neutral live notice", () => {
  const notice = pricingStatusNotice({ dbFlagEnabled: true, serverFlagEnabled: true })

  assert.equal(notice.tone, "neutral")
  assert.equal(notice.heading, "Public pricing is live.")
})

test("both gates off shows a neutral off notice", () => {
  const notice = pricingStatusNotice({ dbFlagEnabled: false, serverFlagEnabled: false })

  assert.equal(notice.tone, "neutral")
  assert.equal(notice.heading, "Public pricing is off.")
})

test("mismatched gates show the same warning in either direction", () => {
  const dbOnly = pricingStatusNotice({ dbFlagEnabled: true, serverFlagEnabled: false })
  const serverOnly = pricingStatusNotice({ dbFlagEnabled: false, serverFlagEnabled: true })

  assert.equal(dbOnly.tone, "warning")
  assert.deepEqual(serverOnly, dbOnly)
  assert.match(dbOnly.body, /customers cannot see prices/)
})

test("no state names a flag or uses technical words", () => {
  for (const dbFlagEnabled of [true, false]) {
    for (const serverFlagEnabled of [true, false]) {
      const { heading, body } = pricingStatusNotice({ dbFlagEnabled, serverFlagEnabled })
      assert.doesNotMatch(heading + " " + body, TECHNICAL_WORDS)
    }
  }
})

test("the Pricing tab renders the helper instead of the Stage 2 text", () => {
  const source = readFileSync("app/admin-dashboard/pricing-tab.tsx", "utf8")

  assert.match(source, /pricingStatusNotice\(state\)/)
  assert.doesNotMatch(source, /Stage 2|Database flag|server\s+flag/)
})
