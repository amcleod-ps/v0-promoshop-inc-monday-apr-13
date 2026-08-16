-- 0016 — trigger-function security hardening
--
-- Apply AFTER 0015_public_pricing_start_quantity.sql.
--
-- Supabase grants EXECUTE on new public-schema functions to its API roles.
-- Trigger functions do not need a direct RPC surface: PostgreSQL invokes them
-- through their installed triggers. Remove those direct grants and pin a
-- fixed empty search path so later schema objects cannot change name
-- resolution inside a trigger.

begin;

do $trigger_hardening_prerequisites$
begin
  if to_regprocedure('public.set_updated_at()') is null
     or to_regprocedure('public.assign_sort_order()') is null
     or to_regprocedure('public.force_quote_request_insert_defaults()') is null then
    raise exception '0016 requires trigger functions from migrations 0001, 0006 and 0011'
      using errcode = '55000';
  end if;
end
$trigger_hardening_prerequisites$;

alter function public.set_updated_at()
  set search_path = '';

alter function public.assign_sort_order()
  set search_path = '';

alter function public.force_quote_request_insert_defaults()
  set search_path = '';

revoke all
  on function public.set_updated_at()
  from public, anon, authenticated, service_role;

revoke all
  on function public.assign_sort_order()
  from public, anon, authenticated, service_role;

revoke all
  on function public.force_quote_request_insert_defaults()
  from public, anon, authenticated, service_role;

do $trigger_hardening_postconditions$
begin
  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'set_updated_at',
        'assign_sort_order',
        'force_quote_request_insert_defaults'
      )
      and not coalesce(
        procedure.proconfig @> array['search_path=""']::text[],
        false
      )
  ) then
    raise exception '0016 must pin an empty search path on every protected trigger function'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from (
      values
        ('anon'),
        ('authenticated'),
        ('service_role')
    ) as role_name(value)
    cross join (
      values
        ('public.set_updated_at()'::regprocedure),
        ('public.assign_sort_order()'::regprocedure),
        ('public.force_quote_request_insert_defaults()'::regprocedure)
    ) as protected_function(oid)
    where has_function_privilege(
      role_name.value::name,
      protected_function.oid,
      'EXECUTE'
    )
  ) then
    raise exception '0016 must remove direct trigger-function execution from API roles'
      using errcode = '55000';
  end if;
end
$trigger_hardening_postconditions$;

commit;
