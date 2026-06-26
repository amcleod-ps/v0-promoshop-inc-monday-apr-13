import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CollectionProducts } from "@/components/collections/collection-products"
import { getCollectionWithProducts } from "@/lib/supabase/collections"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getCollectionWithProducts(slug)
  if (!data) return {}
  const { collection } = data
  return {
    title: collection.name,
    description:
      collection.description ??
      `${collection.name} — a curated collection of branded merchandise from PromoShop.`,
  }
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const data = await getCollectionWithProducts(slug)
  if (!data) notFound()
  const { collection, products } = data

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-14 lg:py-20">
            <Link
              href="/collections"
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#999] hover:text-white transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f]"
            >
              <ArrowLeft className="w-4 h-4" />
              All collections
            </Link>
            <h1 className="mt-6 font-montserrat font-black text-4xl lg:text-5xl tracking-tight">
              {collection.name}
            </h1>
            {collection.description ? (
              <p className="mt-5 text-lg text-[#aaa] leading-relaxed font-visby max-w-2xl">
                {collection.description}
              </p>
            ) : null}
            <p className="mt-4 text-[10px] font-bold tracking-[0.2em] uppercase text-[#ef473f]">
              {products.length} {products.length === 1 ? "item" : "items"}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 lg:px-8 py-12 lg:py-16">
          <CollectionProducts products={products} />
        </section>
      </main>

      <Footer />
    </div>
  )
}
