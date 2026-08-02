-- Stage 2: protected, atomic pricing administration.
--
-- This migration deliberately starts with an empty pricing store and leaves
-- both release gates off. It creates no customer or synthetic pricing rows.
-- All tier mutations are routed through one audited SECURITY DEFINER function;
-- browser roles and direct service-role DML remain unavailable.

begin;

do $stage_2_prerequisites$
begin
  if to_regclass('public.feature_flags') is null
     or to_regclass('public.product_price_tiers') is null then
    raise exception '0013 requires 0012_tiered_pricing.sql'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.feature_flags
    where key = 'tiered_pricing'
      and enabled = false
  ) then
    raise exception '0013 requires tiered_pricing=false'
      using errcode = '55000';
  end if;

  if exists (select 1 from public.product_price_tiers) then
    raise exception '0013 requires an empty tier table'
      using errcode = '55000';
  end if;
end
$stage_2_prerequisites$;

-- Historical price state must not disappear if a catalogue row is ever
-- physically deleted. Products are normally retired with is_active=false.
alter table public.product_price_tiers
  drop constraint product_price_tiers_product_sku_fkey;

alter table public.product_price_tiers
  add constraint product_price_tiers_product_sku_fkey
  foreign key (product_sku)
  references public.products (sku)
  on update restrict
  on delete restrict;

create table public.product_price_tier_sets (
  product_sku      text primary key,
  revision         bigint not null,
  status           text not null,
  fingerprint      text not null,
  tier_count       integer not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  retired_at       timestamptz,
  last_change_id   uuid not null,
  last_changed_by  text not null,

  constraint product_price_tier_sets_product_sku_fkey
    foreign key (product_sku)
    references public.products (sku)
    on update restrict
    on delete restrict,

  constraint product_price_tier_sets_revision_positive
    check (revision > 0),

  constraint product_price_tier_sets_status_valid
    check (status in ('active', 'retired')),

  constraint product_price_tier_sets_fingerprint_valid
    check (fingerprint ~ '^[0-9a-f]{64}$'),

  constraint product_price_tier_sets_status_count_valid
    check (
      (
        status = 'active'
        and tier_count > 0
        and retired_at is null
      )
      or
      (
        status = 'retired'
        and tier_count = 0
        and retired_at is not null
      )
    ),

  constraint product_price_tier_sets_actor_valid
    check (last_changed_by = 'Authenticated admin channel')
);

create table public.product_price_tier_audit (
  id                    uuid primary key default gen_random_uuid(),
  change_id             uuid not null,
  product_sku           text not null,
  action                text not null,
  previous_revision     bigint not null,
  revision              bigint not null,
  previous_status       text,
  status                text not null,
  previous_fingerprint  text,
  fingerprint           text not null,
  previous_tier_count   integer not null,
  tier_count            integer not null,
  previous_tiers        jsonb not null,
  tiers                 jsonb not null,
  source_fingerprint    text not null,
  actor                 text not null,
  reason                text,
  changed_at            timestamptz not null,

  constraint product_price_tier_audit_change_sku_key
    unique (change_id, product_sku),

  constraint product_price_tier_audit_sku_revision_key
    unique (product_sku, revision),

  constraint product_price_tier_audit_action_valid
    check (action in ('replace', 'retire')),

  constraint product_price_tier_audit_revision_valid
    check (
      previous_revision >= 0
      and revision = previous_revision + 1
    ),

  constraint product_price_tier_audit_previous_status_valid
    check (
      previous_status is null
      or previous_status in ('active', 'retired')
    ),

  constraint product_price_tier_audit_status_valid
    check (status in ('active', 'retired')),

  constraint product_price_tier_audit_previous_fingerprint_valid
    check (
      previous_fingerprint is null
      or previous_fingerprint ~ '^[0-9a-f]{64}$'
    ),

  constraint product_price_tier_audit_fingerprint_valid
    check (fingerprint ~ '^[0-9a-f]{64}$'),

  constraint product_price_tier_audit_counts_valid
    check (
      previous_tier_count >= 0
      and tier_count >= 0
    ),

  constraint product_price_tier_audit_snapshots_valid
    check (
      jsonb_typeof(previous_tiers) = 'array'
      and jsonb_typeof(tiers) = 'array'
    ),

  constraint product_price_tier_audit_source_fingerprint_valid
    check (source_fingerprint ~ '^[0-9a-f]{64}$'),

  constraint product_price_tier_audit_actor_valid
    check (actor = 'Authenticated admin channel'),

  constraint product_price_tier_audit_reason_valid
    check (
      reason is null
      or (
        reason = btrim(reason)
        and char_length(reason) between 1 and 1000
      )
    ),

  constraint product_price_tier_audit_action_state_valid
    check (
      (
        action = 'replace'
        and status = 'active'
        and tier_count > 0
      )
      or
      (
        action = 'retire'
        and status = 'retired'
        and tier_count = 0
      )
    )
);

