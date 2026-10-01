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
import { getCustomerPricingReleaseEnabled } from "@/lib/supabase/pricing"
import { imageFitKey, normalizeImageFit } from "@/lib/image-fit"
import { textFallback } from "@/lib/cms/text-slots"

export default async function HomePage() {
  // Fetch hero slides, brands, and editable text content from Supabase
  const [heroSlides, supabaseBrands, content, pricingReleased] = await Promise.all([
    getHeroSlides(),
    getSupabaseBrands(),
    getSiteContentMap(),
    getCustomerPricingReleaseEnabled(),
  ])

  const heroBody = HOME_CONTENT.hero.body.map((paragraph, i) =>
    resolveSiteText(content, `home.hero.body.${i + 1}`, paragraph),
  )
  const ctaPrimary = resolveSiteText(content, "home.hero.cta.primary", "Browse Our Brands")
  const ctaSecondary = resolveSiteText(content, "home.hero.cta.secondary", "View All Products")
  const studioWorksHeading = resolveSiteText(
    content,
    "home.studio_works.heading",
    textFallback("home.studio_works.heading"),
  )
  const studioWorksBody = resolveSiteText(
    content,
    "home.studio_works.body",
    textFallback("home.studio_works.body"),
  )

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
            // Admin-chosen display mode (cover vs contain) per slide.
            fit: normalizeImageFit(
              resolveSiteText(content, imageFitKey(`hero_slide.${slide.id}`), "cover"),
            ),
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
            <div className="py-12 sm:py-16 lg:py-20 lg:pr-12">
              {heroBody.map((paragraph, i) => {
                const Tag = i === 0 ? "h1" : "p"
                return (
                  <Tag
                    key={i}
                    className="text-[2.5rem] sm:text-6xl lg:text-[4rem] xl:text-7xl font-black text-[#e7e7e7] mb-8 last:mb-10 max-w-lg text-balance"
                    style={{
                      lineHeight: "1.04",
                      letterSpacing: "-0.025em",
                    }}
                  >
                    {paragraph}
                  </Tag>
                )
              })}
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/brands"
                  className="inline-flex min-h-12 items-center justify-center gap-2 bg-[#ef473f] bg-[linear-gradient(#0002,#0002)] text-white px-7 py-3.5 font-bold uppercase tracking-wider text-sm rounded-full hover:bg-[#d93e36] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0d0d]"
                >
                  {ctaPrimary}
                  <ArrowRight className="w-4 h-4 relative z-10" />
                </Link>
                <Link
                  href="/studio"
                  className="inline-flex min-h-12 items-center justify-center gap-2 border-2 border-[#ccc] text-[#ccc] px-7 py-3.5 font-bold uppercase tracking-wider text-sm rounded-full hover:bg-white hover:text-[#111111] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d0d0d]"
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

      {pricingReleased ? (
        <section className="bg-[#ededed] px-6 py-14 text-[#111111] lg:px-8 lg:py-20" aria-labelledby="studio-works-heading">
          <div className="mx-auto max-w-4xl">
            <h2 id="studio-works-heading" className="mb-6 text-3xl font-extrabold uppercase tracking-tight lg:text-4xl">
              {studioWorksHeading}
            </h2>
            <div className="space-y-5 text-base leading-relaxed text-[#333] lg:text-lg">
              {studioWorksBody
                .split(/\n{2,}/)
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>
          </div>
        </section>
      ) : null}

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
