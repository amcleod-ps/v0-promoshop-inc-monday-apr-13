-- 0019 — administrator access foundation
--
-- Apply AFTER 0018_visitor_access.sql.
--
-- Singleton table holding the administrator password as a salted scrypt hash.
-- It intentionally starts EMPTY: no credential is seeded into source. Until
-- the first row exists, lib/admin-session.ts falls back to the
-- ADMIN_DASHBOARD_PASSWORD environment variable; once a row exists, the
-- database hash is the only valid administrator credential and the
-- environment value is no longer accepted.
--
-- Recovery when the database password is lost is an account-owner operation
-- through the authorized Supabase control plane (SQL Editor / Dashboard):
-- delete the row to re-arm the environment password, or replace the hash.
-- There is no public recovery route.
--
-- Password ownership chain: the dashboard rotation flow rotates only the
-- hash in this table (see lib/admin-session.ts rotateAdminPassword).

begin;

create table public.admin_access (
  -- Singleton: the single row always has id = true.
  id            boolean primary key default true check (id),
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- "saltHex:hashHex" produced by lib/admin-session.ts hashAdminPassword.
  -- Refuse obviously malformed values at the database boundary so a
  -- Table-Editor edit cannot silently disable password verification.
  constraint admin_access_hash_format
    check (password_hash ~ '^[a-f0-9]{32}:[a-f0-9]{64}$')
);

create trigger admin_access_set_updated_at
  before update on public.admin_access
  for each row execute function public.set_updated_at();

alter table public.admin_access enable row level security;
alter table public.admin_access force row level security;

-- Supabase no longer guarantees automatic Data API grants for new tables.
-- Remove every inherited/default grant before rebuilding the exact surface.
revoke all privileges on table public.admin_access
  from public, anon, authenticated, service_role;

grant usage on schema public to service_role;

grant select, insert, update, delete
  on table public.admin_access
  to service_role;

-- Deliberately create no policies: anon and authenticated have neither table
-- privileges nor RLS policies. Only the server-only service-role client
-- (which bypasses RLS) may read or rotate the administrator credential.

commit;
