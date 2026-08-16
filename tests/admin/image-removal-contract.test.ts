import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"

const actions = readFileSync("app/admin-dashboard/actions.ts", "utf8")
const productsTab = readFileSync("app/admin-dashboard/products-tab.tsx", "utf8")
const removeImageSection = actions.slice(
  actions.indexOf("export async function removeImage"),
  actions.indexOf("/**\n * Reads the URL(s)", actions.indexOf("export async function removeImage")),
)

test("product gallery removal detaches the row and keeps its Storage object", () => {
  assert.match(
    removeImageSection,
    /case "product_image"[\s\S]*?from\("product_images"\)[\s\S]*?\.delete\(\)/,
  )
  assert.doesNotMatch(
    removeImageSection,
    /storage\.from\(BUCKET\)\.remove/,
    "removing a product gallery row must not remove its Storage object",
  )
  assert.match(
    productsTab,
    /original file stays in Storage so it can be recovered or re-attached/,
  )
})
