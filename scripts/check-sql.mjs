/**
 * Applies every migration, in order, to a real PostgreSQL engine (PGlite —
 * PostgreSQL compiled to WebAssembly), then asserts the invariants the
 * application relies on.
 *
 * This exists because nothing else in the pipeline executes the SQL. Lint and
 * the production build never parse a migration, so a syntax error, an
 * impossible constraint or a privilege mistake would reach the client's
 * database unchallenged. The migrations are the one artefact here that is
 * effectively irreversible in production.
 *
 * Supabase roles are created first: the migrations grant to anon,
 * authenticated and service_role, which exist in a Supabase project but not in
 * a bare PostgreSQL cluster.
 */
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"

const MIGRATIONS_DIR = "supabase/migrations"

const SUPABASE_ROLES = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
`

/**
 * Minimal stand-in for the Supabase Storage schema, which the platform
 * provisions and no migration in this repository creates. Only the two tables
 * and the four columns that migration 0002 actually touches are modelled;
 * this is a fixture for applying the migrations, not a reimplementation of
 * Storage. If a future migration needs more of it, this stub will fail
 * loudly, which is preferable to quietly diverging from production.
 */
const SUPABASE_STORAGE_STUB = `
  create schema storage;

  create table storage.buckets (
    id     text primary key,
    name   text not null,
    public boolean not null default false
  );

  create table storage.objects (
    id        uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name      text
  );

  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated, service_role;
