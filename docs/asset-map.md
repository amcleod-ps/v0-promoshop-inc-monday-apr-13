> **STALE (kept for history).** Assets now live in `public/images/` and
> Supabase Storage; the raw.githubusercontent.com pipeline described
> below no longer exists.

# Asset map — claude/update-carousel-images-L7n5N

This branch stacks on top of `claude/promoshop-staging-qa-HsyTJ` (see PR #2)
and resolves the carousel / logo / storefront / about-copy items from that
PR's asset map.

## Code → asset status

| Code reference | Status | Source |
| --- | --- | --- |
| Home hero logo | ✅ wired to `VicRobNes/mainmemory/Promoshop logo (2).png` | Abigail's Apr 13 email thread |
| Home slideshow (4 slides) | ✅ wired to `mainmemory/1.png`…`4.png` via raw.githubusercontent.com | Abigail's updated set |
| About hero storefront | ✅ wired to `mainmemory/11.png` — **needs visual confirmation** | Abigail's Apr 13 email ("last image is outside of our building") |
| About body copy | ✅ replaced with verbatim "Promoshop Canada Ltd. is a Top 40…" paragraph | Abigail's Apr 14 email |
| `/brands/*.svg` (brand logo scroll) | ⚠️ still flagged — PNG/SVG files not yet extracted from `rephotosforpromoshop.zip` | PR #2 |

`next.config.mjs` was updated with a `raw.githubusercontent.com/VicRobNes/mainmemory/**`
remote pattern so `next/image` can render the slideshow, logo, and storefront
without having to commit binaries into `public/` on this repo.

## Outstanding questions for the Apr 15 12:30 PM review call

1. **Slideshow ordering.** I mapped `mainmemory/1.png`…`4.png` to slides 1–4
   in the order they appear in the mainmemory listing. If Abigail meant a
   different subset (e.g. the most-recently-added files), re-order `slideshow`
   in `lib/cms/home.ts`.
2. **Storefront photo.** I picked `mainmemory/11.png` as the most likely
   "outside the building" shot from the 1.png…11.png set. If a different file
   is the correct storefront, update `hero.image` in `lib/cms/about.ts`.
3. **Brand scroll logos.** Still outstanding — PNG/SVG assets need to be
   extracted from `rephotosforpromoshop.zip` (or shipped from the design team)
   and dropped into `public/brands/`. The scroll already renders a text
   fallback if the files are missing, so the preview is safe in the meantime.

## How to swap an image

All three paths live in `lib/cms/*.ts` and are a single string edit each.
Once the admin dashboard ships, these become rows in the CMS that Abigail
can edit without a code change.
