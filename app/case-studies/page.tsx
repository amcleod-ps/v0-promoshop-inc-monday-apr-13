import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CaseStudiesShowcase } from "@/components/case-studies/case-studies-showcase"
import { CASE_STUDIES } from "@/lib/case-studies"

export const metadata: Metadata = {
  title: "Case Studies",
  description:
    "How PromoShop brings brands to life: custom apparel, contest prizes, launch kits and press mailers for Maserati, Pabst Blue Ribbon, Mopar, Perrier, National Geographic and more.",
}

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      <Header />

      <main id="main-content">
        <section className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#ef473f]" aria-hidden="true" />
          <div className="mx-auto max-w-7xl px-6 lg:px-8 pt-10 pb-8 lg:pt-16 lg:pb-10">
            <p className="text-xs font-bold tracking-[0.25em] text-[#ef473f] uppercase mb-4">Our Work</p>
            <h1 className="font-montserrat font-black text-4xl lg:text-7xl tracking-tight max-w-4xl">
              Ideas that made brands unforgettable.
            </h1>
            <p className="mt-6 text-lg text-[#aaa] leading-relaxed font-visby max-w-2xl">
              Six projects, from first sketch to delivery. Drag the products to turn them, then scroll for the story.
            </p>
          </div>
        </section>

        <CaseStudiesShowcase studies={CASE_STUDIES} />

        <section className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-8 lg:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#ef473f]">Your brand next</p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-black tracking-tight lg:text-5xl">
            Let&apos;s build something people keep.
          </h2>
          <Link
            href="/my-quote"
            className="mt-10 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#ef473f] bg-[linear-gradient(#0002,#0002)] px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#d93e36]"
          >
            Start my quote
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <Footer />
    </div>
  )
}
