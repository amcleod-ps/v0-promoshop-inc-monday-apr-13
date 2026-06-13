"use client"

import Link from "next/link"
import { BRANDS } from "@/lib/brands"
import { SiteImage } from "@/components/site-image"
import { brandLogoId } from "@/lib/image-registry"
import { useImageSrc } from "@/hooks/use-image-src"

interface BrandData {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

interface BrandLogoScrollProps {
  brands?: BrandData[] | null
}

// Tile — no borders, no background. Logo floats directly on the sky-blue
// (#bde7ff) banner per client feedback (Apr 16). When a brand hasn't had
// a logo uploaded yet we fall back to a neutral wordmark sized + weighted
// to sit harmoniously next to real logos — so a half-populated scroll
// still reads as a cohesive row rather than a broken state.
//
// Defined at module level (not inside the parent's render) so React keeps
// the same component identity across renders instead of remounting every
// tile. Each tile links to its brand page — the homepage previously passed
// no link equity (or navigation path) to the brand details at all.
function Tile({ brand, decorative = false }: { brand: BrandData; decorative?: boolean }) {
  const id = brandLogoId(brand.slug)
  const src = useImageSrc(id, brand.logoUrl ?? "")
  const logo = src ? (
    <SiteImage
      imageId={id}
      defaultSrc={brand.logoUrl ?? ""}
      alt={decorative ? "" : brand.name}
      width={140}
      height={70}
      className="max-h-14 w-auto object-contain"
      unoptimized
    />
  ) : (
    <span className="font-bebas text-3xl tracking-[0.12em] uppercase text-[#1a1f2a] whitespace-nowrap">
      {brand.name}
    </span>
  )
  return (
    <div className="flex-shrink-0 mx-10 flex items-center justify-center">
      {decorative ? (
        // The duplicate run exists purely to make the loop seamless. It lives
        // inside an aria-hidden subtree, so it must NOT be a focusable/clickable
        // link (avoids the aria-hidden-focus violation and stray click targets).
        <div className="h-16 flex items-center justify-center px-3">{logo}</div>
      ) : (
        <Link
          href={`/brands/${brand.slug}`}
          className="h-16 flex items-center justify-center px-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a1f2a]"
        >
          {logo}
        </Link>
      )}
    </div>
  )
}

export function BrandLogoScroll({ brands: propBrands }: BrandLogoScrollProps) {
  // null/undefined = Supabase unreachable → fall back to static BRANDS.
  // An empty array is a deliberate "no active brands" state, so render
  // nothing instead of resurrecting the compiled-in list.
  const brands = propBrands ?? BRANDS.map(b => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    logoUrl: b.logoUrl ?? null,
  }))

  if (brands.length === 0) return null

  return (
    <section className="py-10 bg-[#bde7ff] overflow-hidden" aria-label="Brands we carry">
      <div className="relative">
        {/* Soft fade at the edges so the scroll doesn't feel hard-cut. */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#bde7ff] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#bde7ff] to-transparent z-10 pointer-events-none" />

        {/* Scrolling container. `w-max` makes the track exactly as wide as
            its content — the -50% keyframe translation is measured against
            the track, so without it the loop visibly snaps every cycle. */}
        <div className="flex w-max animate-scroll">
          {brands.map((brand, index) => (
            <Tile key={`brand-1-${index}`} brand={brand} />
          ))}
          {/* Duplicate run exists only to make the loop seamless — hide it
              from assistive tech and render it non-interactive. */}
          <div className="contents" aria-hidden="true">
            {brands.map((brand, index) => (
              <Tile key={`brand-2-${index}`} brand={brand} decorative />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
