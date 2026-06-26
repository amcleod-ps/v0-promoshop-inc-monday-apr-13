import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SafeImage } from "@/components/safe-image"
import { getCollectionsWithPreview } from "@/lib/supabase/collections"
import { getSiteContentMap, resolveSiteText } from "@/lib/supabase/content"
import { textFallback } from "@/lib/cms/text-slots"

export const metadata: Metadata = {
  title: "Collections",
  description:
    "Curated collections of branded merchandise from PromoShop — hand-picked product groupings for your next campaign, gift, or store.",
}

export default async function CollectionsPage() {
  const [previews, content] = await Promise.all([
    getCollectionsWithPreview(),
    getSiteContentMap(),
  ])
  const eyebrow = resolveSiteText(content, "collections.page.eyebrow", textFallback("collections.page.eyebrow"))
  const heading = resolveSiteText(content, "collections.page.heading", textFallback("collections.page.heading"))
  const intro = resolveSiteText(content, "collections.page.body", textFallback("collections.page.body"))

  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
        {/* Editorial hero */}
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-6 lg:px-8 py-16 lg:py-24">
            <p className="text-xs font-bold tracking-[0.25em] text-[#ef473f] uppercase mb-4">
              {eyebrow}
            </p>
            <h1 className="font-montserrat font-black text-4xl lg:text-6xl tracking-tight max-w-3xl">
              {heading}
            </h1>
            <p className="mt-6 text-lg text-[#aaa] leading-relaxed font-visby max-w-2xl">
              {intro}
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 lg:px-8 py-14 lg:py-20">
          {previews.length === 0 ? (
            <div className="text-center py-20 text-[#888]">
              <p className="font-extrabold text-2xl tracking-wider uppercase text-white mb-2">
                Collections Coming Soon
              </p>
              <p className="text-sm font-visby">
                We&apos;re curating our first collections. In the meantime,{" "}
                <Link href="/studio" className="underline hover:text-white">
                  browse the full studio
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {previews.map(({ collection, cover, count }) => (
                <Link
                  key={collection.slug}
                  href={`/collections/${collection.slug}`}
                  className="group block rounded-lg overflow-hidden bg-[#181818] border border-white/10 hover:border-[#ef473f]/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef473f]"
                >
                  <div className="relative aspect-[4/3] bg-[#0d0d0d] overflow-hidden">
                    {cover ? (
                      <SafeImage
                        src={cover}
                        alt={collection.name}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-[#444] font-montserrat font-black text-2xl uppercase tracking-widest">
                        {collection.name}
                      </div>
                    )}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="font-montserrat font-bold text-xl tracking-wide">
                        {collection.name}
                      </h2>
                      <span className="text-[10px] font-bold tracking-wider uppercase text-[#ef473f] whitespace-nowrap">
                        {count} {count === 1 ? "item" : "items"}
                      </span>
                    </div>
                    {collection.description ? (
                      <p className="mt-2 text-sm text-[#999] leading-relaxed font-visby line-clamp-3">
                        {collection.description}
                      </p>
                    ) : null}
                    <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white group-hover:text-[#ef473f] transition-colors">
                      Explore
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  )
}
