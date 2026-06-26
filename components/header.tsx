"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X, ShoppingBag, Phone, User, LogOut } from "lucide-react"
import { useLocale } from "@/lib/locale-context"
import { HOME_CONTENT } from "@/lib/cms/home"
import { SiteImage } from "@/components/site-image"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useSiteText, useSiteContentMap } from "@/components/site-content-provider"
import { textFallback } from "@/lib/cms/text-slots"
import { imageSizeKey, normalizeImageSize, pickBySize } from "@/lib/image-size"

const navigation = [
  { name: "Home", href: "/" },
  { name: "Studio", href: "/studio" },
  { name: "Brands", href: "/brands" },
  { name: "START MY QUOTE", href: "/my-quote" },
  { name: "About", href: "/about" },
  { name: "Collection", href: "/collections" },
]

// Module-level (not defined inside Header's render) so React keeps a stable
// component identity instead of remounting the toggle on every re-render.
function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale()
  return (
    <div className={`inline-flex items-center rounded-full border border-[#e5e5e5] p-0.5 ${className}`} role="group" aria-label="Select region">
      <button
        type="button"
        onClick={() => setLocale("CAN")}
        aria-pressed={locale === "CAN"}
        className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full transition-colors ${
          locale === "CAN"
            ? "bg-[#ef473f] text-white"
            : "text-[#373a36] hover:text-[#ef473f]"
        }`}
      >
        CAN
      </button>
      <button
        type="button"
        onClick={() => setLocale("USA")}
        aria-pressed={locale === "USA"}
        className={`px-3 py-1 text-[10px] font-bold tracking-wider uppercase rounded-full transition-colors ${
          locale === "USA"
            ? "bg-[#ef473f] text-white"
            : "text-[#373a36] hover:text-[#ef473f]"
        }`}
      >
        USA
      </button>
    </div>
  )
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const { config } = useLocale()
  const { isAuthenticated, user, signOut } = useAuth()
  const quoteCta = useSiteText("header.cta", textFallback("header.cta"))
  // Admin-chosen logo size (Images tab → Site logo → Display size). w-auto
  // keeps the 3:2 ratio; the nav row grows to the taller logo, so scaling up
  // reflows rather than overlapping.
  const logoSize = normalizeImageSize(useSiteContentMap()[imageSizeKey("site.logo")]?.value)
  const logoClass = pickBySize(logoSize, {
    sm: "h-16 lg:h-20 w-auto",
    md: "h-20 lg:h-24 w-auto",
    lg: "h-24 lg:h-32 w-auto",
  })

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close the mobile menu on any navigation — including back/forward, which
  // changes pathname without firing the per-link onClick that otherwise
  // closes it (the menu would stay open over the new page).
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  // Escape closes the open mobile menu (expected for a disclosure control).
  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [mobileMenuOpen])

  return (
    <header className={`bg-white ${scrolled ? "shadow-md" : ""} sticky top-0 z-50 transition-all duration-300`}>
      {/* Top utility bar */}
      <div className="bg-[#373a36] text-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between py-2">
          <a
            href={config.primaryContact.phoneHref}
            className="flex items-center gap-1.5 text-xs font-visby"
          >
            <Phone className="w-3 h-3" />
            {config.supportLineLabel}
          </a>
          <div className="hidden sm:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="flex items-center gap-1.5 text-xs font-visby">
                  <User className="w-3 h-3" aria-hidden="true" />
                  {user?.firstName || user?.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="flex items-center gap-1.5 text-xs font-visby hover:text-[#ef473f] transition-colors"
                >
                  <LogOut className="w-3 h-3" aria-hidden="true" />
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/sign-in" className="flex items-center gap-1.5 text-xs font-visby hover:text-[#ef473f] transition-colors">
                <User className="w-3 h-3" aria-hidden="true" />
                Login / Register
              </Link>
            )}
            <Link href="/my-quote" className="flex items-center gap-1.5 text-xs font-visby hover:text-[#ef473f] transition-colors">
              <ShoppingBag className="w-3 h-3" aria-hidden="true" />
              My Quote
            </Link>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3 lg:py-4 lg:px-8 border-b border-[#e5e5e5]">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          {/* Declared dimensions must match the real 3:2 file ratio or the
              nav reflows when the image decodes (layout shift). */}
          <SiteImage
            imageId="site.logo"
            defaultSrc={HOME_CONTENT.hero.logo}
            alt={HOME_CONTENT.hero.logoAlt}
            width={165}
            height={110}
            className={logoClass}
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex lg:items-center lg:gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors ${
                  isActive
                    ? "text-[#d93e36] bg-[#ef473f]/5 underline underline-offset-8"
                    : "text-[#373a36] hover:text-[#ef473f]"
                }`}
              >
                {item.name}
              </Link>
            )
          })}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex lg:items-center lg:gap-4">
          <LocaleToggle />
          <Link
            href="/my-quote"
            className="shimmer-cta relative flex items-center gap-2 bg-[#ef473f] text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider rounded-full hover:bg-[#d93e36] transition-colors"
          >
            <ShoppingBag className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{quoteCta}</span>
          </Link>
        </div>

        {/* Mobile menu button — padded so the tap target clears 44px. */}
        <button
          type="button"
          className="lg:hidden text-[#373a36] p-2.5 -mr-2.5 rounded-full hover:bg-[#f5f5f5] transition-colors"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-menu"
        >
          <span className="sr-only">{mobileMenuOpen ? "Close menu" : "Open menu"}</span>
          {mobileMenuOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div id="mobile-menu" className="lg:hidden bg-white border-t border-[#e5e5e5]">
          <div className="space-y-1 px-6 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`block py-3 text-base font-bold uppercase tracking-wider transition-colors ${
                    isActive ? "text-[#d93e36] underline underline-offset-4" : "text-[#373a36] hover:text-[#ef473f]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              )
            })}
            <div className="pt-4 border-t border-[#e5e5e5] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-[#6b6b6b]">Region</span>
                <LocaleToggle />
              </div>
              <a
                href={config.primaryContact.phoneHref}
                className="flex items-center gap-2 py-2 text-sm font-semibold text-[#666]"
              >
                <Phone className="w-4 h-4" />
                {config.primaryContact.phone}
              </a>
              <Link
                href="/my-quote"
                className="flex items-center justify-center gap-2 bg-[#ef473f] text-white py-3 font-bold uppercase tracking-wider text-sm rounded-full"
                onClick={() => setMobileMenuOpen(false)}
              >
                <ShoppingBag className="w-4 h-4" />
                {quoteCta}
              </Link>
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    signOut()
                    setMobileMenuOpen(false)
                  }}
                  className="block w-full py-2 text-sm font-bold uppercase tracking-wider text-[#373a36] text-center"
                >
                  Sign out{user?.firstName ? ` (${user.firstName})` : ""}
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  className="block py-2 text-sm font-bold uppercase tracking-wider text-[#373a36] text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Login / Register
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
