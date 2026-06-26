import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ContactSection } from "@/components/contact-section"
import { ABOUT_CONTENT } from "@/lib/cms/about"
import { SiteImage } from "@/components/site-image"
import { TeamSection } from "@/components/team-section"
import { getSiteContentMap, resolveSiteText } from "@/lib/supabase/content"
import { imageFitClass, imageFitKey, normalizeImageFit } from "@/lib/image-fit"
import { renderInlineMarkdown } from "@/lib/rich-text"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Meet PromoShop — a Top 40 promotional merchandise company partnering with recognizable global brands to create memorable merchandise experiences.",
}

export default async function AboutPage() {
  const content = await getSiteContentMap()

  const eyebrow = resolveSiteText(content, "about.hero.eyebrow", ABOUT_CONTENT.hero.eyebrow)
  const heading = resolveSiteText(content, "about.hero.heading", ABOUT_CONTENT.hero.heading)
  const body = ABOUT_CONTENT.hero.body.map((paragraph, i) =>
    resolveSiteText(content, `about.hero.body.${i + 1}`, paragraph),
  )
  // Admin-chosen display mode for the hero image (cover crops; contain
  // letterboxes the whole image over the dark panel).
  const heroFit = normalizeImageFit(
    resolveSiteText(content, imageFitKey("about.hero"), "cover"),
  )

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
      {/* Hero Section — image LEFT, text RIGHT */}
      <section className="relative bg-[#0d0d0d] overflow-hidden">
        {/* Large red accent stripe */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 items-center">
            {/* Image — LEFT on desktop */}
            <div className="relative h-72 lg:h-full lg:min-h-[480px] order-first lg:order-first">
              <SiteImage
                imageId="about.hero"
                defaultSrc={ABOUT_CONTENT.hero.image}
                alt={ABOUT_CONTENT.hero.imageAlt}
                fill
                // Half-column hero; 1500w covers it at 2x without over-fetching
                // on this priority/LCP image. Raises a low-`format=` Squarespace
                // override so it isn't served small and upscaled soft.
                minSrcWidth={1500}
                className={imageFitClass(heroFit)}
                priority
              />
            </div>

            {/* Text — RIGHT on desktop */}
            <div className="py-16 lg:py-24 lg:pl-12 order-last">
              <p className="text-xs font-bold tracking-wider text-[#ef473f] uppercase mb-4">
                {eyebrow}
              </p>
              <h1 className="font-montserrat font-black text-4xl lg:text-5xl text-white leading-tight mb-6 tracking-wide">
                {heading}
              </h1>
              <div className="space-y-4">
                {body.map((paragraph, i) => (
                  <p key={i} className="text-lg text-[#aaa] leading-relaxed font-visby">
                    {renderInlineMarkdown(paragraph)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Meet Our Team (client component so admin overrides apply live) */}
      <TeamSection />

      {/* Contact Section */}
      <ContactSection />
      </main>

      <Footer />
    </div>
  )
}
