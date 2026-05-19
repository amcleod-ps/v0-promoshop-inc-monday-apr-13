-- PromoShop Inc. — editable text content registry
--
-- Apply this AFTER 0001_init.sql, 0002_images_and_products.sql, and
-- 0003_seed_data.sql. Adds the `site_content` table: a keyed string store
-- backing the /admin-dashboard text editor. Every editable headline,
-- paragraph, label, eyebrow, and call-to-action on the public site
-- resolves through this table with a hard-coded fallback baked into the
-- React components.
--
-- The structure mirrors `site_images`:
--   * `key`         — stable identifier referenced from code
--                     (e.g., "home.hero.body.1", "about.hero.heading")
--   * `label`       — human-readable description so the dashboard can list
--                     each key without the maintainer needing to read code
--   * `value`       — the text shown on the public site
--   * `updated_at`  — bumped on every save so consumers can cache-bust
--                     (today we just render the latest value)
--
-- Public anon read; writes restricted to the service-role key used by the
-- admin dashboard.

create table if not exists public.site_content (
  key        text primary key,
  label      text not null,
  value      text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

alter table public.site_content enable row level security;

drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read"
  on public.site_content
  for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Seed defaults. Idempotent — running this migration more than once is safe
-- and will refresh the labels/values without duplicating rows.
-- ---------------------------------------------------------------------------
insert into public.site_content (key, label, value) values
  ('home.hero.body.1',
   'Home hero — main headline (line 1)',
   'PREMIUM MERCH FOR PREMIUM BRANDS'),
  ('home.hero.cta.primary',
   'Home hero — primary CTA button label',
   'Browse Our Brands'),
  ('home.hero.cta.secondary',
   'Home hero — secondary CTA button label',
   'View All Products'),

  ('about.hero.eyebrow',
   'About page — small eyebrow above heading',
   'About Us'),
  ('about.hero.heading',
   'About page — main heading',
   'MEET PROMOSHOP'),
  ('about.hero.body.1',
   'About page — paragraph 1',
   'Promoshop Canada Ltd. is a Top 40 Promotional Merchandise Company in North America, with corporate head offices in Windsor, Ontario and Los Angeles, California. With more than 28 years in business and over $70 million in annual revenue, Promoshop ranks in the Top 1% of promotional merchandise companies across North America.'),
  ('about.hero.body.2',
   'About page — paragraph 2',
   'We partner with some of the most recognizable global brands to create Memorable Merchandise Experiences. Through our extensive vendor network and access to premium retail brands, we help High-Level Organizations deliver merchandise that stands out and stands the test of time.'),
  ('about.hero.body.3',
   'About page — paragraph 3',
   'Whether supporting a national rollout, a luxury gifting initiative, or a curated company apparel program. Our team manages every detail from concept to completion.'),

  ('team.section.heading',
   'Team section — heading',
   'Meet Our Team'),
  ('team.section.subheading',
   'Team section — subheading',
   'These industry experts will ensure your promotions shine.'),

  ('team.phil-duym.name',
   'Team member — Phil Duym — name',
   'Phil Duym'),
  ('team.phil-duym.role',
   'Team member — Phil Duym — role',
   'Owner & President'),
  ('team.phil-duym.description',
   'Team member — Phil Duym — description',
   'Leading PromoShop''s vision for premium branded merchandise.'),

  ('team.amy-duquette.name',
   'Team member — Amy Duquette — name',
   'Amy Duquette'),
  ('team.amy-duquette.role',
   'Team member — Amy Duquette — role',
   'Account Executive'),
  ('team.amy-duquette.description',
   'Team member — Amy Duquette — description',
   'Dedicated to delivering exceptional client experiences.'),

  ('team.ania-wlodarkiewicz.name',
   'Team member — Ania Wlodarkiewicz — name',
   'Ania Wlodarkiewicz'),
  ('team.ania-wlodarkiewicz.role',
   'Team member — Ania Wlodarkiewicz — role',
   'Account Executive'),
  ('team.ania-wlodarkiewicz.description',
   'Team member — Ania Wlodarkiewicz — description',
   'Helping brands find the perfect promotional products.'),

  ('team.alex-cyrenne.name',
   'Team member — Alex Cyrenne — name',
   'Alex Cyrenne'),
  ('team.alex-cyrenne.role',
   'Team member — Alex Cyrenne — role',
   'Account Executive'),
  ('team.alex-cyrenne.description',
   'Team member — Alex Cyrenne — description',
   'Building lasting partnerships with our clients.'),

  ('contact.section.heading',
   'Contact section — heading',
   'Contact Us'),
  ('contact.section.subheading',
   'Contact section — subheading',
   'Have questions? Need a custom quote? Our team is here to help bring your vision to life.'),
  ('contact.section.email',
   'Contact section — display email address',
   'info@promoshopinc.com'),

  ('brands.page.eyebrow',
   'Brands page — eyebrow',
   'Our Partners'),
  ('brands.page.heading',
   'Brands page — heading',
   'Meet Our Brands'),
  ('brands.page.body',
   'Brands page — intro paragraph',
   'We partner with the world''s best brands to bring you quality promotional products that represent your company with pride.'),
  ('brands.cta.heading',
   'Brands page — CTA heading',
   'Looking for a Specific Brand?'),
  ('brands.cta.body',
   'Brands page — CTA body',
   'We work with hundreds of brands. If you don''t see what you''re looking for, reach out and we''ll source it for you.'),

  ('footer.tagline',
   'Footer — tagline paragraph',
   'Welcome to our store, where promoting your business is our business. Born from an expertise in building brands, we offer unique, quality promotional products.'),
  ('footer.newsletter.heading',
   'Footer — newsletter heading',
   'Stay in the Loop'),
  ('footer.ada',
   'Footer — ADA compliance notice',
   'We understand the importance of accessibility for all visitors to our website and it is something we take seriously. We are working on bringing this website in-line with WCAG 2.1 A, AA standards to ensure we provide an experience that is accessible to all. Your patience is appreciated as we work through these changes.')
on conflict (key) do update set
  label = excluded.label;
-- NOTE: deliberately do NOT update `value` on conflict so the admin's
-- edits aren't overwritten by re-running the migration.
