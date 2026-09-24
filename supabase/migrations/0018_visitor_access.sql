-- Server-only configuration for temporary visitor access. No credential in source.
create table public.visitor_access (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.visitor_access enable row level security;
revoke all on public.visitor_access from public, anon, authenticated;
grant select, insert, update, delete on public.visitor_access to service_role;
