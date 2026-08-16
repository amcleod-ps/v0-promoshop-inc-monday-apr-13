import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  "supabase/migrations/0013_pricing_administration.sql",
  "utf8",
)

const snapshotMigration = readFileSync(
  "supabase/migrations/0014_quote_pricing_snapshot.sql",
  "utf8",
)

const publicPricingStartMigration = readFileSync(
  "supabase/migrations/0015_public_pricing_start_quantity.sql",
  "utf8",
)

const triggerFunctionHardeningMigration = readFileSync(
  "supabase/migrations/0016_trigger_function_security_hardening.sql",
  "utf8",
)

const collectionProductIndexMigration = readFileSync(
  "supabase/migrations/0017_collection_product_foreign_key_index.sql",
  "utf8",
)

test("catalogue lifecycle is protected at the database boundary", () => {
  assert.match(
    migration,
    /create trigger products_protect_active_pricing\s+before update of min_qty, is_active on public\.products/i,
  )
  assert.match(
    migration,
    /retire active pricing before changing product MOQ/,
  )
  assert.match(
    migration,
    /retire active pricing before deactivating product SKU/,
  )
  assert.equal(
    Array.from(migration.matchAll(/on update restrict/g)).length,
    2,
    "tier and state foreign keys must both prevent evidence-breaking SKU renames",
  )
  assert.match(
    migration,
    /if v_action = 'replace'\s+and v_product_active is distinct from true then/,
  )
})

test("admin reads use one integrity-bearing scalar snapshot", () => {
  assert.doesNotMatch(
    migration,
    /pg_catalog\\.coalesce/,
    "COALESCE is SQL syntax and cannot be schema-qualified",
  )
  assert.match(
    migration,
    /create function public\.load_pricing_admin_snapshot\(\)\s+returns jsonb\s+language sql\s+stable\s+security definer\s+set search_path = ''/i,
  )
  assert.match(migration, /'actual_tier_count'/)
  assert.match(migration, /'computed_fingerprint'/)
  assert.match(
    migration,
    /revoke all\s+on function public\.load_pricing_admin_snapshot\(\)\s+from public, anon, authenticated, service_role/i,
  )
  assert.match(
    migration,
    /grant execute\s+on function public\.load_pricing_admin_snapshot\(\)\s+to service_role/i,
  )
})

test("atomic mutation retains bounded resource and inactive-release guards", () => {
  assert.match(
    migration,
    /set lock_timeout = '5s'\s+as \$replace_sets\$/i,
  )
  assert.match(migration, /operations exceed the 10,000-tier atomic limit/)
  assert.match(
    migration,
    /pg_catalog\.char_length\(v_sku\) > 5000/,
  )
  assert.match(
    migration,
    /exactly one inactive pricing flag/,
  )
  assert.match(
    migration,
    /SECURITY DEFINER owner must bypass forced RLS/,
  )
  assert.match(
    migration,
    /pg_catalog\.jsonb_agg\(\s*pg_catalog\.jsonb_build_array\(\s*state\.product_sku,\s*state\.status,\s*state\.fingerprint/s,
  )
})

test("the public quote policy pins the pricing snapshot to NULL", () => {
  // scripts/check-sql.mjs proves this behaviourally against a real engine.
  // This guards the source text so the clause cannot be dropped in a rewrite
  // of the policy without someone deliberately editing this expectation too.
  assert.match(
    snapshotMigration,
    /create policy "quote_requests_public_insert"[\s\S]*?with check \(\s*status = 'new'\s+and admin_notes is null\s+and pricing_snapshot is null\s*\)/,
  )
  assert.match(
    snapshotMigration,
    /check \(\s*pricing_snapshot is null\s+or jsonb_typeof\(pricing_snapshot\) = 'object'\s*\)/,
  )
  assert.doesNotMatch(
    snapshotMigration,
    /grant[\s\S]*pricing_snapshot[\s\S]*to (anon|authenticated)/i,
    "browser roles must never be granted the verified snapshot column",
  )
})

test("public pricing starts at one while supplier MOQ stays internal", () => {
  assert.match(
    publicPricingStartMigration,
    /add column supplier_min_qty integer/i,
  )
  assert.match(
    publicPricingStartMigration,
    /set supplier_min_qty = min_qty/i,
  )
  assert.match(
    publicPricingStartMigration,
    /alter column supplier_min_qty set default 1/i,
  )
  assert.match(
    publicPricingStartMigration,
    /set min_qty = 1/i,
  )
  assert.match(
    publicPricingStartMigration,
    /requires no pricing tiers or tier-set history/i,
  )
  assert.match(
    publicPricingStartMigration,
    /never display it as a public quantity gate/i,
  )
})

test("trigger functions have no direct API surface or mutable search path", () => {
  for (const functionName of [
    "set_updated_at",
    "assign_sort_order",
    "force_quote_request_insert_defaults",
  ]) {
    assert.match(
      triggerFunctionHardeningMigration,
      new RegExp(
        `alter function public\\.${functionName}\\(\\)\\s+set search_path = ''`,
        "i",
      ),
    )
    assert.match(
      triggerFunctionHardeningMigration,
      new RegExp(
        `revoke all\\s+on function public\\.${functionName}\\(\\)\\s+from public, anon, authenticated, service_role`,
        "i",
      ),
    )
  }

  assert.match(
    triggerFunctionHardeningMigration,
    /must remove direct trigger-function execution from API roles/i,
  )
})

test("collection membership has a product-side foreign-key index", () => {
  assert.match(
    collectionProductIndexMigration,
    /create index if not exists collection_products_product_sku_idx\s+on public\.collection_products \(product_sku\)/i,
  )
  assert.match(
    collectionProductIndexMigration,
    /must create a ready, valid product_sku index/i,
  )
})
