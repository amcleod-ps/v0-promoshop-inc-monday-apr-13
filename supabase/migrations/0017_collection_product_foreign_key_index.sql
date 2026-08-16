-- 0017 — collection-product foreign-key index
--
-- Apply AFTER 0016_trigger_function_security_hardening.sql.
--
-- The collection_products primary key starts with collection_id, so it covers
-- that foreign key but not product_sku. Add the missing product-side index so
-- product updates and deletes do not need a full membership-table scan.

begin;

do $collection_product_index_prerequisites$
begin
  if to_regclass('public.collection_products') is null then
    raise exception '0017 requires collection_products from migration 0010'
      using errcode = '55000';
  end if;
end
$collection_product_index_prerequisites$;

create index if not exists collection_products_product_sku_idx
  on public.collection_products (product_sku);

do $collection_product_index_postconditions$
begin
  if not exists (
    select 1
    from pg_index as index_row
    join pg_class as index_class
      on index_class.oid = index_row.indexrelid
    join pg_class as table_class
      on table_class.oid = index_row.indrelid
    join pg_namespace as namespace
      on namespace.oid = table_class.relnamespace
    where namespace.nspname = 'public'
      and table_class.relname = 'collection_products'
      and index_class.relname = 'collection_products_product_sku_idx'
      and index_row.indisvalid
      and index_row.indisready
      and not index_row.indisunique
      and index_row.indpred is null
      and index_row.indexprs is null
      and index_row.indnkeyatts = 1
      and index_row.indnatts = 1
      and pg_get_indexdef(index_row.indexrelid, 1, true) = 'product_sku'
  ) then
    raise exception '0017 must create a ready, valid product_sku index'
      using errcode = '55000';
  end if;
end
$collection_product_index_postconditions$;

commit;
