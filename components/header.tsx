"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { Menu, X, ShoppingBag, Phone, Heart, User } from "lucide-react"
import { useLocale } from "@/lib/locale-context"
import { HOME_CONTENT } from "@/lib/cms/home"
import { SiteImage } from "@/components/site-image"
import { useAuth } from "@/lib/auth/AuthProvider"

const navigation = [
  { name: "Home", href: "/" },
  { name: "Studio", href: "/studio" },
  { name: "Brands", href: "/brands" },
  { name: "START MY QUOTE", href: "/my-quote" },
  { name: "About", href: "/about" },
]

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = usePathname()
  const { locale, config, setLocale } = useLocale()
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const LocaleToggle = ({ className = "" }: { className?: string }) => (
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
            {isAuthenticated ? null : (
              <Link href="/sign-in" className="flex items-center gap-1.5 text-xs font-visby hover:text-[#ef473f] transition-colors">
                <User className="w-3 h-3" />
                Login / Register
              </Link>
            )}
            <Link href="/my-quote" className="flex items-center gap-1.5 text-xs font-visby hover:text-[#ef473f] transition-colors">
              <Heart className="w-3 h-3" />
              Wishlist
            </Link>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="mx-auto max-w-7xl flex items-center justify-between px-6 py-3 lg:py-4 lg:px-8 border-b border-[#e5e5e5]">
        {/* Logo */}
        <Link href="/" className="flex-shrink-0">
          <SiteImage
            imageId="site.logo"
            defaultSrc={HOME_CONTENT.hero.logo}
            alt={HOME_CONTENT.hero.logoAlt}
            width={320}
            height={110}
            className="h-20 lg:h-24 w-auto"
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
                className={`text-sm font-bold uppercase tracking-wider px-4 py-2 rounded-full transition-colors ${
                  isActive
                    ? "text-[#ef473f] bg-[#ef473f]/5"
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
            <span className="relative z-10">Get a Quote</span>
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden text-[#373a36]"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="sr-only">Open menu</span>
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-[#e5e5e5]">
          <div className="space-y-1 px-6 py-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`block py-3 text-base font-bold uppercase tracking-wider transition-colors ${
                    isActive ? "text-[#ef473f]" : "text-[#373a36] hover:text-[#ef473f]"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              )
            })}
            <div className="pt-4 border-t border-[#e5e5e5] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wider uppercase text-[#999]">Region</span>
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
                Get a Quote
              </Link>
              {!isAuthenticated && (
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
