"use client"

import Link from "next/link"
import { Mail } from "lucide-react"
import { useLocale } from "@/lib/locale-context"
import { SiteImage } from "@/components/site-image"
import { HOME_CONTENT } from "@/lib/cms/home"
import { useSiteText } from "@/components/site-content-provider"
import { textFallback } from "@/lib/cms/text-slots"

export function Footer() {
  const { config } = useLocale()
  const tagline = useSiteText(
    "footer.tagline",
    "Welcome to our store, where promoting your business is our business. Born from an expertise in building brands, we offer unique, quality promotional products.",
  )
  const newsletterHeading = useSiteText("footer.newsletter.heading", "Stay in the Loop")
  const adaNotice = useSiteText(
    "footer.ada",
    "We understand the importance of accessibility for all visitors to our website and it is something we take seriously. We are working on bringing this website in-line with WCAG 2.1 A, AA standards to ensure we provide an experience that is accessible to all. Your patience is appreciated as we work through these changes.",
  )
  // Same CMS key as ContactSection so an admin email edit updates both
  // places instead of leaving the footer stale.
  const contactEmail = useSiteText("contact.section.email", "info@promoshopinc.com")
  const quickLinksHeading = useSiteText(
    "footer.quicklinks.heading",
    textFallback("footer.quicklinks.heading"),
  )
  const collectionsHeading = useSiteText(
    "footer.collections.heading",
    textFallback("footer.collections.heading"),
  )
  const contactUsHeading = useSiteText(
    "footer.contactus.heading",
    textFallback("footer.contactus.heading"),
  )

  // Social icons removed for launch: every profile URL was a dead "#"
  // placeholder. Restore the icon row (see git history) once the client
  // supplies real profile links.

  return (
    // Footer repainted white per client feedback (Apr 16). Sky-blue (#bde7ff)
    // accent band separates the footer from preceding sections and ties it to
    // the brand-logo scroll that now sits on the same #bde7ff field.
    <footer className="bg-white border-t border-[#bde7ff]">
      <div className="h-1.5 bg-[#bde7ff]" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
          {/* Brand + Newsletter */}
          <div className="lg:col-span-2">
            {/* PromoShop Studio logo */}
            <Link href="/" className="inline-block mb-4">
              <SiteImage
                imageId="site.logo"
                defaultSrc={HOME_CONTENT.hero.logo}
                alt="PromoShop Inc"
                width={165}
                height={110}
                className="h-14 w-auto"
                unoptimized
              />
            </Link>
            <p className="text-sm font-visby text-[#555] leading-relaxed mb-6">
              {tagline}
            </p>

            {/* Newsletter: the previous inline form was never wired to a
                backend (the address was silently discarded), so it now
                routes interest through a real mailto until the client picks
                a mailing-list provider. */}
            <div className="mb-6">
              <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-3">
                {newsletterHeading}
              </h3>
              <a
                href={`mailto:${contactEmail}?subject=${encodeURIComponent("Newsletter signup")}`}
                className="inline-flex items-center gap-2 text-sm font-visby text-[#555] hover:text-[#d93e36] transition-colors underline underline-offset-2"
              >
                <Mail className="w-4 h-4" aria-hidden="true" />
                Email us to join our mailing list
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-4">
              {quickLinksHeading}
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Home", href: "/" },
                { label: "Studio", href: "/studio" },
                { label: "Brands", href: "/brands" },
                { label: "My Quote", href: "/my-quote" },
                { label: "About", href: "/about" },
              ].map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-sm font-visby text-[#555] hover:text-[#ef473f] transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Collections — only categories that actually exist in the
              catalog; each link pre-filters the studio grid. */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-4">
              {collectionsHeading}
            </h3>
            <ul className="space-y-2">
              {["Drinkware", "Tops", "Jackets", "Tech"].map((item) => (
                <li key={item}>
                  <Link
                    href={`/studio?category=${encodeURIComponent(item)}`}
                    className="text-sm font-visby text-[#555] hover:text-[#ef473f] transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact (locale-aware) */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-4">
              {contactUsHeading}
            </h3>
            <ul className="space-y-3 font-visby">
              {config.allContacts.map((contact) => (
                <li key={contact.phoneHref} className="text-sm text-[#555]">
                  <span className="block font-semibold text-[#222]">{contact.city}, {contact.region}</span>
                  <a href={contact.phoneHref} className="hover:text-[#ef473f] transition-colors">
                    {contact.phone}
                  </a>
                </li>
              ))}
              <li className="text-sm text-[#555] pt-2">
                <a href={`mailto:${contactEmail}`} className="hover:text-[#ef473f] transition-colors">
                  {contactEmail}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* ADA Compliance */}
        <div className="mt-8 p-4 bg-[#f3fafd] border border-[#bde7ff] rounded-lg">
          <p className="text-xs text-[#555] font-visby leading-relaxed">
            <strong className="text-[#222]">ADA Compliance:</strong> {adaNotice}
          </p>
        </div>

        {/* Bottom Bar. Privacy/Terms/Shipping links removed for launch:
            they pointed at "#" — no policy pages exist yet. Restore them
            (real routes) once the client supplies the policy copy. */}
        <div className="mt-8 pt-8 border-t border-[#e5e5e5] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-visby text-[#6b6b6b]">
            &copy; {new Date().getFullYear()} PromoShop Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
