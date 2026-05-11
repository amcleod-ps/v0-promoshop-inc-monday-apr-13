-- PromoShop Inc. — image registry, product catalog, and storage bucket
--
-- Apply this AFTER 0001_init.sql. Adds:
--   * site_images       — generic keyed image registry (logos, hero, team,
--                         brand lifestyle backdrops, marketing tiles, etc.)
--   * brand_assets      — optional per-brand hero / lifestyle imagery
--   * products          — product catalog (name, sku, etc.)
--   * product_colours   — colourways per product
--   * product_images    — images per product / colour, with human-readable labels
--   * storage bucket    — `site-images`, public read
--
-- Every public-facing image on the website ends up either in `site_images`
-- (singletons like the homepage logo, About-page hero, brand logos, team
-- avatars, marketing tiles) or in `product_images` (gallery imagery for
-- the studio catalog). Every row has a `label` column so the client can
-- find an image in the Supabase Table Editor by reading the label.
--
-- File hosting: upload binary files into the `site-images` Storage bucket
-- and copy the public URL into the row's `url` column. The site uses
-- `?v=<updated_at>` cache-busting so replacing the URL is instantly visible
-- on the next page request.

-- ---------------------------------------------------------------------------
-- site_images
-- ---------------------------------------------------------------------------
create table if not exists public.site_images (
  key        text primary key,
  label      text not null,
  url        text not null default '',
  alt_text   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_images_set_updated_at on public.site_images;
create trigger site_images_set_updated_at
  before update on public.site_images
  for each row execute function public.set_updated_at();

alter table public.site_images enable row level security;

drop policy if exists "site_images_public_read" on public.site_images;
create policy "site_images_public_read"
  on public.site_images
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- brands — extended fields (description, categories, featured flag)
-- ---------------------------------------------------------------------------
alter table public.brands
  add column if not exists description text,
  add column if not exists categories  text[] not null default '{}',
  add column if not exists featured    boolean not null default false;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  sku            text primary key,
  name           text not null,
  category       text not null,
  description    text,
  brand_slugs    text[] not null default '{}',
  genders        text[] not null default '{}',
  sizes          text[] not null default '{}',
  min_qty        integer not null default 1,
  deco_locations text[] not null default '{}',
  deco_methods   text[] not null default '{}',
  is_active      boolean not null default true,
  is_featured    boolean not null default false,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_active_sort_idx on public.products (is_active, sort_order);
create index if not exists products_brand_slugs_gin on public.products using gin (brand_slugs);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active"
  on public.products
  for select
  to anon, authenticated
  using (is_active = true);

-- ---------------------------------------------------------------------------
-- product_colours
-- ---------------------------------------------------------------------------
create table if not exists public.product_colours (
  id          uuid primary key default gen_random_uuid(),
  product_sku text not null references public.products(sku) on delete cascade,
  name        text not null,
  hex         text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (product_sku, name)
);

create index if not exists product_colours_product_idx
  on public.product_colours (product_sku, sort_order);

drop trigger if exists product_colours_set_updated_at on public.product_colours;
create trigger product_colours_set_updated_at
  before update on public.product_colours
  for each row execute function public.set_updated_at();

alter table public.product_colours enable row level security;

drop policy if exists "product_colours_public_read" on public.product_colours;
create policy "product_colours_public_read"
  on public.product_colours
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id          uuid primary key default gen_random_uuid(),
  product_sku text not null references public.products(sku) on delete cascade,
  colour_id   uuid references public.product_colours(id) on delete cascade,
  label       text not null,
  url         text not null,
  alt_text    text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists product_images_product_sort_idx
  on public.product_images (product_sku, sort_order);
create index if not exists product_images_colour_sort_idx
  on public.product_images (colour_id, sort_order);

drop trigger if exists product_images_set_updated_at on public.product_images;
create trigger product_images_set_updated_at
  before update on public.product_images
  for each row execute function public.set_updated_at();

alter table public.product_images enable row level security;

drop policy if exists "product_images_public_read" on public.product_images;
create policy "product_images_public_read"
  on public.product_images
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Storage bucket: site-images
-- ---------------------------------------------------------------------------
-- Public-read bucket for every image file the website displays. Writes
-- require the service_role (i.e., authenticated users uploading via the
-- Supabase Dashboard).
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "site_images_storage_public_read" on storage.objects;
create policy "site_images_storage_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'site-images');
