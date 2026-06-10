-- 0008 — quote_requests insert hardening + seeded copy fix
--
-- Apply AFTER 0007_quote_request_hardening.sql, by hand, in the Supabase
-- SQL Editor (same as every other migration in this repo).
--
-- 1) Force server-side timestamps on quote_requests inserts.
--    The anon key has an INSERT policy (0001) for the public quote form,
--    and PostgREST callers could supply arbitrary created_at/updated_at
--    values, corrupting back-office triage ordering. The website's own
--    server action never sends these columns, so it is unaffected.
--
-- 2) Mend a sentence fragment in the seeded About-page copy
--    ("…program. Our team manages…"). Guarded by the exact original text
--    so an admin's edited copy is never overwritten.

begin;

create or replace function public.force_quote_request_timestamps()
returns trigger
language plpgsql
as $$
begin
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists quote_requests_force_timestamps on public.quote_requests;
create trigger quote_requests_force_timestamps
  before insert on public.quote_requests
  for each row
  execute function public.force_quote_request_timestamps();

update public.site_content
set value = 'Whether supporting a national rollout, a luxury gifting initiative, or a curated company apparel program, our team manages every detail from concept to completion.',
    updated_at = now()
where key = 'about.hero.body.3'
  and value = 'Whether supporting a national rollout, a luxury gifting initiative, or a curated company apparel program. Our team manages every detail from concept to completion.';

commit;
