-- PromoShop Inc. — atomic sort_order assignment for dashboard inserts
--
-- Apply this AFTER 0005_team_and_theme.sql.
--
-- The admin dashboard previously assigned sort_order by reading the current
-- max and inserting max+1 in a second round trip, which races under
-- concurrent inserts (two rows can claim the same position). This migration
-- moves the assignment into a BEFORE INSERT trigger that runs only when the
-- inserted sort_order is NULL, serialised by a transaction-scoped advisory
-- lock so concurrent inserts queue instead of double-assigning.
--
-- Explicit sort_order values (e.g. the 0003 seed migration) are untouched:
-- the trigger only fills NULLs.

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
      hashtext(tg_table_schema || '.' || tg_table_name || ':' || coalesce(scope_val, '')));
    -- ::text comparison keeps this generic across text and uuid scope
    -- columns; these tables are small enough that the cast is harmless.
    execute format(
      'select coalesce(max(sort_order), -1) + 1 from %I.%I where %I::text = $1',
      tg_table_schema, tg_table_name, scope_col)
      into next_val
      using scope_val;
  end if;

  new.sort_order := next_val;
  return new;
end
$$;

-- Table-wide ordering -------------------------------------------------------
drop trigger if exists brands_assign_sort_order on public.brands;
create trigger brands_assign_sort_order
  before insert on public.brands
  for each row execute function public.assign_sort_order('');

drop trigger if exists products_assign_sort_order on public.products;
create trigger products_assign_sort_order
  before insert on public.products
  for each row execute function public.assign_sort_order('');

drop trigger if exists hero_slides_assign_sort_order on public.hero_slides;
create trigger hero_slides_assign_sort_order
  before insert on public.hero_slides
  for each row execute function public.assign_sort_order('');

drop trigger if exists team_members_assign_sort_order on public.team_members;
create trigger team_members_assign_sort_order
  before insert on public.team_members
  for each row execute function public.assign_sort_order('');

-- Scoped ordering ------------------------------------------------------------
drop trigger if exists product_colours_assign_sort_order on public.product_colours;
create trigger product_colours_assign_sort_order
  before insert on public.product_colours
  for each row execute function public.assign_sort_order('product_sku');

drop trigger if exists product_images_assign_sort_order on public.product_images;
create trigger product_images_assign_sort_order
  before insert on public.product_images
  for each row execute function public.assign_sort_order('colour_id');