create index product_price_tier_audit_changed_at_idx
  on public.product_price_tier_audit (changed_at desc);

create index product_price_tier_audit_product_changed_idx
  on public.product_price_tier_audit (product_sku, changed_at desc);

alter table public.product_price_tier_sets enable row level security;
alter table public.product_price_tier_sets force row level security;

alter table public.product_price_tier_audit enable row level security;
alter table public.product_price_tier_audit force row level security;

-- Catalogue changes must follow retire -> catalogue edit -> replacement. The
-- product row is already locked when this BEFORE trigger runs; locking the
-- state row next preserves the mutation function's product -> state order.
create function public.enforce_product_pricing_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $protect_product$
declare
  v_status text;
begin
  if new.min_qty is not distinct from old.min_qty
     and new.is_active is not distinct from old.is_active then
    return new;
  end if;

  select state.status
    into v_status
  from public.product_price_tier_sets as state
  where state.product_sku = old.sku
  for update;

  if found and v_status = 'active' then
    if new.min_qty is distinct from old.min_qty then
      raise exception
        'retire active pricing before changing product MOQ for SKU %',
        old.sku
        using errcode = '55000';
    end if;

    if new.is_active is distinct from true then
      raise exception
        'retire active pricing before deactivating product SKU %',
        old.sku
        using errcode = '55000';
    end if;
  end if;

  return new;
end
$protect_product$;

create trigger products_protect_active_pricing
before update of min_qty, is_active on public.products
for each row
execute function public.enforce_product_pricing_lifecycle();

-- Canonical content hash for one complete SKU state. Prices are normalized to
-- four decimals and tiers are sorted before hashing.
create function public.pricing_tier_set_fingerprint(
  p_sku text,
  p_status text,
  p_tiers jsonb
)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $fingerprint$
  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.jsonb_build_object(
          'version', 1,
          'sku', p_sku,
          'status', p_status,
          'tiers', pg_catalog.coalesce(
            (
              select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_array(
                  (entry.value ->> 'tier_start_quantity')::integer,
                  pg_catalog.to_char(
                    (entry.value ->> 'unit_price_usd')::numeric,
                    'FM99999990.0000'
                  )
                )
                order by (entry.value ->> 'tier_start_quantity')::integer
              )
              from pg_catalog.jsonb_array_elements(p_tiers) as entry(value)
            ),
            '[]'::jsonb
          )
        )::text,
        'UTF8'
      )
    ),
    'hex'
  )
$fingerprint$;

