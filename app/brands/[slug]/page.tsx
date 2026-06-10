import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getBrandBySlug, type Brand } from "@/lib/brands"
import { PRODUCTS } from "@/lib/products"
import { getAllProducts } from "@/lib/supabase/products"
import { getSupabaseBrandBySlug } from "@/lib/supabase/data"
import { getSiteContentMap, resolveSiteText } from "@/lib/supabase/content"
import { textFallback } from "@/lib/cms/text-slots"
import { BrandHero } from "@/components/brand-hero"
import { BrandProductsGrid } from "@/components/brand-products-grid"

interface BrandPageProps {
  params: Promise<{ slug: string }>
}

// Brand pages are the core indexable catalog — without this they all carried
// the homepage's title/description. Unknown slugs return nothing extra; the
// page itself answers with notFound().
export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { slug } = await params
  const lookup = await getSupabaseBrandBySlug(slug)
  const brand = lookup.ok && lookup.brand?.is_active ? lookup.brand : null
  const fallback = getBrandBySlug(slug)
  const name = brand?.name ?? fallback?.name
  if (!name) return {}
  const description = (brand?.description ?? fallback?.description) || undefined
  return {
    title: `${name} Promotional Products`,
    description,
  }
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params

  // Resolve the brand from the live `brands` table so dashboard-created
  // brands resolve here and edits (name/description/logo) show on the detail
  // page — mirroring the /brands listing. The compiled-in seed is only a
  // fallback for an actual Supabase outage: when the database answers "no
  // such brand" (including soft-deleted brands, which RLS hides from the
  // anon key), this 404s instead of resurrecting the seed version.
  // getSiteContentMap is request-cached (the layout already fetches it), so
  // resolving the editable CTA/banner copy here costs no extra query.
  const [lookup, products, content] = await Promise.all([
    getSupabaseBrandBySlug(slug),
    getAllProducts(),
    getSiteContentMap(),
  ])
  const quoteCta = resolveSiteText(content, "brands.detail.cta", textFallback("brands.detail.cta"))
  const bannerHeading = resolveSiteText(
    content,
    "brands.detail.banner.heading",
    textFallback("brands.detail.banner.heading"),
  )
  const bannerBody = resolveSiteText(
    content,
    "brands.detail.banner.body",
    textFallback("brands.detail.banner.body"),
  )
  const bannerCta = resolveSiteText(
    content,
    "brands.detail.banner.cta",
    textFallback("brands.detail.banner.cta"),
  )

  let resolved: Brand | undefined
  if (lookup.ok) {
    if (!lookup.brand || !lookup.brand.is_active) {
      notFound()
    }
    resolved = {
      id: lookup.brand.id,
      name: lookup.brand.name,
      slug: lookup.brand.slug,
      description: lookup.brand.description ?? "",
      categories: lookup.brand.categories ?? [],
      featured: lookup.brand.featured,
      logoUrl: lookup.brand.logo_url,
      website: lookup.brand.website_url,
    }
  } else {
    resolved = getBrandBySlug(slug)
  }

  if (!resolved) {
    notFound()
  }
  const brand: Brand = resolved

  // Match on the stable brand slug, not the display name. Renaming a brand in
  // the admin dashboard changes a product's resolved brand *name* but not its
  // slug, so name-matching would silently empty this grid. The static catalog
  // (outage fallback) predates slugs, so it matches on the seed brand name —
  // both sides are compiled-in there, so the names always agree.
  const brandProducts = products
    ? products.filter((p) => p.brandSlugs.includes(brand.slug))
    : PRODUCTS.filter((p) => p.brands.includes(brand.name))

  return (
    <div className="min-h-screen bg-[#ededed] text-[#111111] font-montserrat">
      <Header />

      <main id="main-content">
      {/* The brand's visual identity is its logo; expose the name as the
          page heading for assistive tech and search. */}
      <h1 className="sr-only">{brand.name}</h1>

      {/* Breadcrumb & Hero */}
      <section className="px-6 lg:px-10 pt-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href="/brands"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#6b6b6b] hover:text-[#d93e36] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Brands
          </Link>

          {/* Brand Hero — logo over lifestyle background. */}
          <BrandHero brand={brand} />

          {/* Description + CTA */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <p className="text-lg text-[#666] max-w-2xl leading-relaxed">
              {brand.description}
            </p>

            <Link
              href="/my-quote"
              className="inline-flex items-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap self-start"
            >
              {quoteCta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mt-6">
            {brand.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs font-bold tracking-wider uppercase px-3 py-1.5 bg-white border border-[#d0d0d0] rounded text-[#666]"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="px-6 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-extrabold text-xl uppercase tracking-wide text-black mb-6">
            Products from {brand.name}
          </h2>

          {/* Clicking a card opens the detail modal in place, restoring the
              add-to-quote flow that was broken when cards were wrapped in a
              Link to /studio (client feedback Apr 16). */}
          <BrandProductsGrid products={brandProducts} brandName={brand.name} />
        </div>
      </section>

      {/* More Brands CTA */}
      <section className="px-6 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-black rounded-lg p-8 lg:p-10 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h3 className="font-extrabold text-xl lg:text-2xl uppercase text-white mb-1">
                {bannerHeading}
              </h3>
              <p className="text-[#888] text-sm">
                {bannerBody}
              </p>
            </div>
            <Link
              href="/brands"
              className="inline-flex items-center gap-2.5 bg-[#ef473f] text-white px-7 py-3.5 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {bannerCta}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      </main>

      <Footer />
    </div>
  )
}
