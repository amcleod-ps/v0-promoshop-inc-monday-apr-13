import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { EXTRA_TEXT_SLOTS, textFallback } from "../../lib/cms/text-slots"
import {
  missingPricingNotice,
  productPricingNotice,
  PRICING_NOTICE_SLOTS,
  resolvePricingNotices,
} from "../../lib/pricing/notices"
import {
  APPROXIMATE_PRICING_COPY,
  CANADA_CANADIAN_PRICING_COPY,
  CANADA_USA_PRICING_COPY,
  LARGE_QUANTITY_COPY,
  NO_PRICING_COPY,
  USA_CANADIAN_PRICING_COPY,
  USA_USA_PRICING_COPY,
} from "../../lib/pricing/presentation"
import { productPricingSource } from "../../lib/pricing/source"

const DEFAULTS = {
  approximate: APPROXIMATE_PRICING_COPY,
  canadaCanadian: CANADA_CANADIAN_PRICING_COPY,
  canadaUsa: CANADA_USA_PRICING_COPY,
  usaCanadian: USA_CANADIAN_PRICING_COPY,
  usaUsa: USA_USA_PRICING_COPY,
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

test("the site and product source select all four regional notices", () => {
  const notices = resolvePricingNotices({
    "pricing.notice.canada_canadian": { value: "Canada site, Canadian source." },
    "pricing.notice.canada_usa": { value: "Canada site, USA source." },
    "pricing.notice.usa_canadian": { value: "USA site, Canadian source." },
    "pricing.notice.usa_usa": { value: "USA site, USA source." },
  })

  assert.equal(productPricingNotice(notices, "CAN", "CAN"), "Canada site, Canadian source.")
  assert.equal(productPricingNotice(notices, "CAN", "USA"), "Canada site, USA source.")
  assert.equal(productPricingNotice(notices, "USA", "CAN"), "USA site, Canadian source.")
  assert.equal(productPricingNotice(notices, "USA", "USA"), "USA site, USA source.")
  assert.equal(productPricingNotice(notices, "CAN", null), APPROXIMATE_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "USA", null), APPROXIMATE_PRICING_COPY)
})

test("unknown sources use a notice with no country or currency assumption", () => {
  assert.doesNotMatch(APPROXIMATE_PRICING_COPY, /USD|CAD|Canada|U\.S\.|USA|state|provincial/)
})

test("approved product sources select notices while availability tags do not change them", () => {
  const notices = resolvePricingNotices({})
  const canadian = productPricingSource({ sku: " TUM   106 ", tags: ["usa"] })
  const american = productPricingSource({ sku: "PUL 005", tags: ["canada"] })
  const unknown = productPricingSource({ sku: "NEW 001", tags: ["usa"] })

  assert.equal(productPricingNotice(notices, "CAN", canadian), CANADA_CANADIAN_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "USA", canadian), USA_CANADIAN_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "CAN", american), CANADA_USA_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "USA", american), USA_USA_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "CAN", unknown), APPROXIMATE_PRICING_COPY)
})

test("legacy estimate text applies only to USA products on the USA site", () => {
  const notices = resolvePricingNotices({
    "pricing.notice.approximate": { value: "Saved legacy estimate." },
    "pricing.notice.canadian": { value: "Saved legacy Canadian notice." },
  })

  assert.equal(productPricingNotice(notices, "USA", "USA"), "Saved legacy estimate.")
  assert.equal(productPricingNotice(notices, "CAN", "CAN"), CANADA_CANADIAN_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "CAN", "USA"), CANADA_USA_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "USA", "CAN"), USA_CANADIAN_PRICING_COPY)
  assert.equal(missingPricingNotice(notices), NO_PRICING_COPY)
  assert.equal(productPricingNotice(notices, "USA", null), APPROXIMATE_PRICING_COPY)
})

test("an explicit regional value or cleared field takes priority over legacy text", () => {
  for (const value of ["New USA notice.", "", "  "]) {
    const notices = resolvePricingNotices({
      "pricing.notice.approximate": { value: "Saved legacy estimate." },
      "pricing.notice.usa_usa": { value },
    })
    assert.equal(notices.usaUsa, value.trim() ? value : USA_USA_PRICING_COPY)
  }
})

test("all missing prices use one editable notice", () => {
  const notices = resolvePricingNotices({
    "pricing.notice.canadian": { value: "Saved legacy Canadian notice." },
    "pricing.notice.no_pricing": { value: "Custom no-price." },
  })

  assert.equal(missingPricingNotice(notices), "Custom no-price.")
  assert.equal(NO_PRICING_COPY, "Pricing unavailable at this time")
})

test("the notices are registered as Text content slots the save flow accepts", () => {
  assert.equal(PRICING_NOTICE_SLOTS.length, 6)
  assert.ok(!PRICING_NOTICE_SLOTS.some((slot) => slot.key === "pricing.notice.approximate"))
  assert.ok(!PRICING_NOTICE_SLOTS.some((slot) => slot.key === "pricing.notice.canadian"))
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