create function public.replace_product_price_tier_sets(
  p_operations jsonb,
  p_source_fingerprint text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set lock_timeout = '5s'
as $replace_sets$
declare
  v_operation jsonb;
  v_tier jsonb;
  v_prepared_operation jsonb;
  v_keys text[];
  v_sku text;
  v_action text;
  v_expected_revision bigint;
  v_start bigint;
  v_previous_start bigint;
  v_price numeric;
  v_canonical_tiers jsonb;
  v_previous_tiers jsonb;
  v_prepared jsonb := '[]'::jsonb;
  v_results jsonb := '[]'::jsonb;
  v_current_revision bigint;
  v_current_status text;
  v_current_fingerprint text;
  v_current_tier_count integer;
  v_minimum_quantity integer;
  v_product_active boolean;
  v_new_status text;
  v_new_fingerprint text;
  v_change_id uuid := pg_catalog.gen_random_uuid();
  v_changed_at timestamptz := pg_catalog.statement_timestamp();
  v_reconciliation_fingerprint text;
  v_found_count integer;
  v_operation_count integer;
  v_total_tiers integer := 0;
  v_retirement_count integer := 0;
  v_requested_tiers integer;
begin
  if p_operations is null
     or pg_catalog.jsonb_typeof(p_operations) <> 'array' then
    raise exception 'operations must be a JSON array'
      using errcode = '22023';
  end if;

  v_operation_count := pg_catalog.jsonb_array_length(p_operations);
  if v_operation_count < 1 or v_operation_count > 500 then
    raise exception 'operations must contain between 1 and 500 SKU sets'
      using errcode = '22023';
  end if;

  if p_source_fingerprint is null
     or p_source_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'source fingerprint is invalid'
      using errcode = '22023';
  end if;

  if p_reason is not null
     and (
       p_reason <> pg_catalog.btrim(p_reason)
       or pg_catalog.char_length(p_reason) < 1
       or pg_catalog.char_length(p_reason) > 1000
     ) then
    raise exception 'reason is invalid'
      using errcode = '22023';
  end if;

  -- Validate the complete JSON shape before acquiring any row locks.
  for v_operation in
    select operation.value
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
  loop
    if pg_catalog.jsonb_typeof(v_operation) <> 'object' then
      raise exception 'each operation must be an object'
        using errcode = '22023';
    end if;

    select pg_catalog.array_agg(object_key.key order by object_key.key)
      into v_keys
    from pg_catalog.jsonb_object_keys(v_operation) as object_key(key);

    if v_keys is distinct from
       array['action', 'expected_revision', 'sku', 'tiers']::text[] then
      raise exception 'operation keys are invalid'
        using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(v_operation -> 'sku') <> 'string' then
      raise exception 'sku must be a string'
        using errcode = '22023';
    end if;

    v_sku := v_operation ->> 'sku';
    if v_sku = ''
       or v_sku <> pg_catalog.btrim(v_sku)
       or pg_catalog.char_length(v_sku) > 5000 then
      raise exception 'sku is invalid'
        using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(v_operation -> 'expected_revision') <> 'string'
       or (v_operation ->> 'expected_revision') !~ '^(0|[1-9][0-9]{0,15})$' then
      raise exception 'expected revision is invalid for SKU %', v_sku
        using errcode = '22023';
    end if;
    v_expected_revision := (v_operation ->> 'expected_revision')::bigint;

    if pg_catalog.jsonb_typeof(v_operation -> 'action') <> 'string' then
      raise exception 'action must be a string for SKU %', v_sku
        using errcode = '22023';
    end if;
    v_action := v_operation ->> 'action';
    if v_action not in ('replace', 'retire') then
      raise exception 'action is invalid for SKU %', v_sku
        using errcode = '22023';
    end if;

    if pg_catalog.jsonb_typeof(v_operation -> 'tiers') <> 'array' then
      raise exception 'tiers must be an array for SKU %', v_sku
        using errcode = '22023';
    end if;

    if v_action = 'replace'
       and (
         pg_catalog.jsonb_array_length(v_operation -> 'tiers') < 1
         or pg_catalog.jsonb_array_length(v_operation -> 'tiers') > 1000
       ) then
      raise exception 'replacement tier count is invalid for SKU %', v_sku
        using errcode = '22023';
    end if;

    if v_action = 'retire'
       and pg_catalog.jsonb_array_length(v_operation -> 'tiers') <> 0 then
      raise exception 'retirement tiers must be empty for SKU %', v_sku
        using errcode = '22023';
    end if;

    v_previous_start := null;
    for v_tier in
      select tier.value
      from pg_catalog.jsonb_array_elements(v_operation -> 'tiers') as tier(value)
    loop
      if pg_catalog.jsonb_typeof(v_tier) <> 'object' then
        raise exception 'each tier must be an object for SKU %', v_sku
          using errcode = '22023';
      end if;

      select pg_catalog.array_agg(object_key.key order by object_key.key)
        into v_keys
      from pg_catalog.jsonb_object_keys(v_tier) as object_key(key);

      if v_keys is distinct from
         array['tier_start_quantity', 'unit_price_usd']::text[] then
        raise exception 'tier keys are invalid for SKU %', v_sku
          using errcode = '22023';
      end if;

      if pg_catalog.jsonb_typeof(v_tier -> 'tier_start_quantity') <> 'number'
         or (v_tier ->> 'tier_start_quantity') !~ '^[1-9][0-9]{0,9}$' then
        raise exception 'tier start is invalid for SKU %', v_sku
          using errcode = '22023';
      end if;

      v_start := (v_tier ->> 'tier_start_quantity')::bigint;
      if v_start > 2147483647 then
        raise exception 'tier start exceeds the database limit for SKU %', v_sku
          using errcode = '22023';
      end if;

      if v_previous_start is not null and v_start <= v_previous_start then
        raise exception 'tier starts are not strictly increasing for SKU %', v_sku
          using errcode = '22023';
      end if;
      v_previous_start := v_start;

      if pg_catalog.jsonb_typeof(v_tier -> 'unit_price_usd') <> 'string'
         or (v_tier ->> 'unit_price_usd')
            !~ '^(0|[1-9][0-9]{0,7})[.][0-9]{4}$' then
        raise exception 'unit price is invalid for SKU %', v_sku
          using errcode = '22023';
      end if;

      v_price := (v_tier ->> 'unit_price_usd')::numeric;
      if v_price <= 0
         or v_price >= 100000000
         or v_price <> pg_catalog.trunc(v_price, 4) then
        raise exception 'unit price is outside the approved range for SKU %', v_sku
          using errcode = '22023';
      end if;
    end loop;
  end loop;

  select pg_catalog.count(*)
    into v_found_count
  from (
    select distinct operation.value ->> 'sku' as sku
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
  ) as distinct_operations;

  if v_found_count <> v_operation_count then
    raise exception 'each SKU may appear only once per operation batch'
      using errcode = '22023';
  end if;

  select pg_catalog.coalesce(
    pg_catalog.sum(
      pg_catalog.jsonb_array_length(operation.value -> 'tiers')
    ),
    0
  )::integer
    into v_requested_tiers
  from pg_catalog.jsonb_array_elements(p_operations) as operation(value);

  if v_requested_tiers > 10000 then
    raise exception 'operations exceed the 10,000-tier atomic limit'
      using errcode = '22023';
  end if;

  -- Product rows exist even for the first price write, so locking every one in
  -- deterministic C order closes the absent-state concurrency race.
  perform product.sku
  from public.products as product
  where product.sku in (
    select operation.value ->> 'sku'
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
  )
  order by product.sku collate "C"
  for update;

  get diagnostics v_found_count = row_count;
  if v_found_count <> v_operation_count then
    raise exception 'one or more pricing SKUs do not exist'
      using errcode = '22023';
  end if;

  perform state.product_sku
  from public.product_price_tier_sets as state
  where state.product_sku in (
    select operation.value ->> 'sku'
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
  )
  order by state.product_sku collate "C"
  for update;

  perform tier.product_sku
  from public.product_price_tiers as tier
  where tier.product_sku in (
    select operation.value ->> 'sku'
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
  )
  order by tier.product_sku collate "C", tier.tier_start_quantity
  for update;

  -- Rebuild canonical operations, validate current state/revisions, and stage
  -- every before/after snapshot. No persistent write occurs in this loop.
  for v_operation in
    select operation.value
    from pg_catalog.jsonb_array_elements(p_operations) as operation(value)
    order by (operation.value ->> 'sku') collate "C"
  loop
    v_sku := v_operation ->> 'sku';
    v_action := v_operation ->> 'action';
    v_expected_revision := (v_operation ->> 'expected_revision')::bigint;

    select product.min_qty, product.is_active
      into v_minimum_quantity, v_product_active
    from public.products as product
    where product.sku = v_sku;

    if v_action = 'replace'
       and v_product_active is distinct from true then
      raise exception 'pricing SKU is not active: %', v_sku
        using errcode = '22023';
    end if;

    v_canonical_tiers := '[]'::jsonb;
    for v_tier in
      select tier.value
      from pg_catalog.jsonb_array_elements(v_operation -> 'tiers') as tier(value)
    loop
      v_canonical_tiers := v_canonical_tiers ||
        pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'tier_start_quantity',
            (v_tier ->> 'tier_start_quantity')::integer,
            'unit_price_usd',
            pg_catalog.to_char(
              (v_tier ->> 'unit_price_usd')::numeric,
              'FM99999990.0000'
            )
          )
        );
    end loop;

    if v_action = 'replace'
       and (v_canonical_tiers -> 0 ->> 'tier_start_quantity')::integer
           <> v_minimum_quantity then
      raise exception 'first tier must equal the current MOQ for SKU %', v_sku
        using errcode = '22023';
    end if;

    v_current_revision := null;
    v_current_status := null;
    v_current_fingerprint := null;
    v_current_tier_count := null;

    select
      state.revision,
      state.status,
      state.fingerprint,
      state.tier_count
      into
        v_current_revision,
        v_current_status,
        v_current_fingerprint,
        v_current_tier_count
    from public.product_price_tier_sets as state
    where state.product_sku = v_sku;

    if not found then
      v_current_revision := 0;
      v_current_status := null;
      v_current_fingerprint := null;
      v_current_tier_count := 0;
    end if;

    select pg_catalog.coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'tier_start_quantity', tier.tier_start_quantity,
          'unit_price_usd',
          pg_catalog.to_char(tier.unit_price_usd, 'FM99999990.0000')
        )
        order by tier.tier_start_quantity
      ),
      '[]'::jsonb
    )
      into v_previous_tiers
    from public.product_price_tiers as tier
    where tier.product_sku = v_sku;

    if v_current_revision = 0 then
      if pg_catalog.jsonb_array_length(v_previous_tiers) <> 0 then
        raise exception 'pricing state is missing for existing tiers on SKU %', v_sku
          using errcode = '55000';
      end if;
    else
      if v_current_tier_count <> pg_catalog.jsonb_array_length(v_previous_tiers) then
        raise exception 'pricing tier count drift detected for SKU %', v_sku
          using errcode = '55000';
      end if;

      if v_current_fingerprint <>
         public.pricing_tier_set_fingerprint(
           v_sku,
           v_current_status,
           v_previous_tiers
         ) then
        raise exception 'pricing fingerprint drift detected for SKU %', v_sku
          using errcode = '55000';
      end if;

      if v_current_status = 'retired'
         and pg_catalog.jsonb_array_length(v_previous_tiers) <> 0 then
        raise exception 'retired SKU still has tiers: %', v_sku
          using errcode = '55000';
      end if;
    end if;

    if v_expected_revision <> v_current_revision then
      raise exception 'stale pricing revision for SKU %', v_sku
        using
          errcode = '40001',
          detail = pg_catalog.format(
            'expected=%s current=%s',
            v_expected_revision,
            v_current_revision
          );
    end if;

    if v_action = 'retire'
       and (v_current_revision = 0 or v_current_status <> 'active') then
      raise exception 'only an active pricing set can be retired for SKU %', v_sku
        using errcode = '22023';
    end if;

    v_new_status := case when v_action = 'replace' then 'active' else 'retired' end;
    v_new_fingerprint := public.pricing_tier_set_fingerprint(
      v_sku,
      v_new_status,
      v_canonical_tiers
    );

    if v_action = 'replace'
       and v_current_status = 'active'
       and v_current_fingerprint = v_new_fingerprint then
      raise exception 'replacement is identical for SKU %', v_sku
        using errcode = '22023';
    end if;

    v_prepared := v_prepared ||
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'sku', v_sku,
          'action', v_action,
          'previous_revision', v_current_revision,
          'previous_status', v_current_status,
          'previous_fingerprint', v_current_fingerprint,
          'previous_tier_count', v_current_tier_count,
          'previous_tiers', v_previous_tiers,
          'status', v_new_status,
          'fingerprint', v_new_fingerprint,
          'tiers', v_canonical_tiers
        )
      );
  end loop;

  -- The whole batch is now known-valid and every current revision was checked.
  -- Any later exception rolls this single RPC statement back atomically.
  for v_prepared_operation in
    select operation.value
    from pg_catalog.jsonb_array_elements(v_prepared) as operation(value)
    order by (operation.value ->> 'sku') collate "C"
  loop
    v_sku := v_prepared_operation ->> 'sku';
    v_action := v_prepared_operation ->> 'action';
    v_current_revision :=
      (v_prepared_operation ->> 'previous_revision')::bigint;
    v_new_status := v_prepared_operation ->> 'status';
    v_new_fingerprint := v_prepared_operation ->> 'fingerprint';
    v_canonical_tiers := v_prepared_operation -> 'tiers';
    v_previous_tiers := v_prepared_operation -> 'previous_tiers';

    delete from public.product_price_tiers
    where product_sku = v_sku;

    if v_action = 'replace' then
      insert into public.product_price_tiers (
        product_sku,
        tier_start_quantity,
        unit_price_usd
      )
      select
        v_sku,
        (tier.value ->> 'tier_start_quantity')::integer,
        (tier.value ->> 'unit_price_usd')::numeric
      from pg_catalog.jsonb_array_elements(v_canonical_tiers) as tier(value);

      v_total_tiers :=
        v_total_tiers + pg_catalog.jsonb_array_length(v_canonical_tiers);
    else
      v_retirement_count := v_retirement_count + 1;
    end if;

    insert into public.product_price_tier_sets (
      product_sku,
      revision,
      status,
      fingerprint,
      tier_count,
      created_at,
      updated_at,
      retired_at,
      last_change_id,
      last_changed_by
    )
    values (
      v_sku,
      v_current_revision + 1,
      v_new_status,
      v_new_fingerprint,
      pg_catalog.jsonb_array_length(v_canonical_tiers),
      v_changed_at,
      v_changed_at,
      case when v_new_status = 'retired' then v_changed_at else null end,
      v_change_id,
      'Authenticated admin channel'
    )
    on conflict (product_sku) do update
    set
      revision = excluded.revision,
      status = excluded.status,
      fingerprint = excluded.fingerprint,
      tier_count = excluded.tier_count,
      updated_at = excluded.updated_at,
      retired_at = excluded.retired_at,
      last_change_id = excluded.last_change_id,
      last_changed_by = excluded.last_changed_by;

    insert into public.product_price_tier_audit (
      change_id,
      product_sku,
      action,
      previous_revision,
      revision,
      previous_status,
      status,
      previous_fingerprint,
      fingerprint,
      previous_tier_count,
      tier_count,
      previous_tiers,
      tiers,
      source_fingerprint,
      actor,
      reason,
      changed_at
    )
    values (
      v_change_id,
      v_sku,
      v_action,
      v_current_revision,
      v_current_revision + 1,
      v_prepared_operation ->> 'previous_status',
      v_new_status,
      v_prepared_operation ->> 'previous_fingerprint',
      v_new_fingerprint,
      (v_prepared_operation ->> 'previous_tier_count')::integer,
      pg_catalog.jsonb_array_length(v_canonical_tiers),
      v_previous_tiers,
      v_canonical_tiers,
      p_source_fingerprint,
      'Authenticated admin channel',
      p_reason,
      v_changed_at
    );

    v_results := v_results ||
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object(
          'sku', v_sku,
          'action', v_action,
          'revision', (v_current_revision + 1)::text,
          'status', v_new_status,
          'fingerprint', v_new_fingerprint,
          'tier_count', pg_catalog.jsonb_array_length(v_canonical_tiers)
        )
      );
  end loop;

  select pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(
        pg_catalog.coalesce(
          pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_array(
              state.product_sku,
              state.status,
              state.fingerprint
            )
            order by state.product_sku collate "C"
          ),
          '[]'::jsonb
        )::text,
        'UTF8'
      )
    ),
    'hex'
  )
    into v_reconciliation_fingerprint
  from public.product_price_tier_sets as state;

  return pg_catalog.jsonb_build_object(
    'change_id', v_change_id,
    'changed_at', v_changed_at,
    'sku_count', v_operation_count,
    'tier_count', v_total_tiers,
    'retirement_count', v_retirement_count,
    'reconciliation_fingerprint', v_reconciliation_fingerprint,
    'results', v_results
  );
