"use client"

import { useState } from "react"
import Link from "next/link"
import { Instagram, Linkedin, Facebook, Twitter, ArrowRight } from "lucide-react"
import { useLocale } from "@/lib/locale-context"
import { SiteImage } from "@/components/site-image"
import { HOME_CONTENT } from "@/lib/cms/home"
import { useSiteText } from "@/components/site-content-provider"

export function Footer() {
  const [email, setEmail] = useState("")
  const [subscribed, setSubscribed] = useState(false)
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

  const socialLinks = [
    { name: "Instagram", icon: Instagram, href: "#" },
    { name: "LinkedIn", icon: Linkedin, href: "#" },
    { name: "Facebook", icon: Facebook, href: "#" },
    { name: "Twitter / X", icon: Twitter, href: "#" },
  ]

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubscribed(true)
    setEmail("")
    setTimeout(() => setSubscribed(false), 3000)
  }

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
                alt="PromoShop Studio"
                width={200}
                height={68}
                className="h-14 w-auto"
                unoptimized
              />
            </Link>
            <p className="text-sm font-visby text-[#555] leading-relaxed mb-6">
              {tagline}
            </p>

            {/* Newsletter Signup */}
            <div className="mb-6">
              <h4 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-3">
                {newsletterHeading}
              </h4>
              {subscribed ? (
                <p className="text-sm text-[#4a9b2f] font-semibold">Thanks for subscribing!</p>
              ) : (
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <input
                    type="email"
                    required
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-white border border-[#d4d4d4] text-[#111] px-4 py-2.5 rounded-full text-sm font-visby focus:border-[#ef473f] focus:outline-none transition-colors placeholder:text-[#999]"
                  />
                  <button
                    type="submit"
                    className="bg-[#ef473f] text-white px-4 py-2.5 rounded-full hover:opacity-90 transition-opacity"
                    aria-label="Subscribe to newsletter"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>

            {/* Social Media Icons */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  aria-label={social.name}
                  title={social.name}
                  className="w-10 h-10 rounded-full border border-[#d4d4d4] bg-white flex items-center justify-center text-[#666] hover:text-white hover:bg-[#ef473f] hover:border-[#ef473f] transition-colors"
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              {["Home", "Studio", "Brands", "My Quote", "About"].map((item) => (
                <li key={item}>
                  <Link
                    href={item === "Home" ? "/" : `/${item.toLowerCase().replace(" ", "-")}`}
                    className="text-sm font-visby text-[#555] hover:text-[#ef473f] transition-colors"
                  >
                    {item}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Collections */}
          <div>
            <h3 className="text-xs font-bold tracking-wider uppercase text-[#373a36] mb-4">
              Collections
            </h3>
            <ul className="space-y-2">
              {["Drinkware", "Tops", "Jackets", "Tech", "Bags", "Eco-Aware"].map((item) => (
                <li key={item}>
                  <Link
                    href="/studio"
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
              Contact Us
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

        {/* Bottom Bar */}
        <div className="mt-8 pt-8 border-t border-[#e5e5e5] flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm font-visby text-[#777]">
            &copy; {new Date().getFullYear()} PromoShop Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-sm font-visby text-[#777] hover:text-[#ef473f] transition-colors underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="text-sm font-visby text-[#777] hover:text-[#ef473f] transition-colors underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>
            <Link
              href="#"
              className="text-sm font-visby text-[#777] hover:text-[#ef473f] transition-colors underline-offset-2 hover:underline"
            >
              Shipping Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
