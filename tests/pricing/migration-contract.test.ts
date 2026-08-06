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
