"use client"

import { useEffect } from "react"
import Link from "next/link"

// Route-level error boundary. Renders inside the root layout (header chrome
// comes from the layout's providers being unaffected), keeps the visitor on
// a branded page, and offers a retry instead of Next's default grey screen.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Route error boundary caught:", error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#1a1a1a] flex items-center justify-center px-6 py-24">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold tracking-wider text-[#d93e36] uppercase mb-3">Something went wrong</p>
        <h1 className="font-montserrat font-bold text-3xl mb-4">We hit a snag loading this page</h1>
        <p className="text-[#666] font-visby mb-8">
          Please try again — if it keeps happening, contact us and we&apos;ll sort it out.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 bg-[#ef473f] text-white px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-[#e5e5e5] text-[#1a1a1a] px-6 py-3 font-bold uppercase tracking-wider text-sm rounded hover:border-[#ef473f] transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
