/**
 * Registry of editable text slots that have NO seeded `site_content` row.
 *
 * The dashboard's Text tab historically listed only rows that already exist
 * in the database, so copy that shipped hard-coded (studio headings, quote
 * builder copy, header CTA, footer column headings…) could never be edited.
 * Each entry here is offered as an empty editor in the dashboard; saving one
 * upserts a real `site_content` row (`updateSiteContent`), and the public
 * components read the same key through `useSiteText`/`resolveSiteText` with
 * the same fallback, so a blank value always means "show the built-in copy".
 *
 * Keep `fallback` in sync with the component's literal default — components
 * import `textFallback(key)` from here so the two can't drift.
 *
 * Pure module: imported by server pages, client components, and the admin
 * dashboard alike.
 */

export interface TextSlot {
  key: string
  label: string
  fallback: string
  multiline?: boolean
}

export const EXTRA_TEXT_SLOTS: TextSlot[] = [
  // --- Header / navigation ---------------------------------------------
  {
    key: "header.cta",
    label: "Header quote button label",
    fallback: "Get a Quote",
  },

  // --- Studio page -------------------------------------------------------
  {
    key: "studio.page.eyebrow",
    label: "Studio page eyebrow (small line above the heading)",
    fallback: "PromoShop Studio — Product Catalog",
  },
  {
    key: "studio.page.heading",
    label: "Studio page heading",
    fallback: "Browse Our Products",
  },
  {
    key: "studio.banner.heading",
    label: "Studio bottom banner heading",
    fallback: "Ready to Order?",
  },
  {
    key: "studio.banner.body",
    label: "Studio bottom banner body",
    fallback: "Start a quote to unlock pricing, quantities, and full customization options.",
  },
  {
    key: "studio.banner.cta",
    label: "Studio bottom banner button label",
    fallback: "Start Your Quote",
  },

  // --- Quote builder (/my-quote) ------------------------------------------
  {
    key: "quote.page.eyebrow",
    label: "Quote page eyebrow (small line above the heading)",
    fallback: "Quote Builder",
  },
  {
    key: "quote.page.heading",
    label: "Quote page heading",
    fallback: "My Quote",
  },
  {
    key: "quote.page.subheading",
    label: "Quote page subheading",
    fallback: "Build your quote and submit it for pricing. We'll get back to you within 24-48 hours.",
  },
  {
    key: "quote.success.heading",
    label: "Quote submitted — success heading",
    fallback: "Quote Submitted!",
  },
  {
    key: "quote.success.body",
    label: "Quote submitted — success message",
    fallback:
      "Thank you for your quote request. Our team will review your selections and get back to you within 24-48 hours.",
    multiline: true,
  },

  // --- Brand detail pages ---------------------------------------------
  {
    key: "brands.detail.cta",
    label: "Brand page quote button label",
    fallback: "START MY QUOTE",
  },
  {
    key: "brands.detail.banner.heading",
    label: "Brand page bottom banner heading",
    fallback: "Explore More Brands",
  },
  {
    key: "brands.detail.banner.body",
    label: "Brand page bottom banner body",
    fallback: "Discover our full collection of premium brand partners.",
  },
  {
    key: "brands.detail.banner.cta",
    label: "Brand page bottom banner button label",
    fallback: "View All Brands",
  },

  // --- Footer column headings ---------------------------------------------
  {
    key: "footer.quicklinks.heading",
    label: "Footer 'Quick Links' column heading",
    fallback: "Quick Links",
  },
  {
    key: "footer.collections.heading",
    label: "Footer 'Collections' column heading",
    fallback: "Collections",
  },
  {
    key: "footer.contactus.heading",
    label: "Footer 'Contact Us' column heading",
    fallback: "Contact Us",
  },

  // --- Collections page ---------------------------------------------------
  {
    key: "collections.page.eyebrow",
    label: "Collections page eyebrow (small line above the heading)",
    fallback: "Curated by PromoShop",
  },
  {
    key: "collections.page.heading",
    label: "Collections page heading",
    fallback: "Collections",
  },
  {
    key: "collections.page.body",
    label: "Collections page intro paragraph",
    fallback: "Thoughtfully grouped merchandise — ready to brief, gift, or build a campaign around.",
    multiline: true,
  },
]

const SLOTS_BY_KEY = new Map(EXTRA_TEXT_SLOTS.map((slot) => [slot.key, slot]))

/** The compiled-in default for a registered slot ("" for unknown keys). */
export function textFallback(key: string): string {
  return SLOTS_BY_KEY.get(key)?.fallback ?? ""
}