end
$replace_sets$;

-- One service-role-only scalar RPC returns the editable catalogue, tiers,
-- revision state, integrity evidence, audit tail and release flag from the
-- invoking statement's single database snapshot. This avoids row-cap
-- truncation and torn reads across otherwise independent REST requests.
create function public.load_pricing_admin_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $snapshot$
  select pg_catalog.jsonb_build_object(
    'schema_version', 1,
    'products', pg_catalog.coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'sku', product.sku,
            'name', product.name,
            'min_qty', product.min_qty,
            'is_active', product.is_active
          )
          order by product.sku collate "C"
        )
        from public.products as product
        where product.is_active = true
           or exists (
             select 1
             from public.product_price_tier_sets as state
             where state.product_sku = product.sku
           )
      ),
      '[]'::jsonb
    ),
    'tiers', pg_catalog.coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'product_sku', tier.product_sku,
            'tier_start_quantity', tier.tier_start_quantity,
            'unit_price_usd',
            pg_catalog.to_char(tier.unit_price_usd, 'FM99999990.0000')
          )
          order by
            tier.product_sku collate "C",
            tier.tier_start_quantity
        )
        from public.product_price_tiers as tier
      ),
      '[]'::jsonb
    ),
    'states', pg_catalog.coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'product_sku', state.product_sku,
            'revision', state.revision::text,
            'status', state.status,
            'fingerprint', state.fingerprint,
            'tier_count', state.tier_count,
            'actual_tier_count', (
              select pg_catalog.count(*)
              from public.product_price_tiers as counted_tier
              where counted_tier.product_sku = state.product_sku
            ),
            'computed_fingerprint',
            public.pricing_tier_set_fingerprint(
              state.product_sku,
              state.status,
              pg_catalog.coalesce(
                (
                  select pg_catalog.jsonb_agg(
                    pg_catalog.jsonb_build_object(
                      'tier_start_quantity',
                      hashed_tier.tier_start_quantity,
                      'unit_price_usd',
                      pg_catalog.to_char(
                        hashed_tier.unit_price_usd,
                        'FM99999990.0000'
                      )
                    )
                    order by hashed_tier.tier_start_quantity
                  )
                  from public.product_price_tiers as hashed_tier
                  where hashed_tier.product_sku = state.product_sku
                ),
                '[]'::jsonb
              )
            ),
            'updated_at', state.updated_at
          )
          order by state.product_sku collate "C"
        )
        from public.product_price_tier_sets as state
      ),
      '[]'::jsonb
    ),
    'audit', pg_catalog.coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.to_jsonb(recent)
          order by recent.changed_at desc, recent.id desc
        )
        from (
          select
            audit.id,
            audit.change_id,
            audit.product_sku,
            audit.action,
            audit.previous_revision::text as previous_revision,
            audit.revision::text as revision,
            audit.previous_tier_count,
            audit.tier_count,
            audit.actor,
            audit.reason,
            audit.source_fingerprint,
            audit.changed_at
          from public.product_price_tier_audit as audit
          order by audit.changed_at desc, audit.id desc
          limit 50
        ) as recent
      ),
      '[]'::jsonb
    ),
    'pricing_enabled', pg_catalog.coalesce(
      (
        select flag.enabled
        from public.feature_flags as flag
        where flag.key = 'tiered_pricing'
      ),
      false
    )
  )
