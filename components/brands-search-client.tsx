"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Search } from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"

interface Brand {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string | null
  website?: string | null
  categories: string[]
  featured?: boolean
}

interface BrandsSearchClientProps {
  brands: Brand[]
}

export function BrandsSearchClient({ brands }: BrandsSearchClientProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const filteredBrands = useMemo(() => {
    if (!searchTerm.trim()) return brands
    const term = searchTerm.toLowerCase()
    return brands.filter(
      (brand) =>
        brand.name.toLowerCase().includes(term) ||
        brand.description.toLowerCase().includes(term) ||
        brand.categories.some((cat) => cat.toLowerCase().includes(term))
    )
  }, [brands, searchTerm])

  const featuredBrands = useMemo(() => {
    return filteredBrands.filter((b) => b.featured)
  }, [filteredBrands])

  const otherBrands = useMemo(() => {
    return filteredBrands.filter((b) => !b.featured)
  }, [filteredBrands])

  // If no featured brands, show all as a single grid
  const displayBrands = featuredBrands.length > 0 ? featuredBrands : filteredBrands

  return (
    <>
      {/* Search Bar */}
      <section className="py-8 px-6 lg:px-8 bg-[#f9f9f9]">
        <div className="mx-auto max-w-7xl">
          <div className="relative max-w-md mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#767676]" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search brands"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-[#e5e5e5] text-[#1a1a1a] pl-12 pr-4 py-3.5 rounded-lg text-sm font-visby tracking-wide outline-none placeholder:text-[#767676] focus:border-[#ef473f] focus-visible:ring-2 focus-visible:ring-[#ef473f] transition-colors shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* Screen-reader result count (parity with the studio filter count). */}
      <p aria-live="polite" className="sr-only">
        {filteredBrands.length} {filteredBrands.length === 1 ? "brand" : "brands"} found
      </p>

      {/* Featured Brands */}
      {displayBrands.length > 0 && (
        <section className="py-12 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {featuredBrands.length > 0 && (
              <h2 className="font-montserrat font-bold text-lg uppercase tracking-wider text-[#6b6b6b] mb-8">
                Featured Brands
              </h2>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayBrands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.slug}`}
                  className="group bg-white border border-[#e5e5e5] rounded-lg p-8 hover:border-[#ef473f] hover:shadow-md transition-all duration-300"
                >
                  <div className="w-full h-20 bg-[#f5f5f5] rounded flex items-center justify-center mb-6 group-hover:bg-[#fef2f2] transition-colors overflow-hidden px-4">
                    <BrandLogo
                      brand={brand}
                      fallbackClassName="font-montserrat font-bold text-xl tracking-wider text-[#373a36]/60 group-hover:text-[#ef473f] transition-colors uppercase"
                    />
                  </div>

                  <h3 className="font-montserrat font-bold text-lg text-[#1a1a1a] mb-2 group-hover:text-[#ef473f] transition-colors">
                    {brand.name}
                  </h3>

                  {brand.categories[0] && (
                    <p className="text-xs font-bold tracking-wider uppercase text-[#d93e36] mb-2">
                      {brand.categories[0]}
                    </p>
                  )}

                  {brand.description && (
                    <p className="text-sm text-[#666] leading-relaxed mb-4 font-visby">
                      {brand.description}
                    </p>
                  )}

                  <div className="flex items-center gap-2 text-[#d93e36] text-sm font-semibold uppercase tracking-wider">
                    View Products
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Other Brands */}
      {otherBrands.length > 0 && featuredBrands.length > 0 && (
        <section className="py-12 px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="font-montserrat font-bold text-lg uppercase tracking-wider text-[#6b6b6b] mb-8">
              All Brands
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {otherBrands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/brands/${brand.slug}`}
                  className="group bg-white border border-[#e5e5e5] rounded-lg p-8 hover:border-[#ef473f] hover:shadow-md transition-all duration-300"
                >
                  <div className="w-full h-20 bg-[#f5f5f5] rounded flex items-center justify-center mb-6 group-hover:bg-[#fef2f2] transition-colors overflow-hidden px-4">
                    <BrandLogo
                      brand={brand}
                      fallbackClassName="font-montserrat font-bold text-xl tracking-wider text-[#373a36]/60 group-hover:text-[#ef473f] transition-colors uppercase"
                    />
                  </div>

                  <h3 className="font-montserrat font-bold text-lg text-[#1a1a1a] mb-2 group-hover:text-[#ef473f] transition-colors">
                    {brand.name}
                  </h3>

                  <div className="flex items-center gap-2 text-[#d93e36] text-sm font-semibold uppercase tracking-wider">
                    View Products
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* No Results — "try a different search" only makes sense when the
          visitor actually searched; an empty catalog gets honest copy. */}
      {filteredBrands.length === 0 && (
        <section className="py-16 px-6 lg:px-8" aria-live="polite">
          <div className="mx-auto max-w-7xl text-center">
            {brands.length === 0 ? (
              <>
                <p className="text-xl font-montserrat font-bold text-[#1a1a1a] mb-2">Brand Lineup Coming Soon</p>
                <p className="text-[#666] font-visby">
                  We&apos;re curating our brand partners. <Link href="/#contact" className="underline hover:text-[#1a1a1a]">Contact us</Link> for availability.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-montserrat font-bold text-[#1a1a1a] mb-2">No Brands Found</p>
                <p className="text-[#666] font-visby">Try a different search term.</p>
              </>
            )}
          </div>
        </section>
      )}
    </>
  )
}
