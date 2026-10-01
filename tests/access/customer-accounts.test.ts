import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { PGlite } from "@electric-sql/pglite"
import { customerSignUpSchema } from "../../lib/auth/customer-schema"

const owner = "11111111-1111-4111-8111-111111111111"
const other = "22222222-2222-4222-8222-222222222222"

test("private request access and profile ownership hold at the database boundary", async () => {
  const db = new PGlite()
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
    create table public.quote_requests (
      id uuid primary key default gen_random_uuid(), first_name text not null, last_name text not null,
      email text not null, phone text, company text, quantity_range text, message text not null,
      status text not null default 'new', admin_notes text, created_at timestamptz default now(),
      updated_at timestamptz default now(), pricing_snapshot jsonb
    );
    alter table public.quote_requests enable row level security;
    grant all on public.quote_requests to anon, authenticated, service_role;
    insert into auth.users values ('${owner}'), ('${other}');
  `)
  await db.exec(readFileSync("supabase/migrations/0020_customer_accounts.sql", "utf8"))
  await db.exec(`
    insert into public.customer_profiles(id,username,first_name,last_name) values ('${owner}','owner','First','Last'), ('${other}','other','Other','Last');
    insert into public.quote_requests(first_name,last_name,email,message,customer_id,admin_notes)
      values ('First','Last','same@example.test','owned','${owner}','private staff note'),
             ('Other','Last','same@example.test','other','${other}',null),
             ('First','Last','same@example.test','legacy',null,null);
    set role authenticated;
    select set_config('request.jwt.claim.sub','${owner}', false);
  `)
  assert.deepEqual((await db.query<{ message: string }>("select message from public.customer_quote_requests")).rows, [{ message: "owned" }])
  assert.deepEqual((await db.query<{ username: string }>("select username from public.customer_profiles")).rows, [{ username: "owner" }])
  await assert.rejects(db.query("select admin_notes from public.quote_requests"), /permission denied/i)
  await assert.rejects(db.query("select admin_notes from public.customer_quote_requests"), /does not exist/i)
  await assert.rejects(db.exec(`insert into public.quote_requests(first_name,last_name,email,message,customer_id) values ('First','Last','a@example.test','forged','${other}')`), /row-level security/i)
  await assert.rejects(db.exec("update public.quote_requests set status='closed'"), /permission denied/i)
  await assert.rejects(db.exec(`insert into public.customer_profiles(id,username,first_name,last_name) values ('${other}','forged','First','Last')`), /row-level security/i)
  await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false);")
  await assert.rejects(db.query("select * from public.customer_quote_requests"), /permission denied/i)
  await assert.rejects(db.exec(`insert into public.quote_requests(first_name,last_name,email,message,customer_id) values ('First','Last','a@example.test','forged','${owner}')`), /row-level security/i)
  await db.exec("insert into public.quote_requests(first_name,last_name,email,message) values ('First','Last','guest@example.test','guest')")
  await db.close()
})

test("account input accepts password-manager text and rejects unsafe or oversized fields", () => {
  const profile = { username: " Customer_1 ", email: " Customer@example.test ", firstName: "First", lastName: "Last", company: "", phone: "", jobTitle: "", password: "a long password with spaces" }
  const result = customerSignUpSchema.parse(profile)
  assert.equal(result.username, "customer_1")
  assert.equal(result.email, "customer@example.test")
  assert.equal(result.password, profile.password)
  assert.equal(customerSignUpSchema.safeParse({ ...profile, username: "../admin" }).success, false)
  assert.equal(customerSignUpSchema.safeParse({ ...profile, password: "short" }).success, false)
  assert.equal(customerSignUpSchema.safeParse({ ...profile, company: "x".repeat(201) }).success, false)
})
