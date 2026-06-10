"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Search, ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ProductCard } from "@/components/studio/product-card"
import { ProductDetailModal } from "@/components/studio/product-detail-modal"
import { useLocale } from "@/lib/locale-context"
import type { Product } from "@/lib/products"

interface Props {
  products: Product[]
  categories: string[]
  brands: string[]
  /** Pre-selected category (from /studio?category=… deep links). */
  initialCategory?: string
}

export default function StudioClient({ products, categories, brands, initialCategory }: Props) {
  const { t } = useLocale()
  const [searchTerm, setSearchTerm] = useState("")
  const [activeCategory, setActiveCategory] = useState(
    initialCategory && categories.includes(initialCategory) ? initialCategory : "All",
  )
  const [activeGender, setActiveGender] = useState("All")
  const [activeBrand, setActiveBrand] = useState("All")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const genders = ["All", "Men's", "Women's", "Unisex"]

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const catOk = activeCategory === "All" || product.category === activeCategory

      let genderOk = activeGender === "All"
      if (activeGender === "Men's") genderOk = product.gender.includes("Mens")
      else if (activeGender === "Women's") genderOk = product.gender.includes("Womens")
      else if (activeGender === "Unisex") genderOk = product.gender.includes("Unisex")

      const brandOk = activeBrand === "All" || product.brands.includes(activeBrand)

      const searchLower = searchTerm.toLowerCase()
      const searchOk =
        !searchTerm ||
        product.name.toLowerCase().includes(searchLower) ||
        product.sku.toLowerCase().includes(searchLower) ||
        product.brands.join(" ").toLowerCase().includes(searchLower) ||
        product.category.toLowerCase().includes(searchLower)

      return catOk && genderOk && brandOk && searchOk
    })
  }, [products, activeCategory, activeGender, activeBrand, searchTerm])

  const openProductDetail = (product: Product) => {
    setSelectedProduct(product)
    setIsModalOpen(true)
  }

  const closeProductDetail = () => {
    setIsModalOpen(false)
    setTimeout(() => setSelectedProduct(null), 300)
  }

  return (
    <div className="min-h-screen bg-[#ededed] text-[#111111] font-montserrat">
      <Header />

      {/* Header Section */}
      <main id="main-content" className="contents">
      <div className="px-6 lg:px-10 pt-10 pb-5 flex flex-wrap justify-between items-end gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.3em] text-[#6b6b6b] uppercase mb-1.5">
            PromoShop Studio — Product {t("Catalog")}
          </p>
          <h1 className="text-4xl lg:text-6xl font-extrabold uppercase tracking-tight text-black">
            Browse Our Products
          </h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#888]" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search products"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black text-white pl-10 pr-4 py-3 rounded text-xs font-bold tracking-wider uppercase w-[280px] outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#ededed] placeholder:text-[#999]"
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
        <aside className="w-full lg:w-[180px] flex-shrink-0 lg:sticky lg:top-5">
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
                  className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 px-0 lg:px-0 transition-colors ${
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
                  className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 transition-colors ${
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
                    className={`text-left text-xs font-semibold tracking-wide uppercase py-1.5 transition-colors ${
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
            Ready to Order?
          </h2>
          <p className="text-[#999] text-sm">
            Start a quote to unlock pricing, quantities, and full {t("customization")} options.
          </p>
        </div>
        <Link
          href="/my-quote"
          className="inline-flex items-center gap-2.5 bg-[#ef473f] text-white px-7 py-3.5 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          Start Your Quote
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
