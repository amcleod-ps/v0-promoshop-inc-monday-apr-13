-- PromoShop Inc. — initial schema
--
-- Apply by pasting the contents of this file into the Supabase project
-- SQL Editor (Dashboard -> SQL Editor -> New query -> Run) or by running
-- `supabase db push` if you use the Supabase CLI with this directory linked
-- to your project.
--
-- This schema supports:
--   * Public homepage hero slideshow  (hero_slides)
--   * Public brand catalog            (brands)
--   * Public quote-request form       (quote_requests)
--
-- Row-Level Security is enabled on every table. Public visitors (the
-- anon key the website uses) can:
--   * SELECT active hero_slides and brands
--   * INSERT a new quote_requests row
-- Public visitors cannot read, update, or delete quote_requests. To view
-- and manage quote requests, sign in to the Supabase Dashboard and use
-- the Table Editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh on every UPDATE
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------
create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,
  website_url text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists brands_active_sort_idx
  on public.brands (is_active, sort_order);

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at
  before update on public.brands
  for each row execute function public.set_updated_at();

alter table public.brands enable row level security;

drop policy if exists "brands_public_read_active" on public.brands;
create policy "brands_public_read_active"
  on public.brands
  for select
  to anon, authenticated
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- hero_slides
-- ---------------------------------------------------------------------------
create table if not exists public.hero_slides (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  subtitle    text,
  cta_text    text,
  cta_url     text,
  image_url   text,
  bg_color    text,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists hero_slides_active_sort_idx
  on public.hero_slides (is_active, sort_order);

drop trigger if exists hero_slides_set_updated_at on public.hero_slides;
create trigger hero_slides_set_updated_at
  before update on public.hero_slides
  for each row execute function public.set_updated_at();

alter table public.hero_slides enable row level security;

drop policy if exists "hero_slides_public_read_active" on public.hero_slides;
create policy "hero_slides_public_read_active"
  on public.hero_slides
  for select
  to anon, authenticated
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- quote_requests
-- ---------------------------------------------------------------------------
create table if not exists public.quote_requests (
  id              uuid primary key default gen_random_uuid(),
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  company         text,
  brand_interest  text,
  quantity_range  text,
  message         text not null,
  status          text not null default 'new',
  admin_notes     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists quote_requests_status_created_idx
  on public.quote_requests (status, created_at desc);

drop trigger if exists quote_requests_set_updated_at on public.quote_requests;
create trigger quote_requests_set_updated_at
  before update on public.quote_requests
  for each row execute function public.set_updated_at();

alter table public.quote_requests enable row level security;

-- Public form submission only. Anyone can create a new quote, but only
-- dashboard users (service_role) can read them back.
drop policy if exists "quote_requests_public_insert" on public.quote_requests;
create policy "quote_requests_public_insert"
  on public.quote_requests
  for insert
  to anon, authenticated
  with check (
    status = 'new'
    and admin_notes is null
  );
