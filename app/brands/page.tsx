import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BrandLogo } from "@/components/brand-logo"
import { getSupabaseBrands } from "@/lib/supabase/data"
import { BRANDS } from "@/lib/brands"
import { BrandsSearchClient } from "@/components/brands-search-client"
import { getSiteContentMap, resolveSiteText } from "@/lib/supabase/content"

export default async function BrandsPage() {
  // Fetch brands and editable copy from Supabase
  const [supabaseBrands, content] = await Promise.all([
    getSupabaseBrands(),
    getSiteContentMap(),
  ])
  const eyebrow = resolveSiteText(content, "brands.page.eyebrow", "Our Partners")
  const heading = resolveSiteText(content, "brands.page.heading", "Meet Our Brands")
  const intro = resolveSiteText(
    content,
    "brands.page.body",
    "We partner with the world's best brands to bring you quality promotional products that represent your company with pride.",
  )
  const ctaHeading = resolveSiteText(content, "brands.cta.heading", "Looking for a Specific Brand?")
  const ctaBody = resolveSiteText(
    content,
    "brands.cta.body",
    "We work with hundreds of brands. If you don't see what you're looking for, reach out and we'll source it for you.",
  )

  // `null` = Supabase unreachable → static seed fallback. An empty list is a
  // real answer (every brand deactivated) and renders an empty listing
  // instead of resurrecting brands the admin removed.
  const brands = supabaseBrands === null
    ? BRANDS.map((b) => ({ ...b, logoUrl: b.logoUrl ?? null, website: b.website ?? null }))
    : supabaseBrands.map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        description: b.description ?? "",
        logoUrl: b.logo_url,
        website: b.website_url,
        categories: b.categories ?? [],
        featured: b.featured,
      }))

  return (
    <div className="min-h-screen bg-white text-[#1a1a1a]">
      <Header />

      {/* Hero Section */}
      <section className="py-12 lg:py-16 px-6 lg:px-8 bg-[#f9f9f9]">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto">
            <p className="text-xs font-bold tracking-wider text-[#ef473f] uppercase mb-4">
              {eyebrow}
            </p>
            <h1 className="font-montserrat font-bold text-3xl lg:text-5xl text-[#1a1a1a] leading-tight mb-4 uppercase tracking-wide">
              {heading}
            </h1>
            <p className="text-base text-[#666] leading-relaxed font-visby mb-8">
              {intro}
            </p>
          </div>
        </div>
      </section>

      {/* Brands with Client-side Search */}
      <BrandsSearchClient brands={brands} />

      {/* CTA Section */}
      <section className="py-16 px-6 lg:px-8 bg-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-montserrat font-bold text-2xl lg:text-3xl text-[#1a1a1a] mb-4">
            {ctaHeading}
          </h2>
          <p className="text-[#666] mb-8 max-w-xl mx-auto font-visby">
            {ctaBody}
          </p>
          <Link
            href="/#contact"
            className="inline-flex items-center gap-2 bg-[#ef473f] text-white px-10 py-4 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity"
          >
            Contact Us
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
