"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { Search, ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/studio/product-card"
import { ProductDetailModal } from "@/components/studio/product-detail-modal"
import { useLocale } from "@/lib/locale-context"
import { useSiteText } from "@/components/site-content-provider"
import { textFallback } from "@/lib/cms/text-slots"
import type { Product } from "@/lib/products"
import { displayTag, regionTagForLocale, hasAnyRegionTag } from "@/lib/tags"

interface Props {
  products: Product[]
  categories: string[]
  brands: string[]
  /** Distinct team-managed filter tags across the catalog (canonical form). */
  tags: string[]
  /** Pre-selected category (from /studio?category=… deep links). */
  initialCategory?: string
}

export default function StudioClient({ products, categories, brands, tags, initialCategory }: Props) {
  const { t, locale } = useLocale()
  const pageEyebrow = useSiteText(
    "studio.page.eyebrow",
    `PromoShop Studio — Product ${t("Catalog")}`,
  )
  const pageHeading = useSiteText("studio.page.heading", textFallback("studio.page.heading"))
  const bannerHeading = useSiteText("studio.banner.heading", textFallback("studio.banner.heading"))
  const bannerBody = useSiteText(
    "studio.banner.body",
    `Start a quote to unlock pricing, quantities, and full ${t("customization")} options.`,
  )
  const bannerCta = useSiteText("studio.banner.cta", textFallback("studio.banner.cta"))
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState(
    initialCategory && categories.includes(initialCategory) ? initialCategory : "All",
  )

  // Same-route navigations (the footer's Collections links render on
  // /studio itself, and back/forward moves between ?category= URLs) re-render
  // this mounted instance with a new prop — the useState initializer never
  // re-runs, so the prop change must be synced into state explicitly.
  useEffect(() => {
    if (initialCategory && categories.includes(initialCategory)) {
      setActiveCategory(initialCategory)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategory])
  const [activeGender, setActiveGender] = useState("All")
  const [activeBrand, setActiveBrand] = useState("All")
  const [activeTag, setActiveTag] = useState("All")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const genders = ["All", "Men's", "Women's", "Unisex"]

  // The active region's tag ("canada"/"usa"). The US/Canada toggle drives a
  // SOFT prioritization (region products float up), not a hard filter — every
  // product stays visible, matching "mostly see Canada products first".
  const regionTag = regionTagForLocale(locale)
  const catalogHasRegionTags = useMemo(
    () => hasAnyRegionTag(products.map((p) => p.tags)),
    [products],
  )

  const filteredProducts = useMemo(() => {
    const searchLower = searchTerm.toLowerCase()
    const matched = products.filter((product) => {
      const catOk = activeCategory === "All" || product.category === activeCategory

      let genderOk = activeGender === "All"
      if (activeGender === "Men's") genderOk = product.gender.includes("Mens")
      else if (activeGender === "Women's") genderOk = product.gender.includes("Womens")
      else if (activeGender === "Unisex") genderOk = product.gender.includes("Unisex")

      const brandOk = activeBrand === "All" || product.brands.includes(activeBrand)
      const tagOk = activeTag === "All" || (product.tags ?? []).includes(activeTag)

      const searchOk =
        !searchTerm ||
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.brands.join(" ").toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower) ||
        (product.tags ?? []).join(" ").includes(searchLower)

      return catOk && genderOk && brandOk && tagOk && searchOk
    })

    // No region tags in the catalog yet → leave the seeded sort_order alone.
    if (!catalogHasRegionTags) return matched
    // Stable partition: region-tagged first, original order kept within each
    // group (the explicit index tiebreak doesn't lean on Array.sort stability).
    return matched
      .map((p, i) => ({ p, i, region: (p.tags ?? []).includes(regionTag) ? 0 : 1 }))
      .sort((a, b) => a.region - b.region || a.i - b.i)
      .map((x) => x.p)
  }, [products, activeCategory, activeGender, activeBrand, activeTag, searchTerm, regionTag, catalogHasRegionTags])

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const closeProductDetail = () => {
    // The modal unmounts instantly when isOpen flips (it renders null), so
    // there is no exit animation to wait for.
    setIsModalOpen(false)
    setSelectedProduct(null)
  }

  return (
    <div className="min-h-screen bg-[#ededed] text-[#111111] font-montserrat">
      <Header />

      {/* Header Section */}
      <main id="main-content" className="contents">
      <div className="px-6 lg:px-10 pt-10 pb-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] text-[#6b6b6b] uppercase mb-1.5">
            {pageEyebrow}
          </p>
          <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tight text-black">
            {pageHeading}
          </h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap w-full sm:w-auto">
          {/* Full-width on phones — the fixed 280px box overflowed viewports
              narrower than ~330px. */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black text-white pl-10 pr-4 py-3 rounded text-xs font-bold tracking-wider uppercase w-full sm:w-[280px] outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ededed] placeholder:text-[#999]"
            />
          </div>
          <Link
            href="/my-quote"
            className="inline-flex items-center gap-2 bg-[#ef473f] text-white px-5 py-3 font-extrabold text-xs tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Build a Quote
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Body: Sidebar + Grid */}
      <div className="flex flex-col lg:flex-row px-6 lg:px-10 pb-20 gap-6 lg:gap-10">
        {/* Sidebar */}
        {/* top-44 clears the sticky site header (~165px tall on desktop) —
            with the old top-5 the filters pinned underneath it and were
            unreadable while scrolling. self-start is required for sticky to
            work inside a stretched flex row. */}
        <aside className="w-full lg:w-[180px] flex-shrink-0 lg:sticky lg:top-44 lg:self-start">
          {/* Category Filter */}
          <div className="mb-7">
            <h2 className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b6b6b] mb-2.5 pb-1.5 border-b border-[#d0d0d0]">
              Category
            </h2>
            <div className="flex flex-wrap lg:flex-col gap-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  aria-pressed={activeCategory === cat}
                  className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 px-0 lg:px-0 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                    activeCategory === cat
                      ? "text-black font-extrabold border-l-2 border-[#ef473f] pl-2"
                      : "text-[#6b6b6b] hover:text-black"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Gender Filter */}
          <div className="mb-7">
            <h2 className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b6b6b] mb-2.5 pb-1.5 border-b border-[#d0d0d0]">
              Gender
            </h2>
            <div className="flex flex-wrap lg:flex-col gap-1">
              {genders.map((gender) => (
                <button
                  key={gender}
                  onClick={() => setActiveGender(gender)}
                  aria-pressed={activeGender === gender}
                  className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                    activeGender === gender
                      ? "text-black font-extrabold border-l-2 border-[#ef473f] pl-2"
                      : "text-[#6b6b6b] hover:text-black"
                  }`}
                >
                  {gender}
                </button>
              ))}
            </div>
          </div>

          {/* Brand Filter */}
          {brands.length > 1 && (
            <div className="mb-7">
              <h2 className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b6b6b] mb-2.5 pb-1.5 border-b border-[#d0d0d0]">
                Brand
              </h2>
              <div className="flex flex-wrap lg:flex-col gap-1">
                {brands.map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setActiveBrand(brand)}
                    aria-pressed={activeBrand === brand}
                    className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                      activeBrand === brand
                        ? "text-black font-extrabold border-l-2 border-[#ef473f] pl-2"
                        : "text-[#6b6b6b] hover:text-black"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tag Filter — team-managed (US/Canada plus any custom tags). Hard
              filter; the region soft-sort above is separate. */}
          {tags.length > 0 && (
            <div className="mb-7">
              <h2 className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#6b6b6b] mb-2.5 pb-1.5 border-b border-[#d0d0d0]">
                Tags
              </h2>
              <div className="flex flex-wrap lg:flex-col gap-1">
                {["All", ...tags].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    aria-pressed={activeTag === tag}
                    className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] ${
                      activeTag === tag
                        ? "text-black font-extrabold border-l-2 border-[#ef473f] pl-2"
                        : "text-[#6b6b6b] hover:text-black"
                    }`}
                  >
                    {tag === "All" ? "All" : displayTag(tag)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <p aria-live="polite" className="text-xs text-[#6b6b6b] tracking-wider uppercase font-semibold mb-4">
            <span className="text-[#d93e36]">{filteredProducts.length}</span> product{filteredProducts.length !== 1 ? "s" : ""}
          </p>

          {filteredProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.sku}
                  product={product}
                  onClick={() => openProductDetail(product)}
                />
              ))}
            </div>
          ) : products.length === 0 ? (
            // The catalog itself is empty (fresh database / outage) — telling
            // the visitor to "try different filters" would be misleading.
            <div className="text-center py-16 text-[#6b6b6b]">
              <p className="font-extrabold text-2xl tracking-wider uppercase text-black mb-2">Catalogue Coming Soon</p>
              <p className="text-sm">
                We&apos;re stocking the studio. In the meantime,{" "}
                <Link href="/#contact" className="underline hover:text-black">contact us</Link> for product availability.
              </p>
            </div>
          ) : (
            <div className="text-center py-16 text-[#6b6b6b]">
              <p className="font-extrabold text-2xl tracking-wider uppercase text-black mb-2">No Results</p>
              <p className="text-sm">Try different filters or a new search term.</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Banner */}
      <div className="mx-6 lg:mx-10 mb-10 bg-black rounded-lg p-8 lg:p-10 flex flex-wrap items-center justify-between gap-5">
        <div>
          <h2 className="font-extrabold text-xl lg:text-2xl uppercase text-white mb-1">
            {bannerHeading}
          </h2>
          <p className="text-[#999] text-sm">
            {bannerBody}
          </p>
        </div>
        <Link
          href="/my-quote"
          className="inline-flex items-center gap-2.5 bg-[#ef473f] text-white px-7 py-3.5 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          {bannerCta}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
      </main>

      <Footer />

      <ProductDetailModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={closeProductDetail}
      />
    </div>
  )
}