$snapshot$;

-- New objects expose no browser-role surface and have no RLS policies.
revoke all privileges on table public.product_price_tier_sets
  from public, anon, authenticated, service_role;

revoke all privileges on table public.product_price_tier_audit
  from public, anon, authenticated, service_role;

-- Stage 1 temporarily granted direct tier CRUD to the trusted service role.
-- Stage 2 replaces that surface with the audited RPC and read-only inspection.
revoke insert, update, delete
  on table public.product_price_tiers
  from service_role;

grant usage on schema public to service_role;
grant select on table public.product_price_tiers to service_role;
grant select on table public.product_price_tier_sets to service_role;
grant select on table public.product_price_tier_audit to service_role;

revoke all
  on function public.enforce_product_pricing_lifecycle()
  from public, anon, authenticated, service_role;

revoke all
  on function public.load_pricing_admin_snapshot()
  from public, anon, authenticated, service_role;

grant execute
  on function public.load_pricing_admin_snapshot()
  to service_role;

revoke all
  on function public.pricing_tier_set_fingerprint(text, text, jsonb)
  from public, anon, authenticated, service_role;

grant execute
  on function public.pricing_tier_set_fingerprint(text, text, jsonb)
  to service_role;

revoke all
  on function public.replace_product_price_tier_sets(jsonb, text, text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.replace_product_price_tier_sets(jsonb, text, text)
  to service_role;

-- Reassert the inactive, empty boundary at migration completion.
update public.feature_flags
set enabled = false
where key = 'tiered_pricing';

do $stage_2_postconditions$
begin
  if exists (select 1 from public.product_price_tiers)
     or exists (select 1 from public.product_price_tier_sets)
     or exists (select 1 from public.product_price_tier_audit) then
    raise exception '0013 must finish without pricing data'
      using errcode = '55000';
  end if;

  if (
    select pg_catalog.count(*)
    from public.feature_flags
    where key = 'tiered_pricing'
      and enabled = false
  ) <> 1 then
    raise exception '0013 must finish with exactly one inactive pricing flag'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as proc
    join pg_catalog.pg_roles as owner
      on owner.oid = proc.proowner
    where proc.oid in (
      'public.replace_product_price_tier_sets(jsonb,text,text)'::pg_catalog.regprocedure,
      'public.load_pricing_admin_snapshot()'::pg_catalog.regprocedure,
      'public.enforce_product_pricing_lifecycle()'::pg_catalog.regprocedure
    )
      and not (owner.rolsuper or owner.rolbypassrls)
  ) then
    raise exception '0013 SECURITY DEFINER owner must bypass forced RLS'
      using errcode = '55000';
  end if;
end
$stage_2_postconditions$;

commit;
