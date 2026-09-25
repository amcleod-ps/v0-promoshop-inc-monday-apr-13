import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { EXTRA_TEXT_SLOTS, textFallback } from "../../lib/cms/text-slots"
import {
  missingPricingNotice,
  PRICING_NOTICE_SLOTS,
  resolvePricingNotices,
} from "../../lib/pricing/notices"
import {
  APPROXIMATE_PRICING_COPY,
  CANADIAN_PRICING_COPY,
  LARGE_QUANTITY_COPY,
  NO_PRICING_COPY,
} from "../../lib/pricing/presentation"

const DEFAULTS = {
  approximate: APPROXIMATE_PRICING_COPY,
  canadian: CANADIAN_PRICING_COPY,
  noPricing: NO_PRICING_COPY,
  largeQuantity: LARGE_QUANTITY_COPY,
}

test("with no saved rows every notice shows its exact default", () => {
  assert.deepEqual(resolvePricingNotices({}), DEFAULTS)
})

test("a saved value overrides only its own notice", () => {
  for (const slot of PRICING_NOTICE_SLOTS) {
    const override = "Edited " + slot.notice + " notice."
    const notices = resolvePricingNotices({ [slot.key]: { value: override } })

    assert.deepEqual(notices, { ...DEFAULTS, [slot.notice]: override })
  }
})

test("an empty, blank, or null saved value shows the default", () => {
  for (const value of ["", "   ", "\n\t ", null]) {
    const map = Object.fromEntries(
      PRICING_NOTICE_SLOTS.map((slot) => [slot.key, { value: value as string }]),
    )
    assert.deepEqual(resolvePricingNotices(map), DEFAULTS)
  }
})

test("missing-price products route to the Canadian or no-price notice", () => {
  const notices = resolvePricingNotices({
    "pricing.notice.canadian": { value: "Custom Canadian." },
    "pricing.notice.no_pricing": { value: "Custom no-price." },
  })

  assert.equal(missingPricingNotice(notices, "BAG 109"), "Custom Canadian.")
  assert.equal(missingPricingNotice(notices, " TUM 103 "), "Custom Canadian.")
  assert.equal(missingPricingNotice(notices, "UNLISTED 1"), "Custom no-price.")
  assert.equal(missingPricingNotice(notices, ""), "Custom no-price.")
})

test("the notices are registered as Text content slots the save flow accepts", () => {
  for (const slot of PRICING_NOTICE_SLOTS) {
    const registered = EXTRA_TEXT_SLOTS.find((entry) => entry.key === slot.key)

    assert.ok(registered, slot.key + " is not registered in text-slots.ts")
    assert.equal(registered.fallback, DEFAULTS[slot.notice])
    assert.equal(textFallback(slot.key), DEFAULTS[slot.notice])
    // Same key rules updateSiteContent enforces before it upserts.
    assert.match(slot.key, /^[a-z0-9._-]+$/)
    assert.ok(slot.key.length <= 200 && slot.label.length <= 200)
  }
})

test("the dashboard groups the notices under a Pricing notices label", () => {
  const page = readFileSync("app/admin-dashboard/page.tsx", "utf8")

  assert.match(
    page,
    /\{ prefix: "pricing\.notice\.", group: "Pricing notices", multiline: true \}/,
  )
  assert.match(page, /CONTENT_GROUP_ORDER = \[[\s\S]*?"Pricing notices",[\s\S]*?\]/)
})

test("public components read the live notices as plain text", () => {
  for (const file of [
    "app/my-quote/my-quote-client.tsx",
    "components/studio/product-detail-modal.tsx",
  ]) {
    const source = readFileSync(file, "utf8")

    assert.match(source, /usePricingNotices\(\)/, file)
    assert.doesNotMatch(
      source,
      /APPROXIMATE_PRICING_COPY|CANADIAN_PRICING_COPY|NO_PRICING_COPY|LARGE_QUANTITY_COPY/,
      file + " bypasses the editable notices",
    )
    assert.doesNotMatch(
      source,
      /renderInlineMarkdown|RichText|dangerouslySetInnerHTML/,
      file + " must render notices as plain text",
    )
  }
})
