import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getBrandBySlug } from "@/lib/brands"
import { getAllProducts } from "@/lib/supabase/products"
import { BrandHero } from "@/components/brand-hero"
import { BrandProductsGrid } from "@/components/brand-products-grid"

interface BrandPageProps {
  params: Promise<{ slug: string }>
}

export default async function BrandPage({ params }: BrandPageProps) {
  const { slug } = await params
  const brand = getBrandBySlug(slug)

  if (!brand) {
    notFound()
  }

  const products = await getAllProducts()
  const brandProducts = products.filter((p) =>
    p.brands.some((b) => b.toLowerCase() === brand.name.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-[#ededed] text-[#111] font-montserrat">
      <Header />

      {/* Breadcrumb & Hero */}
      <section className="px-6 lg:px-10 pt-8 pb-12">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href="/brands"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#777] hover:text-[#ef473f] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            All Brands
          </Link>

          {/* Brand Hero — logo over lifestyle background. */}
          <BrandHero brand={brand} />

          {/* Description + CTA */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <p className="text-lg text-[#666] max-w-2xl leading-relaxed">
              {brand.description}
            </p>

            <Link
              href="/my-quote"
              className="inline-flex items-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap self-start"
            >
              START MY QUOTE
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-2 mt-6">
            {brand.categories.map((cat) => (
              <span
                key={cat}
                className="text-xs font-bold tracking-wider uppercase px-3 py-1.5 bg-white border border-[#d0d0d0] rounded text-[#666]"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="px-6 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-extrabold text-xl uppercase tracking-wide text-black mb-6">
            Products from {brand.name}
          </h2>

          {/* Clicking a card opens the detail modal in place, restoring the
              add-to-quote flow that was broken when cards were wrapped in a
              Link to /studio (client feedback Apr 16). */}
          <BrandProductsGrid products={brandProducts} brandName={brand.name} />
        </div>
      </section>

      {/* More Brands CTA */}
      <section className="px-6 lg:px-10 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-black rounded-lg p-8 lg:p-10 flex flex-wrap items-center justify-between gap-5">
            <div>
              <h3 className="font-extrabold text-xl lg:text-2xl uppercase text-white mb-1">
                Explore More Brands
              </h3>
              <p className="text-[#888] text-sm">
                Discover our full collection of premium brand partners.
              </p>
            </div>
            <Link
              href="/brands"
              className="inline-flex items-center gap-2.5 bg-[#ef473f] text-white px-7 py-3.5 font-extrabold text-sm tracking-wider uppercase rounded hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              View All Brands
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
