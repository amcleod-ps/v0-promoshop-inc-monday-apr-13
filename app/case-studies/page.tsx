import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "See how PromoShop brings brands to life — case studies of branded merchandise programs, campaigns, and custom product work.",
}

// Placeholder until case-study content is defined. Mirrors the Collections
// page's editorial hero so the new tab feels native to the site.
export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
        <section className="relative overflow-hidden border-b border-white/10">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-8 pb-4 lg:pt-10">
            <p className="text-xs font-bold tracking-[0.25em] text-[#ef473f] uppercase mb-4">
              Our Work
            </p>
            <h1 className="font-montserrat font-black text-4xl lg:text-6xl tracking-tight max-w-3xl">
              Case Studies
            </h1>
            <p className="mt-6 text-lg text-[#aaa] leading-relaxed font-visby max-w-2xl">
              A closer look at the programs, campaigns, and custom merchandise we&apos;ve built with our clients.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 lg:px-8 pt-8 pb-14 lg:pt-12 lg:pb-20">
          <div className="text-center py-20 text-[#888]">
            <p className="font-extrabold text-2xl tracking-wider uppercase text-white mb-2">
              Case Studies Coming Soon
            </p>
            <p className="text-sm font-visby">
              We&apos;re putting our first case studies together. In the meantime,{" "}
              <Link href="/studio" className="underline hover:text-white">
                browse the full studio
              </Link>
              .
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
