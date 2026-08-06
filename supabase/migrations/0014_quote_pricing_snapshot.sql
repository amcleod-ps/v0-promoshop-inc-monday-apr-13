-- 0014 — verified quote pricing snapshot
--
-- Apply AFTER 0013_pricing_administration.sql.
--
-- Records the server's own pricing calculation alongside a quote request, and
-- closes the one path by which a browser could have claimed that an estimate
-- was verified. This migration loads no pricing, creates no synthetic rows and
-- changes neither release flag.

begin;

alter table public.quote_requests
  add column pricing_snapshot jsonb;

comment on column public.quote_requests.pricing_snapshot is
  'Server-calculated pricing evidence for this request, or NULL when the request carried no priced items. Written only by the site server action through a BYPASSRLS role; anon and authenticated are pinned to NULL by quote_requests_public_insert, so a value here always came from server-side recalculation and never from the browser.';

-- An object or nothing. A scalar, array or string here would mean the writer
-- was not the server action, so reject it at the boundary rather than storing
-- an unreadable estimate.
alter table public.quote_requests
  add constraint quote_requests_pricing_snapshot_is_object
    check (
      pricing_snapshot is null
      or jsonb_typeof(pricing_snapshot) = 'object'
    );

-- The 0001 public-form policy permitted any value in any column the CHECK
-- constraints allowed, which would now include a fabricated pricing snapshot
-- supplied straight to PostgREST with the anon key. Recreate the policy with
-- the column pinned to NULL.
--
-- This is the actual guarantee, not the column comment above it: anon and
-- authenticated are not BYPASSRLS, so no direct caller using those keys can
-- satisfy the policy while supplying a snapshot. The site's server action
-- writes the verified value through the service role, which bypasses RLS.
drop policy if exists "quote_requests_public_insert" on public.quote_requests;
create policy "quote_requests_public_insert"
  on public.quote_requests
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and admin_notes is null
    and pricing_snapshot is null
  );

commit;
