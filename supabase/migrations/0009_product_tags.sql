-- 0009 — product filter tags (US/Canada toggle + forgiving filter tags)
--
-- Apply AFTER 0008, by hand, in the Supabase SQL Editor (same as every other
-- migration in this repo).
--
-- Adds a normalized text[] tag column to products. Tags are the team-managed
-- filter labels behind Priority 3: the US/Canada toggle soft-prioritizes
-- products whose tags include the active region ("canada" / "usa"), and the
-- Studio exposes every distinct tag as a filter. Values are written canonical
-- (lowercase, trimmed, single-spaced) by the dashboard and re-normalized on
-- read (lib/tags.ts), so Table-Editor edits can't create messy duplicates.
--
-- Idempotent and reseed-safe: the column defaults to an empty array, so the
-- existing products INSERT in 0003 (which doesn't mention tags) keeps working,
-- and re-running this migration is a no-op.

begin;

alter table products
  add column if not exists tags text[] not null default '{}';

-- GIN index for tag-membership filters as the catalog grows (L8).
create index if not exists products_tags_idx on products using gin (tags);

commit;
