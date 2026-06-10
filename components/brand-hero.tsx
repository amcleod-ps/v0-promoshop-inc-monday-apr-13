"use client"

import type { Brand } from "@/lib/brands"
import { SiteImage } from "@/components/site-image"
import { BrandLogo } from "@/components/brand-logo"
import { brandLifestyleId } from "@/lib/image-registry"
import { useImageSrc } from "@/hooks/use-image-src"
import { useSiteText } from "@/components/site-content-provider"
import { imageFitClass, imageFitKey, normalizeImageFit } from "@/lib/image-fit"

// Brand detail hero — renders the brand LOGO (not text) with an optional
// lifestyle image behind it per client feedback (Apr 16). When no lifestyle
// image is configured in the admin image manager, we fall back to a soft
// sky-blue → white gradient that matches the rest of the site's accent.
interface Props {
  brand: Brand
}

export function BrandHero({ brand }: Props) {
  const lifestyleId = brandLifestyleId(brand.slug)
  const lifestyleSrc = useImageSrc(lifestyleId, "")
  // Admin-chosen display mode for the backdrop (cover crops to fill).
  const lifestyleFit = normalizeImageFit(
    useSiteText(imageFitKey(lifestyleId), "cover"),
  )

  return (
    <div className="relative overflow-hidden rounded-xl mb-8 border border-[#d8e8f3]">
      {/* Lifestyle background image (behind the logo). */}
      {lifestyleSrc ? (
        <SiteImage
          imageId={lifestyleId}
          defaultSrc=""
          alt=""
          aria-hidden="true"
          width={1600}
          height={600}
          className={`absolute inset-0 w-full h-full ${imageFitClass(lifestyleFit)}`}
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#bde7ff] via-white to-[#e8f5ff]" />
      )}
      {/* Soft vignette so the logo reads on any background. */}
      <div className="absolute inset-0 bg-white/30" />

      {/* Logo card */}
      <div className="relative flex items-center justify-center py-16 lg:py-20 px-6">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-10 py-6 shadow-md border border-white/70">
          <BrandLogo
            brand={brand}
            width={280}
            height={110}
            className="max-h-24 w-auto object-contain"
            fallbackClassName="font-bebas text-4xl tracking-wider text-[#373a36]"
          />
        </div>
      </div>
    </div>
  )
}
