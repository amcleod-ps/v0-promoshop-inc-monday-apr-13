begin;

create table public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_-]{3,40}$'),
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  company text not null default '' check (char_length(company) <= 200),
  phone text not null default '' check (char_length(phone) <= 50),
  job_title text not null default '' check (char_length(job_title) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from public, anon, authenticated;
grant select, insert, update on public.customer_profiles to authenticated;
grant all on public.customer_profiles to service_role;
create policy customer_profiles_own_read on public.customer_profiles for select to authenticated using (id = (select auth.uid()));
create policy customer_profiles_own_insert on public.customer_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy customer_profiles_own_update on public.customer_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create trigger customer_profiles_updated_at before update on public.customer_profiles for each row execute function public.set_updated_at();

alter table public.quote_requests add column customer_id uuid references auth.users(id) on delete set null;
alter table public.quote_requests add column request_items jsonb not null default '[]'::jsonb
  check (jsonb_typeof(request_items) = 'array' and jsonb_array_length(request_items) <= 200);
create index quote_requests_customer_created_idx on public.quote_requests(customer_id, created_at desc);
drop policy if exists quote_requests_public_insert on public.quote_requests;
create policy quote_requests_public_insert on public.quote_requests for insert to anon, authenticated with check (
  status = 'new' and admin_notes is null and pricing_snapshot is null
  and (customer_id is null or customer_id = (select auth.uid()))
);
create policy quote_requests_customer_read on public.quote_requests for select to authenticated using (customer_id = (select auth.uid()));
revoke select, update, delete, truncate, references, trigger on public.quote_requests from public, anon, authenticated;
grant select (id, customer_id, first_name, last_name, email, phone, company, quantity_range, message, status, created_at, updated_at, pricing_snapshot, request_items) on public.quote_requests to authenticated;
create view public.customer_quote_requests with (security_invoker = true) as
  select id, customer_id, first_name, last_name, email, phone, company, quantity_range, message, status, created_at, updated_at, pricing_snapshot, request_items
  from public.quote_requests;
revoke all on public.customer_quote_requests from public, anon, authenticated;
grant select on public.customer_quote_requests to authenticated;
grant select on public.customer_quote_requests to service_role;

commit;
