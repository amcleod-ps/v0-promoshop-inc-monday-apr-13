import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"

// Branded 404 — without this, unknown URLs (including dead brand slugs)
// rendered Next's unbranded default with no way back into the site.
export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1a1a] flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="max-w-md text-center">
          <p className="text-xs font-bold tracking-wider text-[#d93e36] uppercase mb-3">404 — Page Not Found</p>
          <h1 className="font-montserrat font-bold text-3xl lg:text-4xl mb-4">
            We couldn&apos;t find that page
          </h1>
          <p className="text-[#666] font-visby mb-8">
            The page may have moved or no longer exists. Try the studio or browse our brands instead.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity"
            >
              Back to Home
            </Link>
            <Link
              href="/studio"
              className="inline-flex items-center justify-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
