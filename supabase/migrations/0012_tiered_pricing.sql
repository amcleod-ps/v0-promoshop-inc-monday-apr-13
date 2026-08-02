-- 0012 — tiered-pricing foundation
--
-- Apply AFTER 0011_quote_id_and_product_image_order_hardening.sql.
--
-- Adds a normalized per-SKU USD tier model and two fail-closed activation
-- controls. This migration loads no customer pricing and seeds pricing off.
-- Public roles can read only the flag and tier columns required later by the
-- storefront; RLS keeps all tier rows invisible until the database flag is on.
-- Application code also requires the server-only TIERED_PRICING_ENABLED flag.

begin;

create table public.feature_flags (
  key        text primary key,
  enabled    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint feature_flags_key_format
    check (key ~ '^[a-z][a-z0-9_]{0,63}$')
);

create trigger feature_flags_set_updated_at
  before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, enabled)
values ('tiered_pricing', false);

create table public.product_price_tiers (
  product_sku         text not null,
  tier_start_quantity integer not null,
  unit_price_usd      numeric not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint product_price_tiers_pkey
    primary key (product_sku, tier_start_quantity),

  constraint product_price_tiers_product_sku_fkey
    foreign key (product_sku)
    references public.products (sku)
    on update cascade
    on delete cascade,

  constraint product_price_tiers_start_positive
    check (tier_start_quantity > 0),

  constraint product_price_tiers_price_positive
    check (unit_price_usd > 0),

  constraint product_price_tiers_price_upper_bound
    check (unit_price_usd < 100000000),

  -- Reject rather than silently round inputs with more than four decimals.
  constraint product_price_tiers_price_scale
    check (unit_price_usd = trunc(unit_price_usd, 4))
);

create trigger product_price_tiers_set_updated_at
  before update on public.product_price_tiers
  for each row execute function public.set_updated_at();

alter table public.feature_flags enable row level security;
alter table public.feature_flags force row level security;

alter table public.product_price_tiers enable row level security;
alter table public.product_price_tiers force row level security;

-- Supabase no longer guarantees automatic Data API grants for new tables.
-- Remove every inherited/default grant before rebuilding the exact surface.
revoke all privileges on table public.feature_flags
  from public, anon, authenticated, service_role;

revoke all privileges on table public.product_price_tiers
  from public, anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;

grant select (key, enabled)
  on table public.feature_flags
  to anon, authenticated;

grant select (product_sku, tier_start_quantity, unit_price_usd)
  on table public.product_price_tiers
  to anon, authenticated;

grant select on table public.feature_flags to service_role;
grant update (enabled) on table public.feature_flags to service_role;

grant select, insert, update, delete
  on table public.product_price_tiers
  to service_role;

create policy "feature_flags_public_read_tiered_pricing"
  on public.feature_flags
  for select
  to anon, authenticated
  using (key = 'tiered_pricing');

create policy "product_price_tiers_public_read_enabled"
  on public.product_price_tiers
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products as p
      where p.sku = product_price_tiers.product_sku
        and p.is_active = true
    )
    and coalesce(
      (
        select f.enabled
        from public.feature_flags as f
        where f.key = 'tiered_pricing'
      ),
      false
    )
  );

commit;