`

/**
 * The one deliberate deviation from the production SQL.
 *
 * PGlite does not ship the pgcrypto contrib module, so `CREATE EXTENSION
 * pgcrypto` aborts 0001. The migrations use pgcrypto for exactly one thing —
 * gen_random_uuid() — and that function has been part of core PostgreSQL
 * since version 13, so it resolves natively here. Supabase provides the real
 * extension, so production is unaffected.
 *
 * Scope is one statement. If a migration ever calls digest(), hmac(), crypt()
 * or the pgp_* family, this shim stops being sound and the call will fail
 * loudly rather than pass silently — which is the behaviour we want.
 */
function neutralizePgcrypto(sql) {
  return sql.replace(
    /create\s+extension\s+if\s+not\s+exists\s+"?pgcrypto"?\s*;/gi,
    "-- [check-sql] pgcrypto omitted; gen_random_uuid is core since PG13",
  )
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
}

/** Fails the check with a stable, greppable message. */
function fail(message) {
  console.error(`\n✖ ${message}\n`)
  process.exitCode = 1
}

async function scalar(db, sql, params = []) {
  const result = await db.query(sql, params)
  return Object.values(result.rows[0] ?? {})[0]
}

async function main() {
  const db = new PGlite()
  await db.exec(SUPABASE_ROLES)
  await db.exec(SUPABASE_STORAGE_STUB)

  const files = migrationFiles()
  if (files.length === 0) {
    fail("no migrations found")
    return
  }

  for (const file of files) {
    const sql = neutralizePgcrypto(
      readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"),
    )
    try {
      await db.exec(sql)
      console.log(`  applied ${file}`)
    } catch (error) {
      fail(`${file} failed to apply: ${error.message}`)
      return
    }
  }

  console.log(`\napplied ${files.length} migrations\n`)

  // --- Invariants ---------------------------------------------------------

  // A verified pricing estimate must be server-written. The public insert
  // policy is the guarantee: anon and authenticated are not BYPASSRLS, so a
  // WITH CHECK that pins the column to NULL cannot be circumvented by a
  // direct PostgREST caller.
  const insertPolicy = await scalar(
    db,
    `select pg_catalog.pg_get_expr(polwithcheck, polrelid)
       from pg_catalog.pg_policy
      where polrelid = 'public.quote_requests'::regclass
        and polname = 'quote_requests_public_insert'`,
  )

  if (typeof insertPolicy !== "string") {
    fail("quote_requests_public_insert policy is missing")
  } else if (!/pricing_snapshot IS NULL/i.test(insertPolicy)) {
    fail(
      `quote_requests_public_insert must pin pricing_snapshot to NULL; got: ${insertPolicy}`,
    )
  }

  // Forced RLS on the pricing tables, so even the table owner is subject to
  // policy — and there are deliberately no policies on them.
  const unforced = await db.query(
    `select c.relname
       from pg_catalog.pg_class c
       join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'product_price_tiers', 'product_price_tier_sets',
          'product_price_tier_audit', 'feature_flags'
        )
        and not (c.relrowsecurity and c.relforcerowsecurity)`,
  )

  if (unforced.rows.length > 0) {
    fail(
      `pricing tables without forced RLS: ${unforced.rows
        .map((row) => row.relname)
        .join(", ")}`,
    )
  }

  // Browser roles must hold no privilege on any pricing table.
  const leaked = await db.query(
    `select table_name, grantee, privilege_type
       from information_schema.role_table_grants
      where table_schema = 'public'
        and grantee in ('anon', 'authenticated', 'PUBLIC')
        and table_name in (
          'product_price_tiers', 'product_price_tier_sets',
          'product_price_tier_audit', 'feature_flags'
        )`,
  )

  if (leaked.rows.length > 0) {
    fail(
      `browser roles hold pricing privileges: ${leaked.rows
        .map((r) => `${r.grantee}:${r.privilege_type} on ${r.table_name}`)
        .join(", ")}`,
    )
  }

  // The snapshot column must accept only a JSON object.
  const snapshotType = await scalar(
    db,
    `select data_type from information_schema.columns
      where table_schema = 'public'
        and table_name = 'quote_requests'
        and column_name = 'pricing_snapshot'`,
  )

  if (snapshotType !== "jsonb") {
    fail(`quote_requests.pricing_snapshot must be jsonb, got: ${snapshotType}`)
  }

  await db.query(
    `insert into public.quote_requests
       (first_name, last_name, email, message, pricing_snapshot)
     values ('A', 'B', 'a@b.co', 'm', '{"currency":"USD"}'::jsonb)`,
  )

  let rejectedNonObject = false
  try {
    await db.query(
      `insert into public.quote_requests
         (first_name, last_name, email, message, pricing_snapshot)
       values ('A', 'B', 'a@b.co', 'm', '"not-an-object"'::jsonb)`,
    )
  } catch {
    rejectedNonObject = true
  }

  if (!rejectedNonObject) {
    fail("quote_requests.pricing_snapshot accepted a non-object JSON value")
  }

  // The claim this whole design rests on, tested as behaviour rather than as
  // policy text: a caller holding the anon key — i.e. anyone who reads the
  // site's JavaScript — cannot record a fabricated estimate as verified.
  // The same insert must still succeed without a snapshot, or the public
  // quote form is broken.
  let anonSnapshotBlocked = false
  try {
    await db.exec("set role anon;")
    try {
      await db.query(
        `insert into public.quote_requests
           (first_name, last_name, email, message, pricing_snapshot)
         values ('Mallory', 'X', 'm@x.co', 'free stuff',
                 '{"estimatedTotalUsd":"0.01"}'::jsonb)`,
      )
    } catch {
      anonSnapshotBlocked = true
    }

    try {
      await db.query(
        `insert into public.quote_requests (first_name, last_name, email, message)
         values ('Real', 'Visitor', 'real@visitor.co', 'please quote')`,
      )
    } catch (error) {
      fail(`anon can no longer submit an ordinary quote: ${error.message}`)
    }
  } finally {
    await db.exec("reset role;")
  }

  if (!anonSnapshotBlocked) {
    fail("anon inserted a pricing snapshot — verified estimates are forgeable")
  }

  if (process.exitCode === 1) return

  console.log("✔ all schema invariants hold")
}

await main()
