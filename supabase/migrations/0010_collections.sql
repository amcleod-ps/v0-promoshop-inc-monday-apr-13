-- 0010 — collections (Priority 4)
--
-- Apply AFTER 0009, by hand, in the Supabase SQL Editor.
--
-- A collection is a curated grouping of products built from the dashboard,
-- two ways at once ("both"): hand-picked products (collection_products, ordered)
-- AND a saved filter (filter_tags / filter_category) that auto-includes any
-- product matching it. The public /collections pages render the union
-- (hand-picked first, then filter matches), and each collection can be exported
-- for Mailchimp.
--
-- Reads are defensive (lib/supabase/collections.ts returns [] / null on any
-- error), so the site is unaffected until this migration is applied. Writes are
-- service-role only (the dashboard), so no INSERT/UPDATE policies are needed —
-- the service role bypasses RLS, exactly like brands/products.

begin;

create table if not exists public.collections (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  description     text,
  filter_tags     text[] not null default '{}',
  filter_category text,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists collections_active_sort_idx
  on public.collections (is_active, sort_order);

drop trigger if exists collections_set_updated_at on public.collections;
create trigger collections_set_updated_at
  before update on public.collections
  for each row execute function public.set_updated_at();

alter table public.collections enable row level security;

drop policy if exists "collections_public_read_active" on public.collections;
create policy "collections_public_read_active"
  on public.collections
  for select
  to anon, authenticated
  using (is_active = true);

-- Hand-picked membership. Cascade so deleting a collection or product cleans up.
create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_sku   text not null references public.products(sku) on delete cascade,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  primary key (collection_id, product_sku)
);

create index if not exists collection_products_collection_sort_idx
  on public.collection_products (collection_id, sort_order);

alter table public.collection_products enable row level security;

drop policy if exists "collection_products_public_read" on public.collection_products;
create policy "collection_products_public_read"
  on public.collection_products
  for select
  to anon, authenticated
  using (true);

commit;
