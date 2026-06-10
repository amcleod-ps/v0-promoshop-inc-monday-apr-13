> **HISTORICAL DRAFT.** The admin dashboard has since shipped
> (`/admin-dashboard`); see `README.md` for current editing workflows.

# Draft reply — CMS / admin dashboard question

> Abigail asked: *"Can homepage copy and 'Meet the Team' data (names, titles,
> images) be edited via the new admin dashboard?"*

## Draft answer

Yes. The plan for the admin dashboard is that you'll be able to edit:

- **Home page hero copy** (headline, supporting paragraphs, CTA labels)
- **Home slideshow images** (upload / reorder / alt text)
- **Meet Our Team** (add / remove / reorder team members, change names, roles,
  descriptions, and photos) — the same data powers the team sections on both
  Home and About, so one edit updates both pages
- **Brand logo scroll** (add / remove brands, swap logos)
- **About page copy** (heading, body paragraphs, storefront photo)
- **Products** (names, SKUs, colours, sizes, minimums, descriptions, filter
  tags) — the same data that drives the Studio filters today
- **Site locale toggle contact info** (Windsor / Toronto / Detroit phone and
  address details surfaced to visitors)

## What changed in this pass

Ahead of the admin UI itself, I've consolidated all of that content into a
single data layer under `lib/cms/*.ts` on the staging QA branch. That means:

- When the admin dashboard lands, it writes to one place; no scattered copies
  to hunt down.
- The Home and About pages already pull `TEAM_MEMBERS` from `lib/cms/team.ts`,
  so we won't see the two pages drift apart again.
- Products stay in `lib/products.ts` for now (already structured); the admin
  UI will edit that file (or a companion DB table backed by it).

The admin UI itself (auth + routes + persistence) is the next milestone after
we land the staging QA fixes you requested.
