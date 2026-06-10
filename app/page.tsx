import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { BrandLogoScroll } from "@/components/brand-logo-scroll"
import { ContactSection } from "@/components/contact-section"
import { HeroSlideshow } from "@/components/home/hero-slideshow"
import { HOME_CONTENT } from "@/lib/cms/home"
import { getHeroSlides, getSupabaseBrands } from "@/lib/supabase/data"
import { getSiteContentMap, resolveSiteText } from "@/lib/supabase/content"

export default async function HomePage() {
  // Fetch hero slides, brands, and editable text content from Supabase
  const [heroSlides, supabaseBrands, content] = await Promise.all([
    getHeroSlides(),
    getSupabaseBrands(),
    getSiteContentMap(),
  ])

  const heroBody = HOME_CONTENT.hero.body.map((paragraph, i) =>
    resolveSiteText(content, `home.hero.body.${i + 1}`, paragraph),
  )
  const ctaPrimary = resolveSiteText(content, "home.hero.cta.primary", "Browse Our Brands")
  const ctaSecondary = resolveSiteText(content, "home.hero.cta.secondary", "View All Products")

  // Image URLs from Supabase already have ?v=<updated_at> cache-busting
  // appended by lib/supabase/data.ts so swapping a row instantly busts the
  // browser, CDN, and next/image caches.
  //
  // `null` = Supabase unreachable → static fallback. An empty list is a real
  // answer (admin deactivated everything) and renders no slideshow. Slides
  // with neither an image nor a background colour are skipped so a
  // just-created slide doesn't rotate in as a blank frame before its image
  // is uploaded.
  const slides =
    heroSlides === null
      ? HOME_CONTENT.slideshow
      : heroSlides
          .filter((slide) => slide.image_url || slide.bg_color)
          .map((slide) => ({
            src: slide.image_url || "",
            alt: slide.title,
            title: slide.title,
            subtitle: slide.subtitle,
            cta_text: slide.cta_text,
            cta_url: slide.cta_url,
            bg_color: slide.bg_color,
          }))

  // Transform Supabase brands for the logo scroll. `null` (unreachable) makes
  // the component fall back to the static BRANDS; an empty list renders no
  // scroll at all.
  const brands =
    supabaseBrands === null
      ? null
      : supabaseBrands.map((brand) => ({
          id: brand.id,
          slug: brand.slug,
          name: brand.name,
          logoUrl: brand.logo_url,
        }))

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
      {/* Hero Section with Logo + Slideshow */}
      <section className="relative bg-[#0d0d0d] overflow-hidden">
        {/* Large red accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
            {/* Text + Logo Side. The first hero statement is the page's h1
                (the homepage previously had no heading at all). */}
            <div className="py-16 lg:py-24 lg:pr-12">
              {heroBody.map((paragraph, i) => {
                const Tag = i === 0 ? "h1" : "p"
                return (
                  <Tag
                    key={i}
                    className="text-5xl lg:text-6xl xl:text-7xl font-black text-[#e7e7e7] mb-6 last:mb-10 max-w-lg"
                    style={{
                      lineHeight: "0.9em",
                      letterSpacing: "0.126em",
                    }}
                  >
                    {paragraph}
                  </Tag>
                )
              })}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/brands"
                  className="shimmer-cta inline-flex items-center gap-2 bg-[#ef473f] text-white px-8 py-3.5 font-bold uppercase tracking-wider text-sm rounded-full hover:bg-[#d93e36] transition-colors"
                >
                  {ctaPrimary}
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </Link>
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 border-2 border-[#ccc] text-[#ccc] px-8 py-3.5 font-bold uppercase tracking-wider text-sm rounded-full hover:bg-white hover:text-[#111111] transition-colors"
                >
                  {ctaSecondary}
                </Link>
              </div>
            </div>
            {/* Slideshow Side */}
            <HeroSlideshow slides={slides} />
          </div>
        </div>
      </section>

      {/* Brand Logo Scroll */}
      <BrandLogoScroll brands={brands} />

      {/* "Meet Our Team" removed from the home page per client feedback
          (Apr 16): keep it on the About page only so visitors land directly on
          the brand narrative, not the roster. */}

      {/* Contact Section */}
      <ContactSection />
      </main>

      <Footer />
    </div>
  )
}
