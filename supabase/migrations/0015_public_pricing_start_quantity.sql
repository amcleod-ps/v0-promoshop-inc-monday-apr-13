-- 0015 — public pricing starts at one unit
--
-- Apply after 0014_quote_pricing_snapshot.sql.
--
-- The approved USD source distinguishes each supplier's operational MOQ from
-- the public pricing rule: every offered tier starts at one unit. Preserve the
-- former value for operations, but make min_qty the public pricing start used
-- by the existing protected tier and snapshot path.
--
-- This migration must run before any tier import. It refuses to rewrite a
-- catalogue with pricing history, so an operator cannot silently invalidate a
-- released estimate or its audit trail.

begin;

do $public_pricing_start_prerequisites$
begin
  if to_regclass('public.products') is null
     or to_regclass('public.product_price_tiers') is null
     or to_regclass('public.product_price_tier_sets') is null then
    raise exception '0015 requires 0013_pricing_administration.sql'
      using errcode = '55000';
  end if;

  if exists (select 1 from public.product_price_tiers)
     or exists (select 1 from public.product_price_tier_sets) then
    raise exception
      '0015 requires no pricing tiers or tier-set history; retire, reconcile, and approve a separate migration before changing public quantity semantics'
      using errcode = '55000';
  end if;
end
$public_pricing_start_prerequisites$;

alter table public.products
  add column supplier_min_qty integer;

-- Capture the pre-existing catalogue value before repurposing min_qty for the
-- public pricing engine. The field is internal operational context only; it
-- must not become a customer-facing quantity restriction.
update public.products
set supplier_min_qty = min_qty;

alter table public.products
  alter column supplier_min_qty set not null;

alter table public.products
  alter column supplier_min_qty set default 1;

alter table public.products
  add constraint products_supplier_min_qty_positive
  check (supplier_min_qty > 0);

update public.products
set min_qty = 1
where min_qty <> 1;

comment on column public.products.min_qty is
  'Public pricing starting quantity. The approved PromoShop USD source starts every offered public tier at one unit.';

comment on column public.products.supplier_min_qty is
  'Historical supplier operational MOQ captured by migration 0015. Internal context only; never display it as a public quantity gate.';

do $public_pricing_start_postconditions$
begin
  if exists (
    select 1
    from public.products
    where min_qty <> 1
       or supplier_min_qty <= 0
  ) then
    raise exception '0015 must leave every product with public pricing start one and a positive preserved supplier MOQ'
      using errcode = '55000';
  end if;
end
$public_pricing_start_postconditions$;

commit;
