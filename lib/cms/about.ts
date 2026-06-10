// About page content — static fallback; the live values come from the
// site_content table (editable in /admin-dashboard).
//
// Body copy is the boilerplate Abigail pasted in her Apr 14 staging review
// email (one sentence fragment mended). NOTE for launch: the entity name
// ("Promoshop Canada Ltd.") and office cities ("Los Angeles") conflict with
// the PromoShop Inc. identity and Windsor/Toronto/Detroit contacts used
// everywhere else — awaiting the client's confirmed wording.
// The hero image is served from this repo's public/ folder — the previous
// raw.githubusercontent.com URLs were 404ing (private repo).
const MAINMEMORY_LOCAL = "/images/mainmemory"

export const ABOUT_CONTENT = {
  hero: {
    eyebrow: "About Us",
    heading: "MEET PROMOSHOP",
    // Best-guess storefront image from Abigail's updated set — if she flags a
    // different file in the Apr 15 review call, just swap the filename here.
    image: `${MAINMEMORY_LOCAL}/11.png`,
    imageAlt: "Outside of the PromoShop building",
    body: [
      "Promoshop Canada Ltd. is a Top 40 Promotional Merchandise Company in North America, with corporate head offices in Windsor, Ontario and Los Angeles, California. With more than 28 years in business and over $70 million in annual revenue, Promoshop ranks in the Top 1% of promotional merchandise companies across North America.",
      "We partner with some of the most recognizable global brands to create Memorable Merchandise Experiences. Through our extensive vendor network and access to premium retail brands, we help High-Level Organizations deliver merchandise that stands out and stands the test of time.",
      "Whether supporting a national rollout, a luxury gifting initiative, or a curated company apparel program, our team manages every detail from concept to completion.",
    ],
  },
}
