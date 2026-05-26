-- PromoShop Inc. — team roster table and editable theme palette
--
-- Apply this AFTER 0004_site_content.sql. Adds:
--   * team_members  — replaces the hard-coded lib/cms/team.ts roster so the
--                     admin can add / edit / remove people. The original
--                     four members are seeded so the public site renders
--                     identically before any dashboard edits.
--   * site_theme    — keyed colour palette. The admin dashboard exposes
--                     these as colour pickers; a runtime <style> tag in
--                     the root layout maps each key to its current value
--                     across every Tailwind utility that hard-codes the
--                     same hex.
--
-- Both tables follow the same idempotent / RLS-public-read pattern as
-- site_images and site_content.

-- ---------------------------------------------------------------------------
-- team_members
-- ---------------------------------------------------------------------------
create table if not exists public.team_members (
  slug        text primary key,
  name        text not null,
  role        text not null,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists team_members_active_sort_idx
  on public.team_members (is_active, sort_order);

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row execute function public.set_updated_at();

alter table public.team_members enable row level security;

drop policy if exists "team_members_public_read_active" on public.team_members;
create policy "team_members_public_read_active"
  on public.team_members
  for select
  to anon, authenticated
  using (is_active = true);

insert into public.team_members (slug, name, role, description, image_url, sort_order)
values
  ('phil-duym',
   'Phil Duym',
   'Owner & President',
   'Leading PromoShop''s vision for premium branded merchandise.',
   '/placeholder-user.jpg',
   0),
  ('amy-duquette',
   'Amy Duquette',
   'Account Executive',
   'Dedicated to delivering exceptional client experiences.',
   '/placeholder-user.jpg',
   1),
  ('ania-wlodarkiewicz',
   'Ania Wlodarkiewicz',
   'Account Executive',
   'Helping brands find the perfect promotional products.',
   '/placeholder-user.jpg',
   2),
  ('alex-cyrenne',
   'Alex Cyrenne',
   'Account Executive',
   'Building lasting partnerships with our clients.',
   '/placeholder-user.jpg',
   3)
on conflict (slug) do update set
  -- Refresh role/description labels on re-run but do NOT overwrite the
  -- name in case the admin has already personalised it.
  role = excluded.role,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- site_theme
-- ---------------------------------------------------------------------------
create table if not exists public.site_theme (
  key        text primary key,
  label      text not null,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_theme_set_updated_at on public.site_theme;
create trigger site_theme_set_updated_at
  before update on public.site_theme
  for each row execute function public.set_updated_at();

alter table public.site_theme enable row level security;

drop policy if exists "site_theme_public_read" on public.site_theme;
create policy "site_theme_public_read"
  on public.site_theme
  for select
  to anon, authenticated
  using (true);

-- Seed the four colours that appear most frequently on the public site.
-- The runtime CSS override (see lib/supabase/theme.ts) targets these by
-- their original hex so every Tailwind utility class that bakes in the
-- same hex switches in lockstep when the admin saves a new value.
insert into public.site_theme (key, label, value) values
  ('brand.primary',
   'Brand accent (red) — CTAs, eyebrows, hover states',
   '#ef473f'),
  ('brand.dark',
   'Dark background — homepage, header utility bar',
   '#111111'),
  ('brand.slate',
   'Slate — header utility bar / muted UI',
   '#373a36'),
  ('brand.accent',
   'Soft accent (sky blue) — footer separator',
   '#bde7ff')
on conflict (key) do update set
  label = excluded.label;
-- NOTE: do not update value on conflict so admin edits survive re-runs.
