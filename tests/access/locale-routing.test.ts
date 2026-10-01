import assert from "node:assert/strict"
import test from "node:test"
import { getDomainLocale, getLocaleSwitchUrl } from "../../lib/locale-routing"

test("the four production hosts select their country", () => {
  assert.equal(getDomainLocale(""), undefined)
  assert.equal(getDomainLocale("promoshopstudio.ca"), "CAN")
  assert.equal(getDomainLocale("www.promoshopstudio.ca"), "CAN")
  assert.equal(getDomainLocale("promoshopstudio.com"), "USA")
  assert.equal(getDomainLocale("www.promoshopstudio.com"), "USA")
  assert.equal(getDomainLocale("WWW.PROMOSHOPSTUDIO.CA"), "CAN")
})

test("CAN selection opens .ca and keeps the page, query, and fragment", () => {
  assert.equal(
    getLocaleSwitchUrl("https://www.promoshopstudio.com/studio?category=Apparel&search=blue%20shirt#products", "CAN"),
    "https://www.promoshopstudio.ca/studio?category=Apparel&search=blue%20shirt#products",
  )
})

test("USA selection opens .com and keeps the page, query, and fragment", () => {
  assert.equal(
    getLocaleSwitchUrl("https://www.promoshopstudio.ca/brands/patagonia?from=studio#products", "USA"),
    "https://www.promoshopstudio.com/brands/patagonia?from=studio#products",
  )
})

test("apex hosts switch to the canonical country host", () => {
  assert.equal(getLocaleSwitchUrl("https://promoshopstudio.com/about", "CAN"), "https://www.promoshopstudio.ca/about")
  assert.equal(getLocaleSwitchUrl("https://promoshopstudio.ca/collections", "USA"), "https://www.promoshopstudio.com/collections")
})

test("the current country does not cause another navigation", () => {
  for (const host of ["promoshopstudio.ca", "www.promoshopstudio.ca"]) {
    assert.equal(getLocaleSwitchUrl(`https://${host}/studio`, "CAN"), null)
  }
  for (const host of ["promoshopstudio.com", "www.promoshopstudio.com"]) {
    assert.equal(getLocaleSwitchUrl(`https://${host}/studio`, "USA"), null)
  }
})

test("local, preview, and unrelated hosts do not redirect", () => {
  for (const host of ["localhost", "127.0.0.1", "preview.vercel.app", "promoshopstudio.com.example.com", "example.com", "constructor", "__proto__"]) {
    assert.equal(getDomainLocale(host), undefined)
    assert.equal(getLocaleSwitchUrl(`http://${host}:3000/studio`, "CAN"), null)
    assert.equal(getLocaleSwitchUrl(`http://${host}:3000/studio`, "USA"), null)
  }
})

test("country navigation uses HTTPS without a port or URL credentials", () => {
  assert.equal(
    getLocaleSwitchUrl("http://user:password@promoshopstudio.com:3000/my-quote?step=2#quote", "CAN"),
    "https://www.promoshopstudio.ca/my-quote?step=2#quote",
  )
})
