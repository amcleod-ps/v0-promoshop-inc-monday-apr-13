-- PromoShop Inc. — quote_requests defense-in-depth
--
-- Apply this AFTER 0006_sort_order_triggers.sql, the same way as the
-- others: paste into the Supabase Dashboard -> SQL Editor -> New query ->
-- Run. (Originally numbered 0006 on this branch; renumbered to 0007 when
-- the sort-order trigger migration claimed 0006 on main.)
--
-- The public quote form's server action (app/actions/quotes.ts) enforces
-- tight field limits, but the RLS insert policy deliberately lets the anon
-- key insert into quote_requests directly through the PostgREST API — a
-- path that skips the server action entirely. These CHECK constraints are
-- the database-side backstop for that path, with looser limits than the
-- action so legitimate submissions never trip them.
--
-- NOT VALID: existing rows are not re-checked (so an oversized legacy row
-- can't block the migration), but every new INSERT/UPDATE is.

alter table public.quote_requests
  drop constraint if exists quote_requests_first_name_len;
alter table public.quote_requests
  add constraint quote_requests_first_name_len
  check (char_length(first_name) <= 200) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_last_name_len;
alter table public.quote_requests
  add constraint quote_requests_last_name_len
  check (char_length(last_name) <= 200) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_email_len;
alter table public.quote_requests
  add constraint quote_requests_email_len
  check (char_length(email) <= 320) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_phone_len;
alter table public.quote_requests
  add constraint quote_requests_phone_len
  check (phone is null or char_length(phone) <= 100) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_company_len;
alter table public.quote_requests
  add constraint quote_requests_company_len
  check (company is null or char_length(company) <= 400) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_brand_interest_len;
alter table public.quote_requests
  add constraint quote_requests_brand_interest_len
  check (brand_interest is null or char_length(brand_interest) <= 400) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_quantity_range_len;
alter table public.quote_requests
  add constraint quote_requests_quantity_range_len
  check (quantity_range is null or char_length(quantity_range) <= 200) not valid;

alter table public.quote_requests
  drop constraint if exists quote_requests_message_len;
alter table public.quote_requests
  add constraint quote_requests_message_len
  check (char_length(message) <= 20000) not valid;
