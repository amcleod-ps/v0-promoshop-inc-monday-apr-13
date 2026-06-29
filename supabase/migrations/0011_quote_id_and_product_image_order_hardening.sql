-- 0011 — quote insert identity + product-level image ordering hardening
--
-- Apply AFTER 0010_collections.sql.
--
-- 1) Direct PostgREST inserts can still supply quote_requests.id. Force the
--    primary key server-side, the same way migration 0008 already forced
--    timestamps. The public site never submits id/created_at/updated_at, so
--    legitimate submissions are unaffected.
--
-- 2) Add a small DB-side email throttle for direct inserts that bypass the
--    server action's IP rate limit and honeypot. This is not a captcha, but it
--    blocks simple repeated spam against one address at the database boundary.
--
-- 3) The generic assign_sort_order() helper compared scoped columns with "=".
--    For product_images where colour_id IS NULL (product-level images), that
--    query never matched earlier NULL rows, so every product-level image got
--    sort_order 0. Treat NULL scopes as a real group.

begin;

drop trigger if exists quote_requests_force_timestamps on public.quote_requests;
drop trigger if exists quote_requests_force_insert_defaults on public.quote_requests;
drop function if exists public.force_quote_request_timestamps();

create or replace function public.force_quote_request_insert_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  new.id := gen_random_uuid();
  new.created_at := now();
  new.updated_at := now();

  select count(*)
    into recent_count
  from public.quote_requests
  where lower(email) = lower(new.email)
    and created_at >= now() - interval '10 minutes';

  if recent_count >= 5 then
    raise exception 'Too many quote requests for this email. Please wait a few minutes and try again.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.force_quote_request_insert_defaults() from public;

create trigger quote_requests_force_insert_defaults
  before insert on public.quote_requests
  for each row
  execute function public.force_quote_request_insert_defaults();

create or replace function public.assign_sort_order()
returns trigger
language plpgsql
as $$
declare
  scope_col text := tg_argv[0]; -- '' = table-wide ordering, else a column name
  scope_val text;
  next_val  integer;
begin
  if new.sort_order is not null then
    return new;
  end if;

  if scope_col is null or scope_col = '' then
    perform pg_advisory_xact_lock(
      hashtext(tg_table_schema || '.' || tg_table_name));
    execute format(
      'select coalesce(max(sort_order), -1) + 1 from %I.%I',
      tg_table_schema, tg_table_name)
      into next_val;
  else
    scope_val := to_jsonb(new) ->> scope_col;
    perform pg_advisory_xact_lock(
      hashtext(tg_table_schema || '.' || tg_table_name || ':' || coalesce(scope_val, '<null>')));
    -- ::text comparison keeps this generic across text and uuid scope
    -- columns; the explicit NULL branch makes product-level images
    -- (product_images.colour_id IS NULL) order as a shared-image group.
    execute format(
      'select coalesce(max(sort_order), -1) + 1 from %I.%I where (%I::text = $1 or (%I is null and $1 is null))',
      tg_table_schema, tg_table_name, scope_col, scope_col)
      into next_val
      using scope_val;
  end if;

  new.sort_order := next_val;
  return new;
end
$$;

commit;
